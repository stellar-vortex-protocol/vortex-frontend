import { cookies, headers } from "next/headers";
import {
  createTranslator,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  negotiateLocale,
  type Locale,
  type Translator,
} from "./index";

/**
 * Resolve the locale for the current request during SSR.
 *
 * Resolution order (mirrors the middleware):
 *   1. explicit `?lang=` query parameter
 *   2. `vortex-locale` cookie (persisted user preference)
 *   3. `Accept-Language` negotiation
 *   4. DEFAULT_LOCALE
 *
 * The middleware also forwards the resolved locale via the `x-vortex-locale`
 * request header so layouts can read it without re-negotiating; when that
 * header is present it wins because it already accounts for URL prefixes.
 */
export function resolveLocale(): Locale {
  const headerStore = headers();
  const fromMiddleware = headerStore.get(LOCALE_HEADER);
  if (fromMiddleware) {
    return negotiateLocale(fromMiddleware);
  }

  const cookieStore = cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (fromCookie) {
    return negotiateLocale(fromCookie);
  }

  const acceptLanguage = headerStore.get("accept-language");
  if (acceptLanguage) {
    return negotiateLocale(acceptLanguage);
  }

  return DEFAULT_LOCALE;
}

/**
 * Translator for server components, which cannot read the I18nProvider context
 * that `useTranslation` relies on. The locale is resolved from the request so
 * server-rendered markup matches the client locale (no flash of English).
 *
 * An explicit locale may be passed by callers that already know it (e.g. a
 * `[locale]` route segment); otherwise the request is negotiated.
 */
export function getTranslation(locale?: Locale): {
  t: Translator;
  locale: Locale;
} {
  const resolved: Locale = locale ?? resolveLocale();
  return { t: createTranslator(resolved), locale: resolved };
}
