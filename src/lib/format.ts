const DEFAULT_LOCALE = "en-US";

function resolveLocale(locale?: string): string {
  if (locale) return locale;

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return DEFAULT_LOCALE;
}

// Cache of Intl instances keyed by locale + serialized options. No global
// mutable state beyond this memoisation map; instances are immutable.
const numberFormatCache = new Map<string, Intl.NumberFormat>();
const dateFormatCache = new Map<string, Intl.DateTimeFormat>();
const relativeFormatCache = new Map<string, Intl.RelativeTimeFormat>();

function cacheKey(locale: string, options: Intl.NumberFormatOptions | Intl.DateTimeFormatOptions): string {
  return `${locale}|${JSON.stringify(options)}`;
}

function getNumberFormat(
  locale: string,
  options: Intl.NumberFormatOptions,
): Intl.NumberFormat {
  const key = cacheKey(locale, options);
  let formatter = numberFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, options);
    numberFormatCache.set(key, formatter);
  }
  return formatter;
}

function getDateFormat(
  locale: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = cacheKey(locale, options);
  let formatter = dateFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    dateFormatCache.set(key, formatter);
  }
  return formatter;
}

function getRelativeFormat(
  locale: string,
  options: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat | null {
  if (typeof Intl === "undefined" || typeof Intl.RelativeTimeFormat !== "function") {
    return null;
  }
  const key = cacheKey(locale, options);
  let formatter = relativeFormatCache.get(key);
  if (!formatter) {
    formatter = new Intl.RelativeTimeFormat(locale, options);
    relativeFormatCache.set(key, formatter);
  }
  return formatter;
}

/**
 * Format a numeric value as a locale-aware decimal string.
 *
 * When `value` is a decimal string (e.g. a big integer or high-precision
 * token amount) it is formatted from the string without converting to a
 * float, preserving precision for very large/small values.
 */
export function formatNumber(
  value: number | string,
  locale?: string,
  options: Intl.NumberFormatOptions = {},
): string {
  const resolved = resolveLocale(locale);
  try {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "") return "";
      // Preserve precision for decimal strings by formatting the integer and
      // fractional parts separately rather than parsing to a float.
      const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
      if (match) {
        const [, sign, intPart, fracPart] = match;
        const intFormatted = getNumberFormat(resolved, {
          ...options,
          maximumFractionDigits: 0,
          minimumFractionDigits: 0,
        }).format(BigInt(intPart));
        if (!fracPart) {
          return sign === "-" ? `-${intFormatted}` : intFormatted;
        }
        const decimalSeparator = getNumberFormat(resolved, {}).formatToParts(1.1).find(
          (part) => part.type === "decimal",
        )?.value ?? ".";
        const grouped = sign === "-" ? `-${intFormatted}` : intFormatted;
        return `${grouped}${decimalSeparator}${fracPart}`;
      }
    }
    return getNumberFormat(resolved, options).format(value as number);
  } catch {
    return String(value);
  }
}

/**
 * Format a value using compact notation (e.g. 1.2K, 3.4M).
 */
export function formatCompact(
  value: number | string,
  locale?: string,
  options: Intl.NumberFormatOptions = {},
): string {
  const resolved = resolveLocale(locale);
  try {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return String(value);
    return getNumberFormat(resolved, {
      notation: "compact",
      compactDisplay: "short",
      ...options,
    }).format(numeric);
  } catch {
    return String(value);
  }
}

/**
 * Format a value as USD currency for the active locale.
 */
export function formatUsd(
  value: number | string,
  locale?: string,
  options: Intl.NumberFormatOptions = {},
): string {
  const resolved = resolveLocale(locale);
  try {
    const numeric = typeof value === "string" ? Number(value) : value;
    if (!Number.isFinite(numeric)) return String(value);
    return getNumberFormat(resolved, {
      style: "currency",
      currency: "USD",
      ...options,
    }).format(numeric);
  } catch {
    return String(value);
  }
}

/**
 * Format a token amount given its decimals, from a decimal string when
 * provided so large values are not lossy through float conversion.
 */
export function formatTokenAmount(
  amount: number | string,
  decimals: number,
  locale?: string,
  options: Intl.NumberFormatOptions = {},
): string {
  const resolved = resolveLocale(locale);
  try {
    if (typeof amount === "string") {
      const trimmed = amount.trim();
      if (trimmed === "") return "";
      const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(trimmed);
      if (match) {
        const [, sign, intPart, fracPart = ""] = match;
        const padded = fracPart.padEnd(decimals, "0").slice(0, decimals);
        const canonical = `${sign}${intPart}${padded ? `.${padded}` : ""}`;
        return formatNumber(canonical, resolved, {
          maximumFractionDigits: decimals,
          minimumFractionDigits: 0,
          ...options,
        });
      }
    }
    return getNumberFormat(resolved, {
      maximumFractionDigits: decimals,
      minimumFractionDigits: 0,
      ...options,
    }).format(amount as number);
  } catch {
    return String(amount);
  }
}

/**
 * Format a date/time for the active locale. Accepts Date, epoch ms or an
 * ISO string. Falls back to the raw input when the value is invalid.
 */
export function formatDate(
  value: Date | number | string,
  locale?: string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const resolved = resolveLocale(locale);
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return getDateFormat(resolved, {
      dateStyle: "medium",
      timeStyle: "short",
      ...options,
    }).format(date);
  } catch {
    return String(value);
  }
}

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 1000 * 60 * 60 * 24 * 365],
  ["month", 1000 * 60 * 60 * 24 * 30],
  ["week", 1000 * 60 * 60 * 24 * 7],
  ["day", 1000 * 60 * 60 * 24],
  ["hour", 1000 * 60 * 60],
  ["minute", 1000 * 60],
  ["second", 1000],
];

/**
 * Format a timestamp relative to now (e.g. "3 minutes ago"). Falls back to
 * an absolute date string when Intl.RelativeTimeFormat is unavailable.
 */
export function formatRelative(
  value: Date | number | string,
  locale?: string,
  options: Intl.RelativeTimeFormatOptions = { numeric: "auto" },
): string {
  const resolved = resolveLocale(locale);
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    const diffMs = date.getTime() - Date.now();
    const formatter = getRelativeFormat(resolved, options);
    if (!formatter) {
      return formatDate(date, resolved);
    }
    for (const [unit, ms] of RELATIVE_UNITS) {
      if (Math.abs(diffMs) >= ms || unit === "second") {
        return formatter.format(Math.round(diffMs / ms), unit);
      }
    }
    return formatter.format(0, "second");
  } catch {
    return String(value);
  }
}

/**
 * @deprecated Use `formatUsd` instead. Kept for backwards compatibility.
 */
export function formatCurrency(
  value: number,
  locale?: string,
  options: Intl.NumberFormatOptions = {},
) {
  return formatUsd(value, locale, options);
}

export interface Formatters {
  formatNumber: (value: number | string, options?: Intl.NumberFormatOptions) => string;
  formatCompact: (value: number | string, options?: Intl.NumberFormatOptions) => string;
  formatUsd: (value: number | string, options?: Intl.NumberFormatOptions) => string;
  formatTokenAmount: (
    amount: number | string,
    decimals: number,
    options?: Intl.NumberFormatOptions,
  ) => string;
  formatDate: (value: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
  formatRelative: (
    value: Date | number | string,
    options?: Intl.RelativeTimeFormatOptions,
  ) => string;
}

/**
 * Server-side equivalent of `useFormatters`. Returns locale-bound formatter
 * functions that share the memoised Intl instances.
 */
export function createFormatters(locale?: string): Formatters {
  const resolved = resolveLocale(locale);
  return {
    formatNumber: (value, options) => formatNumber(value, resolved, options),
    formatCompact: (value, options) => formatCompact(value, resolved, options),
    formatUsd: (value, options) => formatUsd(value, resolved, options),
    formatTokenAmount: (amount, decimals, options) =>
      formatTokenAmount(amount, decimals, resolved, options),
    formatDate: (value, options) => formatDate(value, resolved, options),
    formatRelative: (value, options) => formatRelative(value, resolved, options),
  };
}
