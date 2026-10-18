import test from "node:test";
import assert from "node:assert/strict";
import { allocatePayment, type OpenLine } from "../lib/allocate.ts";

const line = (id: string, claimedAt: string, claimed = 3500, allocated = 0): OpenLine =>
  ({ id, claimedAt, claimedCents: claimed, allocatedCents: allocated });

test("fills oldest claims first", () => {
  const r = allocatePayment(7000, [
    line("b", "2026-10-02T00:00:00Z"),
    line("a", "2026-10-01T00:00:00Z"),
  ]);
  assert.deepEqual(r.allocations, [
    { billableItemId: "a", amountCents: 3500 },
    { billableItemId: "b", amountCents: 3500 },
  ]);
  assert.equal(r.unallocatedCents, 0);
  assert.deepEqual(r.fullySettledIds, ["a", "b"]);
});

test("a short payment part-fills the last line it reaches", () => {
  const r = allocatePayment(5000, [
    line("a", "2026-10-01T00:00:00Z"),
    line("b", "2026-10-02T00:00:00Z"),
  ]);
  assert.deepEqual(r.allocations, [
    { billableItemId: "a", amountCents: 3500 },
    { billableItemId: "b", amountCents: 1500 },
  ]);
  assert.deepEqual(r.fullySettledIds, ["a"]);
});

test("overpayment is surfaced, not quietly absorbed", () => {
  const r = allocatePayment(10000, [line("a", "2026-10-01T00:00:00Z")]);
  assert.equal(r.unallocatedCents, 6500);
});

test("respects what earlier payments already covered", () => {
  const r = allocatePayment(1000, [line("a", "2026-10-01T00:00:00Z", 3500, 3000)]);
  assert.deepEqual(r.allocations, [{ billableItemId: "a", amountCents: 500 }]);
  assert.equal(r.unallocatedCents, 500);
});

test("settled lines are skipped and ties break deterministically", () => {
  const r = allocatePayment(3500, [
    line("z", "2026-10-01T00:00:00Z", 3500, 3500),
    line("b", "2026-10-01T00:00:00Z"),
    line("a", "2026-10-01T00:00:00Z"),
  ]);
  assert.deepEqual(r.allocations, [{ billableItemId: "a", amountCents: 3500 }]);
});

test("negative payments are refused", () => {
  assert.throws(() => allocatePayment(-100, []));
});
