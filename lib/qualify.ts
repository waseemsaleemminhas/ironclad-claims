/**
 * Decides whether a call is billable, and why.
 *
 * Deliberately NOT a rules engine. Two parameters per rate card cover every
 * arrangement we have. If this ever needs an expression language, stop and
 * reconsider the product.
 */

export type UnitType = "transfer" | "sale";

export interface RateCard {
  id: string;
  unitType: UnitType;
  rateCents: number;
  minDurationSec: number;
  qualifyingStatuses: string[];
  effectiveFrom: string;        // YYYY-MM-DD
  effectiveTo: string | null;   // YYYY-MM-DD, null = open ended
}

export interface CallEvent {
  id: string;
  callAt: string;               // ISO datetime
  disposition: string;
  transferSec: number;
  talkSec: number;
}

export interface QualifyResult {
  qualifies: boolean;
  reason: string;               // shown to humans, and on the claim
  rateCardId: string | null;
  rateCents: Cents;
}

type Cents = number;

/** YYYY-MM-DD from an ISO datetime. */
export function dateOf(isoDatetime: string): string {
  return isoDatetime.slice(0, 10);
}

/**
 * The rate card in force on a given date. Where several overlap, the one with
 * the latest effectiveFrom wins, so corrections supersede originals.
 */
export function pickRateCard(cards: RateCard[], onDate: string): RateCard | null {
  const live = cards.filter(
    (c) => c.effectiveFrom <= onDate && (c.effectiveTo === null || onDate <= c.effectiveTo),
  );
  if (live.length === 0) return null;
  return live.slice().sort((a, b) =>
    a.effectiveFrom === b.effectiveFrom
      ? a.id.localeCompare(b.id)
      : b.effectiveFrom.localeCompare(a.effectiveFrom),
  )[0];
}

export function qualifyTransfer(call: CallEvent, card: RateCard | null): QualifyResult {
  const no = (reason: string): QualifyResult => ({
    qualifies: false, reason, rateCardId: card?.id ?? null, rateCents: 0,
  });

  if (!card) return no(`No rate card in force on ${dateOf(call.callAt)}`);
  if (card.unitType !== "transfer") return no(`Rate card bills per ${card.unitType}, not per transfer`);

  const allowed = card.qualifyingStatuses.map((s) => s.toUpperCase());
  const got = call.disposition.toUpperCase();
  if (!allowed.includes(got)) {
    return no(`Disposition ${got} is not billable (billable: ${allowed.join(", ") || "none set"})`);
  }
  if (call.transferSec < card.minDurationSec) {
    return no(`Transfer lasted ${call.transferSec}s, minimum is ${card.minDurationSec}s`);
  }
  return {
    qualifies: true,
    reason: `${got}, transferred ${call.transferSec}s (min ${card.minDurationSec}s)`,
    rateCardId: card.id,
    rateCents: card.rateCents,
  };
}

export function qualifySale(
  call: CallEvent,
  card: RateCard | null,
  hasMatchedSale: boolean,
): QualifyResult {
  const no = (reason: string): QualifyResult => ({
    qualifies: false, reason, rateCardId: card?.id ?? null, rateCents: 0,
  });

  if (!card) return no(`No rate card in force on ${dateOf(call.callAt)}`);
  if (card.unitType !== "sale") return no(`Rate card bills per ${card.unitType}, not per sale`);
  if (!hasMatchedSale) return no("No sale matched to this call");

  const allowed = card.qualifyingStatuses.map((s) => s.toUpperCase());
  const got = call.disposition.toUpperCase();
  if (allowed.length > 0 && !allowed.includes(got)) {
    return no(`Sale logged, but disposition ${got} is not billable (billable: ${allowed.join(", ")})`);
  }
  if (call.transferSec < card.minDurationSec) {
    return no(`Sale logged, but transfer lasted ${call.transferSec}s, minimum is ${card.minDurationSec}s`);
  }
  return {
    qualifies: true,
    reason: `Sale on ${got}, transferred ${call.transferSec}s`,
    rateCardId: card.id,
    rateCents: card.rateCents,
  };
}
