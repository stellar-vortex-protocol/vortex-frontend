import { en } from "./messages/en";
import { es } from "./messages/es";

export const DEFAULT_LOCALE = "en";

export const CATALOGS = { en, es };

export type Locale = keyof typeof CATALOGS;
export type MessageKey = keyof typeof en;
export type Catalog = Record<MessageKey, string>;
export type MessageValues = Record<string, string | number>;
export type Translator = (key: MessageKey, values?: MessageValues) => string;

export const LOCALES = Object.keys(CATALOGS) as Locale[];

/** Name of the cookie that persists the user's locale preference. */
export const LOCALE_COOKIE = "vortex-locale";

/** Request header set by middleware carrying the resolved locale into SSR. */
export const LOCALE_HEADER = "x-vortex-locale";

/** Text direction for each supported locale. */
export const LOCALE_DIRECTIONS: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  es: "ltr",
};

/** Locales written right-to-left. Used to set `dir` on <html> and to mirror UI. */
export const RTL_LOCALES: readonly Locale[] = LOCALES.filter(
  (locale) => LOCALE_DIRECTIONS[locale] === "rtl",
);

export function isRtlLocale(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}

/** Returns the writing direction for a locale, for use on <html dir="...">. */
export function getDirection(locale: Locale): "ltr" | "rtl" {
  return LOCALE_DIRECTIONS[locale] ?? (isRtlLocale(locale) ? "rtl" : "ltr");
}

export function isLocale(value: string): value is Locale {
  return value in CATALOGS;
}

/**
 * Normalises a raw locale tag (e.g. "es-MX", "EN_us") to a supported locale.
 * Falls back to the primary subtag, then to `null` when unsupported.
 */
export function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isLocale(trimmed)) return trimmed;
  const primary = trimmed.split(/[-_]/)[0].toLowerCase();
  return isLocale(primary) ? primary : null;
}

/**
 * Parses an RFC 9110 `Accept-Language` header and returns the best supported
 * locale, or `null` when none of the advertised languages are supported.
 * Entries are ranked by quality value (default 1), ties broken by order.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  supported: Locale[] = LOCALES,
): Locale | null {
  if (!acceptLanguage) return null;
  const supportedSet = new Set<string>(supported);
  const entries = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      let quality = 1;
      for (const param of params) {
        const [name, rawValue] = param.trim().split("=");
        if (name.toLowerCase() === "q") {
          const parsed = Number.parseFloat(rawValue);
          quality = Number.isNaN(parsed) ? 0 : parsed;
        }
      }
      return { tag: tag.trim(), quality, index };
    })
    .filter((entry) => entry.tag && entry.tag !== "*" && entry.quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index);

  for (const entry of entries) {
    const normalized = normalizeLocale(entry.tag);
    if (normalized && supportedSet.has(normalized)) return normalized;
  }
  return null;
}

/**
 * Resolves the active locale using the documented precedence:
 * explicit URL prefix / `?lang=` → cookie → `Accept-Language` → default.
 */
export function resolveLocale(input: {
  pathname?: string | null;
  search?: string | null;
  cookie?: string | null;
  acceptLanguage?: string | null;
}): Locale {
  const { pathname, search, cookie, acceptLanguage } = input;

  if (pathname) {
    const segment = pathname.split("/").filter(Boolean)[0];
    const fromPath = normalizeLocale(segment);
    if (fromPath) return fromPath;
  }

  if (search) {
    const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
    const fromQuery = normalizeLocale(params.get("lang"));
    if (fromQuery) return fromQuery;
  }

  const fromCookie = normalizeLocale(cookie);
  if (fromCookie) return fromCookie;

  const fromHeader = negotiateLocale(acceptLanguage);
  if (fromHeader) return fromHeader;

  return DEFAULT_LOCALE;
}

export function getCatalog(locale: Locale): Catalog {
  return CATALOGS[locale] ?? CATALOGS[DEFAULT_LOCALE];
}

/** Replaces every {token} in `template` with the matching value. Unknown tokens are left as-is. */
export function interpolate(template: string, values?: MessageValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (token, name: string) =>
    name in values ? String(values[name]) : token,
  );
}

/**
 * Looks a key up in `locale`, falling back to the default locale and then to the
 * key itself so a missing translation degrades instead of rendering "undefined".
 */
export function translate(
  locale: Locale,
  key: MessageKey,
  values?: MessageValues,
): string {
  const template = getCatalog(locale)[key] ?? getCatalog(DEFAULT_LOCALE)[key];
  if (template === undefined) return key;
  return interpolate(template, values);
}

export function createTranslator(locale: Locale): Translator {
  return (key, values) => translate(locale, key, values);
}
