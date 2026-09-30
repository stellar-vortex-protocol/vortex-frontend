/** Stellar assets use 7 decimal places; amounts are handled as integer stroops. */
export const STELLAR_DECIMALS = 7;
// BigInt() calls rather than literals: the TS target predates ES2020.
export const ZERO = BigInt(0);
const SCALE = BigInt(10) ** BigInt(STELLAR_DECIMALS);
const AMOUNT_RE = new RegExp(`^(\\d+)(?:\\.(\\d{1,${STELLAR_DECIMALS}}))?$`);

/** Parses a user-entered decimal string into stroops; null when malformed or too precise. */
export function parseAmount(input: string): bigint | null {
  const match = AMOUNT_RE.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return BigInt(whole ?? "0") * SCALE + BigInt(fraction.padEnd(STELLAR_DECIMALS, "0"));
}

/** Formats stroops as a decimal string without trailing zeros. */
export function formatAmount(stroops: bigint): string {
  const negative = stroops < ZERO;
  const abs = negative ? -stroops : stroops;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(STELLAR_DECIMALS, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}
