const DEFAULT_LOCALE = "en-US";

// BCP-47 tag used for Intl.NumberFormat per app locale. "es-419" (Latin American
// Spanish) is used rather than "es-ES" since the app has no region targeting.
const BCP47_BY_APP_LOCALE: Record<string, string> = {
  en: "en-US",
  es: "es-419",
};

export function toBCP47(appLocale: string): string {
  return BCP47_BY_APP_LOCALE[appLocale] ?? DEFAULT_LOCALE;
}

function resolveLocale(locale?: string): string {
  if (locale) return locale;

  if (typeof navigator !== "undefined" && navigator.language) {
    return navigator.language;
  }

  return DEFAULT_LOCALE;
}

export function formatCurrency(value: number, locale?: string, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(resolveLocale(locale), {
    style: "currency",
    currency: "USD",
    ...options,
  }).format(value);
}

export function formatTokenAmount(value: number, locale?: string, options: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat(resolveLocale(locale), options).format(value);
}
