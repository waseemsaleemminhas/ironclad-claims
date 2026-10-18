import test from "node:test";
import assert from "node:assert/strict";
import { toCents, sumCents, formatCents } from "../lib/money.ts";

test("parses plain and messy amounts", () => {
  assert.equal(toCents("12.34"), 1234);
  assert.equal(toCents("$1,234.5"), 123450);
  assert.equal(toCents(45), 4500);
  assert.equal(toCents("0.07"), 7);
  assert.equal(toCents("-3.50"), -350);
});

test("does not accumulate float error", () => {
  const ten = Array.from({ length: 10 }, () => toCents("0.10"));
  assert.equal(sumCents(ten), 100);          // 0.1*10 in floats is 0.9999...
  assert.equal(formatCents(sumCents(ten)), "$1.00");
});

test("rejects junk rather than silently zeroing", () => {
  assert.throws(() => toCents("n/a"));
  assert.throws(() => toCents(""));
});
