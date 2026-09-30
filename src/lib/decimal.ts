/**
 * Precision-safe decimal math for monetary values.
 *
 * A `Decimal` is an immutable `{ units, decimals }` pair: `units` is a BigInt
 * count of the smallest unit (e.g. stroops for 7-decimal Stellar assets,
 * wei for 18-decimal assets) and `decimals` is the scale. Strings go in and
 * out; nothing here ever coerces a monetary value through a JS float, except
 * the explicit `toNumber()` escape hatch for charts/percentages.
 *
 * Rounding decisions (documented per #429):
 * - `floor` / `ceil` round toward −∞ / +∞; `half-up` rounds halves away from 0.
 * - Minimum-received (`minOut`) is rounded with `floor`: the protection floor
 *   the user signs must never be *above* what slippage allows, otherwise a
 *   fill exactly at the slippage limit would revert. Flooring keeps the
 *   guarantee the user asked for and never promises more than the quote.
 * - Display values default to `half-up`.
 */

export type RoundingMode = "floor" | "ceil" | "half-up";

export interface Decimal {
  readonly units: bigint;
  readonly decimals: number;
}

export class DecimalError extends Error {
  constructor(
    message: string,
    readonly code: "invalid" | "exponent" | "negative" | "too-many-decimals",
  ) {
    super(message);
    this.name = "DecimalError";
  }
}

/** Stellar amounts carry 7 decimal places (1 XLM = 10^7 stroops). */
export const STELLAR_DECIMALS = 7;

const BI0 = BigInt(0);
const BI1 = BigInt(1);
const BI2 = BigInt(2);
const BI10 = BigInt(10);
const BI100 = BigInt(100);

const pow10 = (n: number): bigint => BI10 ** BigInt(n);

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 77) {
    throw new RangeError(`Invalid decimals: ${decimals}`);
  }
}

/** Integer division of n/d with an explicit rounding mode. */
function divRound(n: bigint, d: bigint, mode: RoundingMode): bigint {
  if (d === BI0) throw new RangeError("Division by zero");
  if (d < BI0) {
    n = -n;
    d = -d;
  }
  const q = n / d; // truncates toward zero
  const r = n % d;
  if (r === BI0) return q;
  const negative = n < BI0;
  switch (mode) {
    case "floor":
      return negative ? q - BI1 : q;
    case "ceil":
      return negative ? q : q + BI1;
    case "half-up": {
      const twice = (r < BI0 ? -r : r) * BI2;
      if (twice >= d) return negative ? q - BI1 : q + BI1;
      return q;
    }
  }
}

export function decimal(units: bigint, decimals: number): Decimal {
  assertDecimals(decimals);
  return Object.freeze({ units, decimals });
}

export const zero = (decimals: number): Decimal => decimal(BI0, decimals);

export interface ParseOptions {
  /** Accept this character as the decimal separator (e.g. "," for es). */
  decimalSeparator?: string;
  /** Allow a leading "-" (off by default: user amounts are never negative). */
  allowNegative?: boolean;
}

/**
 * Parse a user- or API-supplied amount string. Rejects exponent notation,
 * negatives (unless allowed), grouping characters and more fractional
 * digits than `decimals`.
 */
export function parseDecimal(input: string, decimals: number, options: ParseOptions = {}): Decimal {
  assertDecimals(decimals);
  let s = input.trim();
  const sep = options.decimalSeparator ?? ".";
  // A locale separator is normalised to "."; mixing both (e.g. "1.000,5")
  // yields two dots and is rejected below — grouping is never accepted.
  if (sep !== ".") s = s.split(sep).join(".");
  if (/[eE]/.test(s)) throw new DecimalError(`Exponent notation is not allowed: ${input}`, "exponent");
  let negative = false;
  if (s.startsWith("-")) {
    if (!options.allowNegative) throw new DecimalError(`Negative amounts are not allowed: ${input}`, "negative");
    negative = true;
    s = s.slice(1);
  }
  if (!/^(\d+\.?\d*|\.\d+)$/.test(s)) throw new DecimalError(`Invalid amount: ${input}`, "invalid");
  const [whole = "", frac = ""] = s.split(".");
  if (frac.length > decimals) {
    throw new DecimalError(`Too many decimal places (max ${decimals}): ${input}`, "too-many-decimals");
  }
  const units = BigInt((whole || "0") + frac.padEnd(decimals, "0"));
  return decimal(negative ? -units : units, decimals);
}

/** Like `parseDecimal` but returns null instead of throwing. */
export function tryParseDecimal(input: string, decimals: number, options?: ParseOptions): Decimal | null {
  try {
    return parseDecimal(input, decimals, options);
  } catch {
    return null;
  }
}

/**
 * Parse a string with more precision than `decimals`, rounding it into
 * range instead of rejecting it (for API values such as quote amounts).
 */
export function parseRounded(input: string, decimals: number, mode: RoundingMode = "half-up"): Decimal {
  const frac = input.split(".")[1] ?? "";
  const exact = parseDecimal(input, Math.max(decimals, frac.length), { allowNegative: true });
  return rescale(exact, decimals, mode);
}

/**
 * Convert a JS number (e.g. a USD price feed) into a Decimal without going
 * through `Number.toString()`'s exponent notation.
 */
export function fromNumber(value: number, decimals: number, mode: RoundingMode = "half-up"): Decimal {
  if (!Number.isFinite(value)) throw new DecimalError(`Non-finite number: ${value}`, "invalid");
  const s = value.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 20 });
  return parseRounded(s, decimals, mode);
}

/** Canonical string form ("1.5", "0", "-0.0001"). Trailing zeros trimmed by default. */
export function format(d: Decimal, options: { trimZeros?: boolean } = {}): string {
  const trim = options.trimZeros ?? true;
  const negative = d.units < BI0;
  const abs = (negative ? -d.units : d.units).toString().padStart(d.decimals + 1, "0");
  const whole = abs.slice(0, abs.length - d.decimals);
  let frac = abs.slice(abs.length - d.decimals);
  if (trim) frac = frac.replace(/0+$/, "");
  const body = frac ? `${whole}.${frac}` : whole;
  return negative && d.units !== BI0 ? `-${body}` : body;
}

/** Change scale, rounding when reducing precision. */
export function rescale(d: Decimal, decimals: number, mode: RoundingMode = "half-up"): Decimal {
  assertDecimals(decimals);
  if (decimals === d.decimals) return d;
  if (decimals > d.decimals) return decimal(d.units * pow10(decimals - d.decimals), decimals);
  return decimal(divRound(d.units, pow10(d.decimals - decimals), mode), decimals);
}

export const round = rescale;

function align(a: Decimal, b: Decimal): [bigint, bigint, number] {
  const decimals = Math.max(a.decimals, b.decimals);
  return [rescale(a, decimals).units, rescale(b, decimals).units, decimals];
}

export function add(a: Decimal, b: Decimal): Decimal {
  const [x, y, decimals] = align(a, b);
  return decimal(x + y, decimals);
}

export function sub(a: Decimal, b: Decimal): Decimal {
  const [x, y, decimals] = align(a, b);
  return decimal(x - y, decimals);
}

/** Multiply; the result has `decimals` places (default: a's), rounded by `mode`. */
export function mul(a: Decimal, b: Decimal, decimals = a.decimals, mode: RoundingMode = "half-up"): Decimal {
  assertDecimals(decimals);
  const product = a.units * b.units; // scale a.decimals + b.decimals
  const scale = a.decimals + b.decimals;
  return scale >= decimals
    ? decimal(divRound(product, pow10(scale - decimals), mode), decimals)
    : decimal(product * pow10(decimals - scale), decimals);
}

/** Divide; the result has `decimals` places (default: a's), rounded by `mode`. */
export function div(a: Decimal, b: Decimal, decimals = a.decimals, mode: RoundingMode = "half-up"): Decimal {
  assertDecimals(decimals);
  if (b.units === BI0) throw new RangeError("Division by zero");
  // result.units = a.units * 10^(decimals + b.decimals - a.decimals) / b.units
  const shift = decimals + b.decimals - a.decimals;
  const n = shift >= 0 ? a.units * pow10(shift) : a.units;
  const d = shift >= 0 ? b.units : b.units * pow10(-shift);
  return decimal(divRound(n, d, mode), decimals);
}

/** -1, 0 or 1. */
export function compare(a: Decimal, b: Decimal): -1 | 0 | 1 {
  const [x, y] = align(a, b);
  return x < y ? -1 : x > y ? 1 : 0;
}

export const isZero = (d: Decimal): boolean => d.units === BI0;
export const isPositive = (d: Decimal): boolean => d.units > BI0;
export const abs = (d: Decimal): Decimal => (d.units < BI0 ? decimal(-d.units, d.decimals) : d);

/**
 * Minimum amount out after `slippagePct` percent (e.g. "0.5"), floored so
 * the signed protection never exceeds what the slippage setting allows.
 */
export function applySlippage(amount: Decimal, slippagePct: Decimal): Decimal {
  const hundred = decimal(BI100, 0);
  const keep = sub(hundred, slippagePct); // e.g. 99.5
  return div(mul(amount, keep, amount.decimals + keep.decimals, "floor"), hundred, amount.decimals, "floor");
}

/** |a − b| / b as a percentage with `decimals` places (b must be non-zero). */
export function deviationPct(a: Decimal, b: Decimal, decimals = 4): Decimal {
  return div(mul(abs(sub(a, b)), decimal(BI100, 0), Math.max(a.decimals, b.decimals)), b, decimals, "ceil");
}

/**
 * Lossy conversion to a JS number. Only for display scaling, charts and
 * percentages — never feed the result back into money math.
 */
export function toNumber(d: Decimal): number {
  return Number(format(d));
}

/** "12.5" XLM → 125000000 stroops. Rejects more than 7 decimals. */
export function toStroops(amount: string): bigint {
  return parseDecimal(amount, STELLAR_DECIMALS, { allowNegative: true }).units;
}

/** 125000000 stroops → "12.5000000" (Stellar's canonical 7-place form). */
export function fromStroops(stroops: bigint): string {
  return format(decimal(stroops, STELLAR_DECIMALS), { trimZeros: false });
}
