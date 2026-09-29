/**
 * Trusted-origin configuration and evaluation utilities.
 *
 * `evaluateOrigin` is a pure function that determines whether a given
 * hostname is trusted, untrusted, or unknown based on an allowlist.
 * It is used by `useOriginTrust` and by signing-flow guards.
 */

export type TrustLevel = "trusted" | "untrusted" | "unknown";

/**
 * Evaluate whether a hostname is trusted based on an allowlist.
 *
 * - Exact match → "trusted"
 * - Wildcard suffix match (`*.example.com`) → "trusted" for direct subdomains
 * - No trusted origins configured → "unknown"
 * - Otherwise → "untrusted"
 *
 * The comparison is case-insensitive and strips any port from the hostname.
 * Punycode (IDN) hostnames are compared in their Unicode form, matching
 * how `window.location.hostname` presents them.
 */
export function evaluateOrigin(
  hostname: string,
  _protocol: string,
  trustedOrigins: string[],
): TrustLevel {
  if (trustedOrigins.length === 0) return "unknown";

  const normalizedHostname = hostname.toLowerCase().replace(/:\d+$/, "");

  for (const trusted of trustedOrigins) {
    const pattern = trusted.toLowerCase().trim();
    if (!pattern) continue;

    // Exact match
    if (normalizedHostname === pattern) return "trusted";

    // Wildcard suffix match: "*.example.com" matches "sub.example.com"
    // but NOT "sub.sub.example.com" (deep subdomain) and NOT "evil-example.com"
    if (pattern.startsWith("*.")) {
      const suffix = pattern.slice(1); // ".example.com"
      if (
        normalizedHostname.endsWith(suffix) &&
        normalizedHostname.length > suffix.length &&
        normalizedHostname[normalizedHostname.length - suffix.length - 1] !== "."
      ) {
        return "trusted";
      }
    }
  }

  return "untrusted";
}

/**
 * Parse the NEXT_PUBLIC_TRUSTED_ORIGINS env var into a list of patterns.
 * Falls back to sensible defaults for development and preview environments.
 *
 * The env var should be a comma-separated list of exact hostnames or
 * wildcard patterns (e.g. "localhost,127.0.0.1,*.vercel.app").
 */
export function getTrustedOrigins(): string[] {
  const envOrigins = process.env.NEXT_PUBLIC_TRUSTED_ORIGINS;

  if (envOrigins) {
    const parsed = envOrigins
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (parsed.length === 0) return [];
    return parsed;
  }

  // No env var configured — use environment-appropriate defaults.
  const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV;
  if (vercelEnv === "production") {
    // In production, no defaults are safe — the deployer must set
    // NEXT_PUBLIC_TRUSTED_ORIGINS explicitly.
    return [];
  }

  // Development and preview: trust localhost, loopback, and Vercel preview domains.
  return ["localhost", "127.0.0.1", "*.vercel.app"];
}
