import type { Locale } from "@/lib/i18n";

const DEFAULT_LOCALE = "en-US";

/**
 * Maps the app's Locale type to a BCP-47 tag suitable for Intl APIs.
 * We use "es-419" (Latin-American Spanish) as the representative Spanish tag
 * because it is the most widely supported compact-notation locale in both
 * Node.js (via ICU) and modern browsers. "es-ES" would work identically for
 * number formatting but "es-419" is the safer choice for cross-runtime compat.
 */
export function localeToBcp47(locale?: Locale | string): string {
  if (!locale) return DEFAULT_LOCALE;
  if (locale === "es") return "es-419";
  if (locale === "en") return "en-US";
  // Pass-through fully-qualified BCP-47 tags (e.g. "de-DE" from existing tests)
  return locale;
}

function resolveLocale(locale?: string): string {
  if (locale) return locale;

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return DEFAULT_LOCALE;
}

export function formatCurrency(
  value: number,
  locale?: string,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: "USD",
    ...options,
  }).format(value);
}

export function formatTokenAmount(
  value: number,
  locale?: string,
  options: Intl.NumberFormatOptions = {},
) {
  return new Intl.NumberFormat(resolveLocale(locale), options).format(value);
}

/**
 * Compact USD formatter — e.g. $4.2M, $1.5k.
 * Uses the given BCP-47 locale tag so the number separators and currency
 * symbol placement follow the active locale's conventions.
 */
export function formatUsdCompact(value: number, locale?: string): string {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
