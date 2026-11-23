import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/server/clientIp";
import { createTokenBucket } from "@/lib/server/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORIZON_BY_NETWORK: Record<string, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
  mainnet: "https://horizon.stellar.org",
  public: "https://horizon.stellar.org",
};

// 30 burst, 1 request / 2 s per IP: one cheap upstream call, UI polls while resolving.
const takeToken = createTokenBucket(30, 1 / 2);

/**
 * GET /api/federation?address=G...
 *
 * Same-origin proxy to the (fixed, trusted) Horizon instance for the
 * configured network, so the browser CSP `connect-src` stays unchanged.
 * Returns `{ address, account_id }` on success. Errors use the shared
 * `{ error: string }` shape documented in `docs/api-contract.md`.
 */
export async function GET(req: NextRequest) {
  if (!takeToken(clientIp(req))) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "2" } });
  }
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!address) {
    return NextResponse.json({ error: "invalid-address" }, { status: 400 });
  }
  const network = (process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet").toLowerCase();
  const horizon = HORIZON_BY_NETWORK[network] ?? "https://horizon-testnet.stellar.org";

  try {
    const res = await fetch(`${horizon}/accounts/${address}`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (res.status === 404) return NextResponse.json({ error: "not-found" }, { status: 404 });
    if (!res.ok) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    const body = (await res.json()) as { account_id?: string };
    return NextResponse.json({ address, account_id: body.account_id ?? address });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
