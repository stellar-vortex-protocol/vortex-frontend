import { NextResponse, type NextRequest } from "next/server";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HORIZON_BY_NETWORK: Record<string, string> = {
  testnet: "https://horizon-testnet.stellar.org",
  futurenet: "https://horizon-futurenet.stellar.org",
  mainnet: "https://horizon.stellar.org",
  public: "https://horizon.stellar.org",
};

/**
 * GET /api/account-status?address=G...
 *
 * Same-origin proxy to the (fixed, trusted) Horizon instance for the
 * configured network, so the browser CSP `connect-src` stays unchanged.
 * Returns `{ funded: boolean }` — an account that does not exist on the
 * ledger (Horizon 404) is unfunded.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address") ?? "";
  if (!isValidStellarPublicKey(address)) {
    return NextResponse.json({ error: "invalid-address" }, { status: 400 });
  }
  const network = (process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet").toLowerCase();
  const horizon = HORIZON_BY_NETWORK[network] ?? "https://horizon-testnet.stellar.org";

  try {
    const res = await fetch(`${horizon}/accounts/${address}`, {
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    if (res.status === 404) return NextResponse.json({ funded: false });
    if (!res.ok) return NextResponse.json({ error: "unavailable" }, { status: 502 });
    return NextResponse.json({ funded: true });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 502 });
  }
}
