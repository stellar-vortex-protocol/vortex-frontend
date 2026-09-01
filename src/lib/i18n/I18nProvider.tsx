"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { createTranslator, DEFAULT_LOCALE, type Locale, type Translator } from ".";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
};

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  setLocale: () => {},
});

export function I18nProvider({
  locale: initialLocale = DEFAULT_LOCALE,
  children,
}: {
  locale?: Locale;
  children?: React.ReactNode;
}) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  const { locale } = useContext(LocaleContext);
  return locale;
}

export function useSetLocale(): (locale: Locale) => void {
  const { setLocale } = useContext(LocaleContext);
  return setLocale;
}

/**
 * Returns the translator for the active locale. Components render in
 * DEFAULT_LOCALE when no I18nProvider is mounted above them.
 */
export function useTranslation(): { t: Translator; locale: Locale } {
  const locale = useLocale();
  const t = useMemo(() => createTranslator(locale), [locale]);
  return { t, locale };
}
