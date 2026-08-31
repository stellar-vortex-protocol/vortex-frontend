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

export function isLocale(value: string): value is Locale {
  return value in CATALOGS;
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
