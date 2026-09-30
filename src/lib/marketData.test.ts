import { validateRegistryPayload } from "@/lib/marketData";

describe("market registry", () => {
  it("drops malformed assets while preserving valid registry entries", () => {
    const result = validateRegistryPayload({ chains: [{ id: "x", name: "X", shortName: "X", color: "#fff" }, {}], srcTokens: { x: [{ symbol: "USDC", decimals: 6, priceUsd: 1 }, { symbol: "bad", decimals: -1, priceUsd: -2 }] }, dstTokens: [{ symbol: "XLM", decimals: 7, priceUsd: 0.1 }] });
    expect(result.chains).toHaveLength(1);
    expect(result.srcTokens.x).toHaveLength(1);
  });
});
