import test from "node:test";
import assert from "node:assert/strict";
import { matchSale, type SaleEvent, type CallCandidate } from "../lib/match.ts";

const sale: SaleEvent = { id: "s1", phoneHash: "abc", saleDate: "2026-10-16", campaignId: "fe" };
const c = (id: string, callDate: string, phoneHash = "abc", campaignId = "fe"): CallCandidate =>
  ({ id, callDate, phoneHash, campaignId });

test("exactly one call that day is an automatic match", () => {
  const r = matchSale(sale, [c("c1", "2026-10-16")]);
  assert.equal(r.status, "matched");
  if (r.status === "matched") {
    assert.equal(r.method, "same_day");
    assert.equal(r.needsReview, false);
  }
});

test("two calls to the same number that day go to a human", () => {
  const r = matchSale(sale, [c("c2", "2026-10-16"), c("c1", "2026-10-16")]);
  assert.equal(r.status, "ambiguous");
  if (r.status === "ambiguous") assert.deepEqual(r.candidateIds, ["c1", "c2"]);
});

test("a call the night before matches but is flagged for review", () => {
  const r = matchSale(sale, [c("c1", "2026-10-15")]);
  assert.equal(r.status, "matched");
  if (r.status === "matched") {
    assert.equal(r.method, "adjacent_day");
    assert.equal(r.needsReview, true);
  }
});

test("a call three days earlier does not match", () => {
  assert.equal(matchSale(sale, [c("c1", "2026-10-13")]).status, "unmatched");
});

test("never matches across campaigns or across numbers", () => {
  assert.equal(matchSale(sale, [c("c1", "2026-10-16", "abc", "medicare")]).status, "unmatched");
  assert.equal(matchSale(sale, [c("c1", "2026-10-16", "zzz")]).status, "unmatched");
});
