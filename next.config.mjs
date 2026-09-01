/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

// Read the configured API and WebSocket origins so we can whitelist them in
// the CSP connect-src directive.  These values are available here because
// next.config.mjs runs server-side at build/start time and has full access
// to process.env — they are NOT the same as NEXT_PUBLIC_* inlining (which
// happens at compile time inside the browser bundle).
const API_ORIGIN = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"
    ).origin;
  } catch {
    return "http://localhost:4000";
  }
})();

const WS_ORIGIN = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws"
    ).origin;
  } catch {
    return "ws://localhost:4000";
  }
})();

/**
 * Build the Content-Security-Policy header value.
 *
 * Tradeoffs documented:
 *
 * 1. `script-src 'self' 'unsafe-inline'`
 *    Next.js 14 injects small inline scripts for hydration (the
 *    __NEXT_DATA__ JSON block and the hydration bootstrap).  A fully strict
 *    nonce-based CSP requires custom server middleware to generate and thread
 *    the nonce through every render — that is intentionally out of scope for
 *    this baseline hardening pass.  `'unsafe-inline'` is the accepted
 *    short-term tradeoff; a nonce-based policy is the recommended follow-up
 *    (tracked separately).  The XSS risk is mitigated by the absence of
 *    dangerouslySetInnerHTML / eval / dynamic script insertion anywhere in
 *    this codebase (confirmed in the security audit).
 *
 * 2. `connect-src 'self' <API_ORIGIN> <WS_ORIGIN>`
 *    SWR fetches go to API_ORIGIN (REST).  The live intent WebSocket connects
 *    to WS_ORIGIN.  Both must be explicitly allowed.
 *    In dev mode we also allow the Next.js hot-reload WebSocket on
 *    ws://localhost:* so that HMR keeps working.
 *
 * 3. `frame-ancestors 'none'` (and X-Frame-Options: DENY)
 *    Prevents this app from being embedded in a hostile iframe — critical for
 *    a wallet-integrated dApp (clickjacking against Freighter sign flows).
 *
 * 4. Freighter wallet communication happens via window.postMessage between
 *    the page and the browser extension — this is NOT a network request and
 *    requires no special CSP allowance.
 *
 * 5. `img-src 'self' data:`
 *    Next.js Image optimization and inline SVG data URIs both need `data:`.
 */
function buildCsp() {
  const connectSrc = [
    "'self'",
    API_ORIGIN,
    WS_ORIGIN,
    ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'`, // see tradeoff note 1 above
    "style-src 'self' 'unsafe-inline'",  // Tailwind injects inline styles via CSS-in-JS in dev
    `connect-src ${connectSrc}`,
    "img-src 'self' data:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",            // clickjacking protection
    "upgrade-insecure-requests",
  ];

  return directives.join("; ");
}

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: buildCsp(),
  },
  {
    // Belt-and-suspenders: frame-ancestors in CSP is preferred, but
    // X-Frame-Options provides coverage for older browsers that don't
    // fully support CSP frame-ancestors.
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    // Prevents MIME-type sniffing attacks.
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    // Sends full URL to same origin, only origin to HTTPS cross-origin sites,
    // and nothing to HTTP cross-origin sites.
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    // Disallows the use of browser features not needed by this app.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4000/ws",
    NEXT_PUBLIC_NETWORK: process.env.NEXT_PUBLIC_NETWORK ?? "testnet",
    NEXT_PUBLIC_SETTLEMENT_CONTRACT: process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT ?? "",
    NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT: process.env.NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT ?? "",
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes.
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
