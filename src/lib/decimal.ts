/**
 * Locale-aware decimal parsing and formatting helpers.
 *
 * This module is intentionally dependency-free (no `decimal.js` import) so it
 * can be used from both client and server code without pulling in extra
 * weight. It works on canonical decimal *strings* and never converts large
 * values to `number`, avoiding float precision loss for big token amounts.
 *
 * Parsing policy (documented for the amount input):
 * - A single separator that is followed by 1-2 digits and is the last
 *   separator in the string is treated as the decimal separator.
 * - A single separator followed by exactly 3 digits is treated as a group
 *   separator (e.g. `1,234` -> `1234`).
 * - When both `.` and `,` are present, the *last* one is the decimal
 *   separator and the other is a group separator (`1,234.56` and
 *   `1.234,56` both parse to `1234.56`).
 * - When the input is ambiguous (e.g. `1,234` could be `1234` or `1.234`),
 *   the caller is expected to confirm with the user; `parseAmount` returns
 *   `ambiguous: true` so the UI can prompt.
 * - Arabic-Indic digits (U+0660-U+0669) and Extended Arabic-Indic digits
 *   (U+06F0-U+06F9) are normalised to ASCII digits.
 * - Non-breaking spaces, narrow no-break spaces and regular spaces are
 *   accepted as group separators.
 */

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/** Normalise locale digits and whitespace to ASCII equivalents. */
export function normalizeDigits(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0) ?? 0;
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (
      code >= EXTENDED_ARABIC_INDIC_ZERO &&
      code <= EXTENDED_ARABIC_INDIC_ZERO + 9
    ) {
      out += String(code - EXTENDED_ARABIC_INDIC_ZERO);
    } else if (ch === "\u00a0" || ch === "\u202f" || ch === "\u2009") {
      out += " ";
    } else {
      out += ch;
    }
  }
  return out;
}

/** Stellar assets use 7 decimal places; amounts are handled as integer stroops. */
export const STELLAR_DECIMALS = 7;
// BigInt() calls rather than literals: the TS target predates ES2020.
export const ZERO = BigInt(0);
const SCALE = BigInt(10) ** BigInt(STELLAR_DECIMALS);
const AMOUNT_RE = new RegExp(`^(\\d+)(?:\\.(\\d{1,${STELLAR_DECIMALS}}))?$`);

export interface ParseAmountResult {
  /** Canonical decimal string (e.g. "1234.56") or null when invalid. */
  value: string | null;
  /** True when the input could be read in more than one way. */
  ambiguous: boolean;
  /** Machine-readable reason when `value` is null. */
  error: "empty" | "invalid" | null;
}

/**
 * Parse a user-typed amount into a canonical decimal string.
 *
 * Never uses `parseFloat`/`Number` on the whole value, so arbitrarily large
 * amounts keep full precision. Returns `ambiguous: true` when the separator
 * meaning cannot be determined without asking the user.
 */
export function parseAmount(raw: string): ParseAmountResult {
  const normalized = normalizeDigits(raw).trim();
  if (normalized === "") {
    return { value: null, ambiguous: false, error: "empty" };
  }

  // Strip a leading sign and remember it.
  let sign = "";
  let body = normalized;
  if (body.startsWith("+") || body.startsWith("-")) {
    sign = body[0] === "-" ? "-" : "";
    body = body.slice(1);
  }

  // Reject anything that is not a digit, separator or space.
  if (!/^[0-9.,\s]+$/.test(body)) {
    return { value: null, ambiguous: false, error: "invalid" };
  }

  const dotCount = (body.match(/\./g) ?? []).length;
  const commaCount = (body.match(/,/g) ?? []).length;

  let decimalSep: "." | "," | null = null;
  let ambiguous = false;

  if (dotCount > 0 && commaCount > 0) {
    // Both present: the last one wins as the decimal separator.
    decimalSep = body.lastIndexOf(".") > body.lastIndexOf(",") ? "." : ",";
  } else if (dotCount === 1 || commaCount === 1) {
    const sep = dotCount === 1 ? "." : ",";
    const idx = body.indexOf(sep);
    const after = body.slice(idx + 1).replace(/\s/g, "");
    if (after.length === 3 && /^[0-9]{3}$/.test(after)) {
      // Looks like a group separator (1,234). Ambiguous with 1.234.
      decimalSep = null;
      ambiguous = true;
    } else {
      decimalSep = sep;
    }
  } else if (dotCount > 1 || commaCount > 1) {
    // Multiple identical separators: all but the last are group separators.
    const sep = dotCount > 1 ? "." : ",";
    const last = body.lastIndexOf(sep);
    const after = body.slice(last + 1).replace(/\s/g, "");
    if (after.length === 3 && /^[0-9]{3}$/.test(after)) {
      decimalSep = null;
      ambiguous = true;
    } else {
      decimalSep = sep;
    }
  }

  // Split into integer and fraction parts.
  let intPart = body;
  let fracPart = "";
  if (decimalSep) {
    const idx = body.lastIndexOf(decimalSep);
    intPart = body.slice(0, idx);
    fracPart = body.slice(idx + 1);
  }

  // Remove group separators and whitespace from the integer part.
  intPart = intPart.replace(/[.,\s]/g, "");
  fracPart = fracPart.replace(/[.,\s]/g, "");

  if (!/^[0-9]*$/.test(intPart) || !/^[0-9]*$/.test(fracPart)) {
    return { value: null, ambiguous: false, error: "invalid" };
  }

  // Normalise leading zeros but keep at least one digit.
  intPart = intPart.replace(/^0+(?=\d)/, "");
  if (intPart === "") intPart = "0";

  // Trim trailing zeros in the fraction, but keep the value meaningful.
  fracPart = fracPart.replace(/0+$/, "");

  const canonical = fracPart ? `${intPart}.${fracPart}` : intPart;
  const isZero = /^0+$/.test(intPart) && fracPart === "";
  const value = isZero ? "0" : `${sign}${canonical}`;

  return { value, ambiguous, error: null };
}

/**
 * Parse a user-entered decimal string into stroops; null when malformed or too precise.
 */
export function parseAmountToStroops(input: string): bigint | null {
  const match = AMOUNT_RE.exec(input.trim());
  if (!match) return null;
  const [, whole, fraction = ""] = match;
  return BigInt(whole ?? "0") * SCALE + BigInt(fraction.padEnd(STELLAR_DECIMALS, "0"));
}

/**
 * Format a canonical decimal string with locale-aware grouping and decimal
 * separator, without converting to `number` (safe for big values).
 */
export function formatDecimalString(
  value: string,
  locale: string,
  options?: { maximumFractionDigits?: number },
): string {
  const negative = value.startsWith("-");
  const body = negative ? value.slice(1) : value;
  const [intRaw = "0", fracRaw = ""] = body.split(".");
  const maxFrac = options?.maximumFractionDigits;
  const frac =
    typeof maxFrac === "number" ? fracRaw.slice(0, maxFrac) : fracRaw;

  const groupSep = getGroupSeparator(locale);
  const decimalSep = getDecimalSeparator(locale);

  const grouped = intRaw.replace(/\B(?=(\d{3})+(?!\d))/g, groupSep);
  const out = frac ? `${grouped}${decimalSep}${frac}` : grouped;
  return negative ? `-${out}` : out;
}

/** Formats stroops as a decimal string without trailing zeros. */
export function formatAmount(stroops: bigint): string {
  const negative = stroops < ZERO;
  const abs = negative ? -stroops : stroops;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(STELLAR_DECIMALS, "0").replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function getDecimalSeparator(locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1.1);
    return parts.find((p) => p.type === "decimal")?.value ?? ".";
  } catch {
    return ".";
  }
}

function getGroupSeparator(locale: string): string {
  try {
    const parts = new Intl.NumberFormat(locale).formatToParts(1000);
    return parts.find((p) => p.type === "group")?.value ?? ",";
  } catch {
    return ",";
  }
}
}
