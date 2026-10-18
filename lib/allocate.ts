/**
 * Applies a received payment to specific claimed lines.
 *
 * Clients pay partial lump sums. Without this, "which of these 340 transfers
 * did this $4,200 actually pay for?" has no answer.
 */

export interface OpenLine {
  id: string;
  claimedCents: number;
  allocatedCents: number;   // already covered by earlier payments
  claimedAt: string;        // ISO datetime, for oldest-first ordering
}

export interface Allocation {
  billableItemId: string;
  amountCents: number;
}

export interface AllocationResult {
  allocations: Allocation[];
  unallocatedCents: number;   // overpayment / credit on account
  fullySettledIds: string[];
}

/**
 * Oldest claim first. Deterministic: ties break on id, so the same payment
 * against the same lines always produces the same allocation.
 */
export function allocatePayment(amountCents: number, lines: OpenLine[]): AllocationResult {
  if (amountCents < 0) throw new Error("Payment amount cannot be negative");

  const ordered = lines
    .filter((l) => l.claimedCents - l.allocatedCents > 0)
    .sort((a, b) =>
      a.claimedAt === b.claimedAt ? a.id.localeCompare(b.id) : a.claimedAt.localeCompare(b.claimedAt),
    );

  const allocations: Allocation[] = [];
  const fullySettledIds: string[] = [];
  let remaining = amountCents;

  for (const line of ordered) {
    if (remaining <= 0) break;
    const owed = line.claimedCents - line.allocatedCents;
    const take = Math.min(owed, remaining);
    allocations.push({ billableItemId: line.id, amountCents: take });
    if (take === owed) fullySettledIds.push(line.id);
    remaining -= take;
  }

  return { allocations, unallocatedCents: remaining, fullySettledIds };
}
