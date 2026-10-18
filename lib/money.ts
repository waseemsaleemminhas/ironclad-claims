/**
 * All money in this system is integer cents. Never floats.
 * Rounding disputes are the exact thing this product exists to prevent.
 */

export type Cents = number;

/** Parse a human/CSV amount ("1,234.5", "$12", 12.34) into integer cents. */
export function toCents(input: string | number): Cents {
  const raw = String(input).trim().replace(/[$,\s]/g, "");
  if (raw === "" || !/^-?\d*(\.\d*)?$/.test(raw)) {
    throw new Error(`Not a valid amount: ${JSON.stringify(input)}`);
  }
  const negative = raw.startsWith("-");
  const [whole = "0", frac = ""] = raw.replace("-", "").split(".");
  const cents = Number(whole || "0") * 100 + Number((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

export function sumCents(values: Cents[]): Cents {
  return values.reduce((a, b) => a + b, 0);
}

export function formatCents(cents: Cents, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency })
    .format(cents / 100);
}
