/**
 * Validation helpers for solver bond operations.
 * Amounts are decimal strings in USDC with up to 7 decimal places.
 */

export type BondValidationResult =
  | { ok: true; amount: string }
  | { ok: false; error: string };

const AMOUNT_PATTERN = /^\d+(\.\d{1,7})?$/;

/**
 * Validates a bond top-up or withdrawal amount.
 * Rejects non-finite values as well as zero and negative amounts.
 */
export function validateBondAmount(raw: string): BondValidationResult {
  const trimmed = raw.trim();

  if (trimmed === "") {
    return { ok: false, error: "Enter an amount." };
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return { ok: false, error: "Amount must be a finite number." };
  }

  if (value <= 0) {
    return { ok: false, error: "Amount must be greater than zero." };
  }

  if (!AMOUNT_PATTERN.test(trimmed)) {
    return { ok: false, error: "Amount must have at most 7 decimal places." };
  }

  return { ok: true, amount: trimmed };
}
