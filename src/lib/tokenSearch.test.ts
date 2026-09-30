import { rankTokens } from "@/lib/tokenSearch";

describe("rankTokens", () => {
  it("prioritizes exact symbols and supports contract searches", () => {
    const tokens = [{ symbol: "USDC", name: "USD Coin", decimals: 6, priceUsd: 1, chainId: "eth", chainName: "Ethereum", contract: "0xabc" }, { symbol: "WETH", name: "Wrapped Ether", decimals: 18, priceUsd: 1, chainId: "eth", chainName: "Ethereum", contract: "0xdef" }];
    expect(rankTokens(tokens, "usdc")[0]?.symbol).toBe("USDC");
    expect(rankTokens(tokens, "abc")[0]?.symbol).toBe("USDC");
  });
});
