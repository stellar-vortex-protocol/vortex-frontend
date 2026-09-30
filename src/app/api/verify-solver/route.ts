import { NextResponse, type NextRequest } from "next/server";
import { safeFetch } from "@/lib/server/safeFetch";
import { createTokenBucket } from "@/lib/server/rateLimit";
import { normalizeDomain } from "@/lib/server/domain";
import { parseStellarToml } from "@/lib/stellarToml";
import { secureLogger } from "@/lib/secureLogging";
import type { VerifySolverResponse } from "@/lib/solverIdentity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 1_000;

type CacheEntry = { at: number; ok: true; data: VerifySolverResponse } | { at: number; ok: false };
const cache = new Map<string, CacheEntry>();
// 10 requests burst, refilling at 1 request / 6 s per client IP.
const takeToken = createTokenBucket(10, 1 / 6);

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.ip || "unknown";
}

function remember(key: string, entry: CacheEntry) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, entry);
}

const unavailable = (status: number) =>
  NextResponse.json({ error: "unavailable" }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * GET /api/verify-solver?domain=example.com
 *
 * Fetches https://<domain>/.well-known/stellar.toml through the SSRF-guarded
 * `safeFetch` and returns a minimal normalised identity. Results (including
 * failures) are cached for 1 h. The response is for DISPLAY ONLY and must
 * never be used for authorization.
 */
export async function GET(req: NextRequest) {
  const domain = normalizeDomain(req.nextUrl.searchParams.get("domain"));
  if (!domain) {
    return NextResponse.json({ error: "invalid-domain" }, { status: 400 });
  }

  const cached = cache.get(domain.ascii);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.ok
      ? NextResponse.json(cached.data, { headers: { "Cache-Control": "public, max-age=3600" } })
      : unavailable(502);
  }

  if (!takeToken(clientIp(req))) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "6" } });
  }

  try {
    const res = await safeFetch(`https://${domain.ascii}/.well-known/stellar.toml`);
    const toml = parseStellarToml(res.body);
    const data: VerifySolverResponse = {
      domain: domain.ascii,
      domainUnicode: domain.unicode,
      accounts: toml.accounts,
      orgName: toml.orgName,
      orgUrl: toml.orgUrl,
    };
    remember(domain.ascii, { at: Date.now(), ok: true, data });
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (err) {
    secureLogger.warn("verify-solver: stellar.toml fetch failed", {
      domain: domain.ascii,
      code: (err as { code?: string }).code ?? "unknown",
    });
    remember(domain.ascii, { at: Date.now(), ok: false });
    return unavailable(502);
  }
}

