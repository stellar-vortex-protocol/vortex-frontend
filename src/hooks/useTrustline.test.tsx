import { checkTrustline } from "@/lib/chain/trustline";

describe("trustline detection", () => {
  const asset = { symbol: "USDC", decimals: 7, priceUsd: 1, issuer: "GISSUER" };

  it("distinguishes present, absent, and failed lookups", async () => {
    const present = await checkTrustline("GUSER", asset, async () => new Response(JSON.stringify({ balances: [{ asset_code: "USDC", asset_issuer: "GISSUER", balance: "12.5" }] })));
    const absent = await checkTrustline("GUSER", asset, async () => new Response(JSON.stringify({ balances: [] })));
    const failed = await checkTrustline("GUSER", asset, async () => new Response("", { status: 503 }));
    expect(present).toEqual({ status: "present", balance: "12.5" });
    expect(absent).toEqual({ status: "absent" });
    expect(failed.status).toBe("error");
  });

  it("reports an error outcome when Horizon throws", async () => {
    const result = await checkTrustline("GUSER", asset, async () => {
      throw new Error("network down");
    });
    expect(result).toEqual({ status: "error", message: "network down" });
  });

  it("reports an absent outcome when the account has no matching trustline", async () => {
    const result = await checkTrustline("GUSER", asset, async () => new Response(JSON.stringify({ balances: [{ asset_code: "EURC", asset_issuer: "GISSUER" }] })));
    expect(result).toEqual({ status: "absent" });
  });
});
