import {
  createTranslator,
  DEFAULT_LOCALE,
  type Locale,
  type Translator,
} from "./index";

/**
 * Translator for server components, which cannot read the I18nProvider context
 * that `useTranslation` relies on. Request-based locale negotiation belongs to
 * the i18n infrastructure work; until it lands every server render uses
 * DEFAULT_LOCALE, and this is the single place that has to change.
 */
export function getTranslation(): { t: Translator; locale: Locale } {
  const locale: Locale = DEFAULT_LOCALE;
  return { t: createTranslator(locale), locale };
}
