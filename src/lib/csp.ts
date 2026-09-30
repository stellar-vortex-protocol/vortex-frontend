/**
 * Shared Content-Security-Policy builder.
 *
 * This module is the single source of truth for the CSP policy.  It is used
 * by both `middleware.ts` (per-request nonce-based policy) and
 * `next.config.mjs` (static fallback header for routes that bypass the
 * middleware, e.g. static assets).
 *
 * The builder is a pure function so it can be unit-tested across
 * dev / prod / preview environments without spinning up a server.
 */

export type CspEnv = "development" | "production" | "preview";

export interface CspOptions {
  /**
   * Per-request nonce.  When provided, `script-src` uses
   * `'self' 'nonce-<nonce>' 'strict-dynamic'` and drops `'unsafe-inline'`.
   * When omitted (e.g. static header fallback) the policy falls back to
   * `'self' 'unsafe-inline'` so that Next.js hydration scripts still run.
   */
  nonce?: string;
  /** REST API origin allowed in connect-src. */
  apiOrigin?: string;
  /** WebSocket origin allowed in connect-src. */
  wsOrigin?: string;
  /**
   * When true, emit `Content-Security-Policy-Report-Only` semantics by
   * appending a `report-uri` directive.  The caller decides which header
   * name to use; this only controls the directive list.
   */
  reportUri?: string;
}

const DEFAULT_API_ORIGIN = "http://localhost:4000";
const DEFAULT_WS_ORIGIN = "ws://localhost:4000";

function safeOrigin(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  try {
    return new URL(value).origin;
  } catch {
    return fallback;
  }
}

/**
 * Build the CSP header value.
 *
 * Tradeoffs documented:
 *
 * 1. `script-src`
 *    When a nonce is supplied we use
 *    `'self' 'nonce-<nonce>' 'strict-dynamic'` and drop `'unsafe-inline'`.
 *    `'strict-dynamic'` lets the nonce-bearing bootstrap script load the
 *    rest of Next.js's chunks without needing to enumerate every URL.
 *    Without a nonce (static fallback) we keep `'unsafe-inline'` so that
 *    hydration still works on routes that bypass the middleware.
 *
 * 2. `style-src 'self' 'unsafe-inline'`
 *    Tailwind and Next.js inject inline styles at runtime (CSS-in-JS in
 *    dev, critical CSS in prod).  A nonce-based style policy is not yet
 *    feasible without a custom style loader, so `'unsafe-inline'` is kept
 *    for styles only.  This is a much smaller attack surface than inline
 *    scripts because CSS cannot execute arbitrary JS.
 *
 * 3. `connect-src 'self' <API_ORIGIN> <WS_ORIGIN>`
 *    SWR fetches go to API_ORIGIN (REST).  The live intent WebSocket
 *    connects to WS_ORIGIN.  In dev we also allow localhost WebSockets so
 *    HMR keeps working.
 *
 * 4. `frame-ancestors 'none'` (and X-Frame-Options: DENY)
 *    Prevents this app from being embedded in a hostile iframe — critical
 *    for a wallet-integrated dApp (clickjacking against Freighter sign
 *    flows).
 *
 * 5. Freighter wallet communication happens via window.postMessage between
 *    the page and the browser extension — this is NOT a network request and
 *    requires no special CSP allowance.
 *
 * 6. `img-src 'self' data:`
 *    Next.js Image optimization and inline SVG data URIs both need `data:`.
 */
export function buildCsp(env: CspEnv, options: CspOptions = {}): string {
  const isDev = env === "development";
  const apiOrigin = safeOrigin(options.apiOrigin, DEFAULT_API_ORIGIN);
  const wsOrigin = safeOrigin(options.wsOrigin, DEFAULT_WS_ORIGIN);

  const connectSrc = [
    "'self'",
    apiOrigin,
    wsOrigin,
    ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  ].join(" ");

  const scriptSrc = options.nonce
    ? `'self' 'nonce-${options.nonce}' 'strict-dynamic'`
    : "'self' 'unsafe-inline'";

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // see tradeoff note 2 above
    `connect-src ${connectSrc}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'", // clickjacking protection
    "upgrade-insecure-requests",
  ];

  if (options.reportUri) {
    directives.push(`report-uri ${options.reportUri}`);
  }

  return directives.join("; ");
}

/**
 * Generate a cryptographically random nonce suitable for CSP.
 *
 * Uses the Web Crypto API which is available in both the Node.js runtime
 * and the Vercel Edge runtime (where middleware executes).
 */
export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
