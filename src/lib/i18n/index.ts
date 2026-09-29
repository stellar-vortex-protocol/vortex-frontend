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

export function isLocale(value: string): value is Locale {
  return value in CATALOGS;
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
