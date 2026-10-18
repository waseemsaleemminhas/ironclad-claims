import test from "node:test";
import assert from "node:assert/strict";
import { pickRateCard, qualifyTransfer, qualifySale, type RateCard, type CallEvent } from "../lib/qualify.ts";

const card = (over: Partial<RateCard> = {}): RateCard => ({
  id: "rc1", unitType: "transfer", rateCents: 3500, minDurationSec: 90,
  qualifyingStatuses: ["XFER", "XFERA"], effectiveFrom: "2026-01-01", effectiveTo: null, ...over,
});

const call = (over: Partial<CallEvent> = {}): CallEvent => ({
  id: "c1", callAt: "2026-10-16T14:32:00Z", disposition: "XFER",
  transferSec: 252, talkSec: 410, ...over,
});

test("picks the card in force, latest effectiveFrom wins", () => {
  const old = card({ id: "old", effectiveFrom: "2026-01-01", rateCents: 3000 });
  const now = card({ id: "new", effectiveFrom: "2026-09-01", rateCents: 3500 });
  assert.equal(pickRateCard([old, now], "2026-10-16")?.id, "new");
  assert.equal(pickRateCard([old, now], "2026-05-01")?.id, "old");
});

test("respects effectiveTo and returns null outside any window", () => {
  const expired = card({ effectiveFrom: "2026-01-01", effectiveTo: "2026-06-30" });
  assert.equal(pickRateCard([expired], "2026-10-16"), null);
  assert.equal(pickRateCard([], "2026-10-16"), null);
});

test("a good transfer qualifies with a readable reason", () => {
  const r = qualifyTransfer(call(), card());
  assert.equal(r.qualifies, true);
  assert.equal(r.rateCents, 3500);
  assert.match(r.reason, /252s/);
});

test("short transfer is rejected and says by how much", () => {
  const r = qualifyTransfer(call({ transferSec: 42 }), card());
  assert.equal(r.qualifies, false);
  assert.equal(r.rateCents, 0);
  assert.equal(r.reason, "Transfer lasted 42s, minimum is 90s");
});

test("non-billable disposition is rejected and lists what is billable", () => {
  const r = qualifyTransfer(call({ disposition: "NI" }), card());
  assert.equal(r.qualifies, false);
  assert.match(r.reason, /NI is not billable/);
  assert.match(r.reason, /XFER, XFERA/);
});

test("disposition matching ignores case", () => {
  assert.equal(qualifyTransfer(call({ disposition: "xfer" }), card()).qualifies, true);
});

test("no rate card means no claim, never a free line", () => {
  const r = qualifyTransfer(call(), null);
  assert.equal(r.qualifies, false);
  assert.equal(r.rateCents, 0);
  assert.match(r.reason, /2026-10-16/);
});

test("sale needs a matched sale event", () => {
  const sc = card({ unitType: "sale", rateCents: 12000 });
  assert.equal(qualifySale(call(), sc, false).qualifies, false);
  assert.equal(qualifySale(call(), sc, true).qualifies, true);
  assert.equal(qualifySale(call(), sc, true).rateCents, 12000);
});

test("a transfer card never bills a sale, and vice versa", () => {
  assert.match(qualifySale(call(), card(), true).reason, /not per sale/);
  assert.match(qualifyTransfer(call(), card({ unitType: "sale" })).reason, /not per transfer/);
});
