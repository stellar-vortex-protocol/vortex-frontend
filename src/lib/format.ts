const DEFAULT_LOCALE = "en-US";

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
