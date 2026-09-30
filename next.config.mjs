import bundleAnalyzer from "@next/bundle-analyzer";
import { parseEnv } from "./src/lib/env-schema.mjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  outputDir: ".next-analyze",
});

/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV === "development";

// Read the configured API and WebSocket origins so we can whitelist them in
// the CSP connect-src directive.  These values are available here because
// next.config.mjs runs server-side at build/start time and has full access
// to process.env — they are NOT the same as NEXT_PUBLIC_* inlining (which
// happens at compile time inside the browser bundle).  Defaults and
// validation come from the same schema as src/lib/config.ts.
const { values: env, errors: envErrors } = parseEnv(process.env, {
  production: process.env.NODE_ENV === "production",
});
if (envErrors.length > 0) {
  throw new Error(`Invalid environment configuration:\n  - ${envErrors.join("\n  - ")}`);
}

const API_ORIGIN = new URL(env.apiUrl).origin;
// No WebSocket URL configured means live updates are off; nothing to allow.
const WS_ORIGIN = env.wsUrl ? new URL(env.wsUrl).origin : null;

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
 *    Deliberately NOT widened for GitHub avatars (#479): /contributors renders
 *    them through next/image, whose optimizer fetches from
 *    avatars.githubusercontent.com server-side (see `images.remotePatterns`)
 *    and serves the result from /_next/image — i.e. 'self'.  Likewise
 *    `connect-src` is not widened for api.github.com: the browser calls the
 *    same-origin /api/contributors route, which talks to GitHub server-side.
 *
 * 6. `worker-src 'self'`
 *    The PWA service worker (public/sw.js) is served from the app origin and
 *    must be explicitly allowed to register.  Without this directive the
 *    browser falls back to script-src, which is fine today but would break if
 *    script-src is ever tightened to a nonce-based policy.  Declaring it
 *    explicitly keeps SW registration working under a stricter CSP.

 */
function buildCsp() {
  const connectSrc = [
    "'self'",
    API_ORIGIN,
    ...(WS_ORIGIN ? [WS_ORIGIN] : []),
    ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'`, // see tradeoff note 1 above
    "style-src 'self' 'unsafe-inline'",  // Tailwind injects inline styles via CSS-in-JS in dev
    `connect-src ${connectSrc}`,
    "worker-src 'self' blob:",          // intent export worker (src/lib/export)
    "img-src 'self' data:",
    "font-src 'self'",
    "worker-src 'self'",                 // PWA service worker registration (see note 6)
    "manifest-src 'self'",               // PWA web app manifest
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
  images: {
    // Locked-down allowlist: only GitHub avatars, only over HTTPS, only the
    // /<login> path shape produced by avatarUrlFor() in src/lib/contributors.ts.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
        port: "",
        pathname: "/*",
      },
    ],
  },
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
      {
        // The service worker must never be served from a stale HTTP cache,
        // otherwise clients can get stuck on an old SW and miss updates.
        // `no-cache` forces revalidation on every request while still
        // allowing the browser to store the response.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
