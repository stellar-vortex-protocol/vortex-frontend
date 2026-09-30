import { en } from "./messages/en";
import { es } from "./messages/es";

export const DEFAULT_LOCALE = "en";

/**
 * Pseudo-locale used in development to reveal untranslated strings and layout
 * overflow. It is generated from the `en` catalog at runtime: every letter is
 * accented and the string is padded with brackets and ~40% expansion.
 */
export const PSEUDO_LOCALE = "en-XA";

const ACCENTS: Record<string, string> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í",
  j: "ĵ", k: "ķ", l: "ĺ", m: "ɱ", n: "ñ", o: "ó", p: "þ", q: "ǫ", r: "ŕ",
  s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í",
  J: "Ĵ", K: "Ķ", L: "Ĺ", M: "Ṁ", N: "Ñ", O: "Ó", P: "Þ", Q: "Ǫ", R: "Ŕ",
  S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

/** Accents letters and pads with brackets + ~40% expansion, preserving {tokens}. */
export function pseudoLocalize(template: string): string {
  const accented = template.replace(/[A-Za-z]/g, (ch) => ACCENTS[ch] ?? ch);
  const padding = "·".repeat(Math.ceil(accented.length * 0.4));
  return `⟦${accented}${padding}⟧`;
}

const PSEUDO_CATALOG = Object.fromEntries(
  Object.entries(en).map(([key, value]) => [key, pseudoLocalize(value)]),
) as Record<keyof typeof en, string>;

export const CATALOGS = { en, es, [PSEUDO_LOCALE]: PSEUDO_CATALOG };

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

/**
 * Minimal ICU MessageFormat subset: `{name}` placeholders, `{name, number}`
 * number formatting, and `{name, plural, one {…} other {…}}` / `{name, select, …}`
 * branches. Plural categories are resolved with `Intl.PluralRules(locale)`.
 * The parser never throws: on malformed input it returns the original template.
 */

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

function findMatchingBrace(input: string, start: number): number {
  let depth = 0;
  for (let i = start; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function parseBranches(body: string): Record<string, string> {
  const branches: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    while (i < body.length && /\s/.test(body[i])) i += 1;
    const keyStart = i;
    while (i < body.length && body[i] !== "{" && !/\s/.test(body[i])) i += 1;
    const key = body.slice(keyStart, i).trim();
    while (i < body.length && /\s/.test(body[i])) i += 1;
    if (body[i] !== "{") break;
    const end = findMatchingBrace(body, i);
    if (end === -1) break;
    branches[key] = body.slice(i + 1, end);
    i = end + 1;
  }
  return branches;
}

function formatNumber(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

function resolvePluralCategory(locale: string, value: number): string {
  try {
    return new Intl.PluralRules(locale).select(value);
  } catch {
    return value === 1 ? "one" : "other";
  }
}

function formatMessage(
  template: string,
  values: MessageValues,
  locale: string,
): string {
  let result = "";
  let i = 0;
  while (i < template.length) {
    const ch = template[i];
    if (ch === "{") {
      const end = findMatchingBrace(template, i);
      if (end === -1) {
        result += template.slice(i);
        break;
      }
      const inner = template.slice(i + 1, end);
      const parts = splitTopLevel(inner);
      const name = parts[0].trim();
      const type = parts[1]?.trim();
      if (parts.length === 1) {
        result += name in values ? String(values[name]) : `{${inner}}`;
      } else if (type === "number") {
        const value = values[name];
        result +=
          typeof value === "number"
            ? formatNumber(value, locale)
            : `{${inner}}`;
      } else if (type === "plural" || type === "selectordinal") {
        const value = values[name];
        const branches = parseBranches(parts.slice(2).join(","));
        let category: string;
        if (type === "selectordinal" && typeof value === "number") {
          try {
            category = new Intl.PluralRules(locale, { type: "ordinal" }).select(value);
          } catch {
            category = "other";
          }
        } else {
          category = resolvePluralCategory(locale, Number(value));
        }
        const branch =
          branches[category] ?? branches.other ?? branches.one ?? "";
        result += formatMessage(branch, values, locale);
      } else if (type === "select") {
        const value = String(values[name] ?? "");
        const branches = parseBranches(parts.slice(2).join(","));
        const branch = branches[value] ?? branches.other ?? "";
        result += formatMessage(branch, values, locale);
      } else {
        result += `{${inner}}`;
      }
      i = end + 1;
    } else {
      result += ch;
      i += 1;
    }
  }
  return result;
}

/** Replaces every {token} in `template` with the matching value. Unknown tokens are left as-is. */
export function interpolate(
  template: string,
  values?: MessageValues,
  locale: string = DEFAULT_LOCALE,
): string {
  if (!values) return template;
  try {
    return formatMessage(template, values, locale);
  } catch {
    return template;
  }
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
  return interpolate(template, values, locale);
}

export function createTranslator(locale: Locale): Translator {
  return (key, values) => translate(locale, key, values);
}
