import { getTrustline } from "@/lib/chain/horizon";

describe("trustline detection", () => {
  it("distinguishes present, missing, and unfunded accounts", async () => {
    const asset = { symbol: "USDC", decimals: 7, priceUsd: 1, issuer: "GISSUER" };
    const present = await getTrustline("GUSER", asset, async () => new Response(JSON.stringify({ balances: [{ asset_code: "USDC", asset_issuer: "GISSUER" }] })));
    const missing = await getTrustline("GUSER", asset, async () => new Response(JSON.stringify({ balances: [] })));
    const unknown = await getTrustline("GUSER", asset, async () => new Response("", { status: 404 }));
    expect(present).toBe("exists"); expect(missing).toBe("missing"); expect(unknown).toBe("unknown");
  });
});
