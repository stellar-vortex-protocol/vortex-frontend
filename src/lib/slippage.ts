// Slippage / intent-deadline helpers shared by SwapCard and SwapSettings (#418).

export const DEFAULT_SLIPPAGE_PCT = 0.5;
export const SLIPPAGE_PRESETS = [0.1, 0.5, 1] as const;
export const MIN_SLIPPAGE_PCT = 0.01;
export const MAX_SLIPPAGE_PCT = 50;
export const LOW_SLIPPAGE_WARN_PCT = 0.1;
export const HIGH_SLIPPAGE_WARN_PCT = 5;

export const DEFAULT_DEADLINE_MIN = 15;
export const DEADLINE_PRESETS_MIN = [5, 15, 30, 60] as const;

export type SlippageStatus = "ok" | "low" | "high" | "invalid";

/**
 * Parses user-entered slippage text. Accepts comma decimals ("0,5") and a
 * trailing percent sign ("0.5%"). Returns NaN for anything that isn't a plain
 * non-negative decimal.
 */
export function parseSlippageInput(raw: string): number {
  const cleaned = raw.trim().replace(/%$/, "").trim().replace(",", ".");
  if (!/^\d*\.?\d+$|^\d+\.$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

export function getSlippageStatus(pct: number): SlippageStatus {
  if (!Number.isFinite(pct) || pct < MIN_SLIPPAGE_PCT || pct > MAX_SLIPPAGE_PCT) return "invalid";
  if (pct < LOW_SLIPPAGE_WARN_PCT) return "low";
  if (pct > HIGH_SLIPPAGE_WARN_PCT) return "high";
  return "ok";
}

// BigInt() calls rather than `n` literals: tsconfig targets ES2017.
const ZERO = BigInt(0);
const BASIS = BigInt(10_000);

function toUnits(amount: string, decimals: number): bigint | null {
  const match = /^(\d*)(?:\.(\d*))?$/.exec(amount.trim());
  if (!match || (!match[1] && !match[2])) return null;
  const whole = match[1] || "0";
  // Truncate (never round up) any precision beyond the token's decimals.
  const frac = (match[2] ?? "").slice(0, decimals).padEnd(decimals, "0");
  return BigInt(whole + frac);
}

function fromUnits(units: bigint, decimals: number): string {
  const str = units.toString().padStart(decimals + 1, "0");
  const whole = str.slice(0, str.length - decimals);
  const frac = str.slice(str.length - decimals).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

/**
 * Minimum acceptable output for an intent: `dstAmount * (1 - slippage)`,
 * computed in integer base units and always rounded down so the user never
 * advertises a floor higher than the quote allows. Slippage is resolved to
 * hundredths of a percent (the input minimum). Returns "0" for bad input.
 */
export function computeMinOut(dstAmount: string, slippagePct: number, decimals: number): string {
  const units = toUnits(dstAmount, decimals);
  if (units === null || units <= ZERO || !Number.isFinite(slippagePct)) return "0";
  const pct = Math.min(Math.max(slippagePct, 0), 100);
  const keepBasis = BASIS - BigInt(Math.round(pct * 100));
  return fromUnits((units * keepBasis) / BASIS, decimals);
}
