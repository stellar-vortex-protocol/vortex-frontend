import { NextRequest, NextResponse } from 'next/server';

/**
 * Locale routing & SSR-aware i18n middleware (issue #494).
 *
 * Routing strategy: cookie-based locale resolution WITHOUT a URL path prefix.
 * Rationale: the existing App Router tree (src/app/**) is not segmented by
 * `[locale]`, and introducing a prefix would require restructuring every route
 * plus rewriting all internal links. A cookie + `Accept-Language` negotiation
 * keeps the current route structure intact while still resolving the locale
 * during SSR (the resolved locale is forwarded to the app via the
 * `x-vortex-locale` request header, read with `headers()` in `layout.tsx`).
 *
 * Resolution order (highest priority first):
 *   1. explicit URL prefix (`/es/...`) or `?lang=` query param
 *   2. `vortex-locale` cookie
 *   3. `Accept-Language` negotiation
 *   4. default locale
 *
 * This middleware also coordinates with the CSP middleware by preserving the
 * existing `Content-Security-Policy` response header when present, and sets
 * `Vary: Accept-Language, Cookie` so caches key on the negotiated inputs.
 */

export const SUPPORTED_LOCALES = ['en', 'es'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'vortex-locale';
export const LOCALE_HEADER = 'x-vortex-locale';

const LOCALE_PREFIX_RE = /^\/([a-z]{2})(?:-[A-Za-z]{2,4})?(?=\/|$)/;

function isSupported(value: string | null | undefined): value is Locale {
  if (!value) return false;
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Normalise a raw locale tag to a supported base locale.
 * e.g. `es-MX` -> `es`, `EN-us` -> `en`, `fr` -> null.
 */
export function normalizeLocale(raw: string | null | undefined): Locale | null {
  if (!raw) return null;
  const base = raw.trim().toLowerCase().split('-')[0];
  return isSupported(base) ? base : null;
}

/**
 * Pure Accept-Language negotiation (RFC 9110 §12.5.4).
 * Returns the best supported locale or null when nothing matches.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
  supported: readonly string[] = SUPPORTED_LOCALES,
  fallback: Locale = DEFAULT_LOCALE,
): Locale {
  if (!acceptLanguage) return fallback;

  const parsed = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      const q = qParam ? Number.parseFloat(qParam.split('=')[1]) : 1;
      return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
    })
    .filter((entry) => entry.tag.length > 0 && entry.q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parsed) {
    const base = tag.split('-')[0];
    if ((supported as readonly string[]).includes(base)) {
      return base as Locale;
    }
  }

  return fallback;
}

/**
 * Resolve the locale for a request following the documented priority order.
 * Also returns the pathname with any locale prefix stripped so downstream
 * routing is unaffected by the prefix form.
 */
export function resolveLocale(request: NextRequest): {
  locale: Locale;
  pathname: string;
  fromPrefix: boolean;
} {
  const { pathname, searchParams } = request.nextUrl;

  const prefixMatch = pathname.match(LOCALE_PREFIX_RE);
  if (prefixMatch) {
    const candidate = normalizeLocale(prefixMatch[1]);
    if (candidate) {
      const stripped = pathname.slice(prefixMatch[0].length) || '/';
      return { locale: candidate, pathname: stripped, fromPrefix: true };
    }
  }

  const queryLocale = normalizeLocale(searchParams.get('lang'));
  if (queryLocale) {
    return { locale: queryLocale, pathname, fromPrefix: false };
  }

  const cookieLocale = normalizeLocale(request.cookies.get(LOCALE_COOKIE)?.value);
  if (cookieLocale) {
    return { locale: cookieLocale, pathname, fromPrefix: false };
  }

  const negotiated = negotiateLocale(request.headers.get('accept-language'));
  return { locale: negotiated, pathname, fromPrefix: false };
}

export function middleware(request: NextRequest) {
  const { locale, pathname, fromPrefix } = resolveLocale(request);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);

  const url = request.nextUrl.clone();
  url.pathname = pathname;

  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });

  // Persist the resolved preference so subsequent requests skip negotiation.
  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (existing !== locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'lax',
    });
  }

  // Cache keys must vary on the negotiated inputs.
  response.headers.set('Vary', 'Accept-Language, Cookie');

  // Coordinate with CSP middleware: preserve an existing policy if set.
  const csp = request.headers.get('content-security-policy');
  if (csp) {
    response.headers.set('Content-Security-Policy', csp);
  }

  // Expose the resolved locale for debugging/SEO tooling.
  response.headers.set(LOCALE_HEADER, locale);

  if (fromPrefix) {
    response.headers.set('x-vortex-locale-prefix', '1');
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|webp|ico|css|js|map|txt|xml)$).*)'],
};
