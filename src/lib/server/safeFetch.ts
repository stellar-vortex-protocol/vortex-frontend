import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";

/**
 * SSRF-guarded HTTPS GET for fetching third-party content server-side
 * (e.g. stellar.toml files). See docs/security-audit.md for the threat model.
 *
 * - https only, default port only, no credentials in the URL, no IP literals.
 * - DNS is resolved inside the socket's own `lookup`, and EVERY resolved
 *   address is checked against private/loopback/link-local/reserved ranges.
 *   The validated address is the one connected to, which defeats DNS
 *   rebinding (no second resolution between check and use).
 * - Redirects are followed manually, at most `maxRedirects`, and only to the
 *   same host over https.
 * - Response body capped at `maxBytes`; whole request bounded by `timeoutMs`.
 */
export class SafeFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid-url"
      | "blocked-address"
      | "redirect"
      | "too-large"
      | "timeout"
      | "http-status"
      | "network",
  ) {
    super(message);
    this.name = "SafeFetchError";
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128], ["::1", 128], ["64:ff9b::", 96], ["100::", 64], ["2001::", 23],
  ["2001:db8::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["fec0::", 10], ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True when `ip` is not a public unicast address. */
export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 0) return true;
  if (family === 6) {
    // IPv4-mapped / -compatible IPv6 (::ffff:10.0.0.1) → check the embedded v4.
    const mapped = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped?.[1]) return isBlockedAddress(mapped[1]);
    if (/^::ffff:/i.test(ip)) return true;
    return blocked.check(ip, "ipv6");
  }
  return blocked.check(ip, "ipv4");
}

export type SafeFetchDeps = {
  resolve: (hostname: string) => Promise<LookupAddress[]>;
  request: typeof httpsRequest;
};

const defaultDeps: SafeFetchDeps = {
  resolve: (hostname) =>
    new Promise((resolve, reject) =>
      dnsLookup(hostname, { all: true, verbatim: true }, (err, addrs) =>
        err ? reject(err) : resolve(addrs),
      ),
    ),
  request: httpsRequest,
};

export type SafeFetchOptions = {
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  deps?: SafeFetchDeps;
};

export type SafeFetchResult = { status: number; body: string; finalUrl: string };

function assertSafeUrl(url: URL, host: string): void {
  if (url.protocol !== "https:") throw new SafeFetchError("Only https is allowed", "invalid-url");
  if (url.username || url.password) throw new SafeFetchError("Credentials not allowed", "invalid-url");
  if (url.port && url.port !== "443") throw new SafeFetchError("Non-default port", "invalid-url");
  const bare = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(bare)) throw new SafeFetchError("IP literals are not allowed", "blocked-address");
  if (url.hostname !== host) throw new SafeFetchError("Cross-host redirect", "redirect");
}

function guardedLookup(deps: SafeFetchDeps): LookupFunction {
  return (hostname, options, callback) => {
    deps
      .resolve(hostname)
      .then((addrs) => {
        const first = addrs[0];
        if (!first || addrs.some((a) => isBlockedAddress(a.address))) {
          throw new SafeFetchError("Resolved to a blocked address", "blocked-address");
        }
        if (options.all) callback(null, addrs);
        else callback(null, first.address, first.family);
      })
      .catch((err: NodeJS.ErrnoException) => callback(err, "", 4));
  };
}

function fetchOnce(
  url: URL,
  deps: SafeFetchDeps,
  maxBytes: number,
  signal: AbortSignal,
): Promise<{ status: number; location: string | null; body: string }> {
  return new Promise((resolve, reject) => {
    const req = deps.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup(deps),
        headers: { accept: "text/plain, application/toml, */*;q=0.1", "user-agent": "vortex-solver-verifier" },
        signal,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location: res.headers.location ?? null, body: "" });
          return;
        }
        const declared = Number(res.headers["content-length"]);
        if (Number.isFinite(declared) && declared > maxBytes) {
          res.destroy();
          reject(new SafeFetchError("Response too large", "too-large"));
          return;
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            res.destroy();
            reject(new SafeFetchError("Response too large", "too-large"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => resolve({ status, location: null, body: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", (err) => reject(err));
      },
    );
    req.on("error", (err) => reject(err));
    req.end();
  });
}

export async function safeFetch(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { maxBytes = 100 * 1024, timeoutMs = 3_000, maxRedirects = 3, deps = defaultDeps } = options;

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SafeFetchError("Invalid URL", "invalid-url");
  }
  const host = url.hostname;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= maxRedirects; hop++) {
      assertSafeUrl(url, host);
      const res = await fetchOnce(url, deps, maxBytes, controller.signal);
      if (res.status >= 300 && res.status < 400) {
        if (!res.location) throw new SafeFetchError("Redirect without location", "redirect");
        url = new URL(res.location, url);
        continue;
      }
      if (res.status < 200 || res.status >= 300) {
        throw new SafeFetchError(`Upstream returned ${res.status}`, "http-status");
      }
      return { status: res.status, body: res.body, finalUrl: url.toString() };
    }
    throw new SafeFetchError("Too many redirects", "redirect");
  } catch (err) {
    if (err instanceof SafeFetchError) throw err;
    if (controller.signal.aborted) throw new SafeFetchError("Request timed out", "timeout");
    const cause = (err as { cause?: unknown }).cause;
    if (cause instanceof SafeFetchError) throw cause;
    throw new SafeFetchError(err instanceof Error ? err.message : "Network error", "network");
  } finally {
    clearTimeout(timer);
  }
}
