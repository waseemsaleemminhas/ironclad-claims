/**
 * Ties a logged sale back to the call that produced it.
 *
 * The sales sheet carries phone + date; the dialer export carries the same.
 * That is the only join we have until sales are captured against a lead_id.
 *
 * This never guesses. One false line on a claim destroys the credibility of
 * every other line on it, so ambiguity goes to a human.
 */

export interface SaleEvent {
  id: string;
  phoneHash: string;
  saleDate: string;    // YYYY-MM-DD
  campaignId: string;
}

export interface CallCandidate {
  id: string;
  phoneHash: string;
  callDate: string;    // YYYY-MM-DD
  campaignId: string;
}

export type MatchResult =
  | { status: "matched"; callEventId: string; method: "same_day" | "adjacent_day";
      confidence: number; needsReview: boolean; reason: string }
  | { status: "ambiguous"; candidateIds: string[]; reason: string }
  | { status: "unmatched"; reason: string };

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function matchSale(sale: SaleEvent, calls: CallCandidate[]): MatchResult {
  const sameCampaignAndNumber = calls.filter(
    (c) => c.phoneHash === sale.phoneHash && c.campaignId === sale.campaignId,
  );

  if (sameCampaignAndNumber.length === 0) {
    return { status: "unmatched", reason: "No call to this number on this campaign" };
  }

  const sameDay = sameCampaignAndNumber.filter((c) => c.callDate === sale.saleDate);
  if (sameDay.length === 1) {
    return {
      status: "matched", callEventId: sameDay[0].id, method: "same_day",
      confidence: 1, needsReview: false,
      reason: `Single call to this number on ${sale.saleDate}`,
    };
  }
  if (sameDay.length > 1) {
    return {
      status: "ambiguous",
      candidateIds: sameDay.map((c) => c.id).sort(),
      reason: `${sameDay.length} calls to this number on ${sale.saleDate}`,
    };
  }

  // A sale logged the morning after a late call is common, so look either side
  // of the date — but flag it, never claim it silently.
  const adjacent = sameCampaignAndNumber.filter(
    (c) => c.callDate === addDays(sale.saleDate, -1) || c.callDate === addDays(sale.saleDate, 1),
  );
  if (adjacent.length === 1) {
    return {
      status: "matched", callEventId: adjacent[0].id, method: "adjacent_day",
      confidence: 0.8, needsReview: true,
      reason: `Call on ${adjacent[0].callDate}, sale logged ${sale.saleDate} — confirm before claiming`,
    };
  }
  if (adjacent.length > 1) {
    return {
      status: "ambiguous",
      candidateIds: adjacent.map((c) => c.id).sort(),
      reason: `${adjacent.length} calls to this number either side of ${sale.saleDate}`,
    };
  }

  return { status: "unmatched", reason: `Calls to this number exist, but none near ${sale.saleDate}` };
}
