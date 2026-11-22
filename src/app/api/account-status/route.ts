import { NextResponse, type NextRequest } from "next/server";
import { fetchHorizonAccount, HorizonError } from "@/lib/chain/horizon";
import { clientIp } from "@/lib/server/clientIp";
import { createTokenBucket } from "@/lib/server/rateLimit";
import { secureLogger } from "@/lib/secureLogging";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORIZON_BY_NETWORK: Record<string, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
  mainnet: "https://horizon.stellar.org",
  public: "https://horizon.stellar.org",
};

// 30 burst, 1 request / 2 s per IP: one cheap upstream call, UI polls while funding.
const takeToken = createTokenBucket(30, 1 / 2);

/**
 * GET /api/account-status?address=G...
 *
 * Same-origin proxy to the (fixed, trusted) Horizon instance for the
 * configured network, so the browser CSP `connect-src` stays unchanged.
 * Returns `{ funded: boolean }` — an account that does not exist on the
 * ledger (Horizon 404) is unfunded. Horizon 5xx/timeout yields 502 with a
 * distinct error code; the raw upstream body is logged server-side only.
 */
export async function GET(req: NextRequest) {
  if (!takeToken(clientIp(req))) {
    return NextResponse.json({ error: "rate-limited" }, { status: 429, headers: { "Retry-After": "2" } });
  }
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!isValidStellarPublicKey(address)) {
    return NextResponse.json({ error: "invalid-address" }, { status: 400 });
  }
  const network = (process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet").toLowerCase();
  const horizon = HORIZON_BY_NETWORK[network] ?? "https://horizon-testnet.stellar.org";

  try {
    await fetchHorizonAccount(address, fetch, horizon);
    return NextResponse.json({ funded: true });
  } catch (error) {
    if (error instanceof HorizonError) {
      if (error.status === 404) return NextResponse.json({ funded: false });
      // Raw upstream body stays server-side only.
      secureLogger.error("Horizon account lookup failed", { status: error.status, body: error.body });
      return NextResponse.json({ error: "horizon-error" }, { status: 502 });
    }
    secureLogger.error("Horizon account lookup unavailable", { error: String(error) });
    return NextResponse.json({ error: "horizon-unavailable" }, { status: 502 });
  }
}
