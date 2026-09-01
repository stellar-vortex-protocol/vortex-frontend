import type { Chain, Token } from "@/lib/types";

export const CHAINS = [
  { id: "ethereum",  name: "Ethereum",  shortName: "ETH",  color: "#627EEA" },
  { id: "base",      name: "Base",      shortName: "BASE", color: "#0052FF" },
  { id: "polygon",   name: "Polygon",   shortName: "POL",  color: "#8247E5" },
  { id: "arbitrum",  name: "Arbitrum",  shortName: "ARB",  color: "#12AAFF" },
  { id: "optimism",  name: "Optimism",  shortName: "OP",   color: "#FF0420" },
  { id: "avalanche", name: "Avalanche", shortName: "AVAX", color: "#E84142" },
] satisfies Chain[];

export const SRC_TOKENS: Record<string, Token[]> = {
  ethereum: [
    { symbol: "USDC", decimals: 6,  priceUsd: 1.0 },
    { symbol: "WETH", decimals: 18, priceUsd: 3512.80 },
    { symbol: "WBTC", decimals: 8,  priceUsd: 67420.50 },
    { symbol: "USDT", decimals: 6,  priceUsd: 1.0 },
  ],
  base:     [{ symbol: "USDC", decimals: 6, priceUsd: 1.0 }, { symbol: "WETH", decimals: 18, priceUsd: 3512.80 }],
  polygon:  [{ symbol: "USDC", decimals: 6, priceUsd: 1.0 }, { symbol: "MATIC", decimals: 18, priceUsd: 0.58 }, { symbol: "WETH", decimals: 18, priceUsd: 3512.80 }],
  arbitrum: [{ symbol: "USDC", decimals: 6, priceUsd: 1.0 }, { symbol: "WETH", decimals: 18, priceUsd: 3512.80 }],
  optimism: [{ symbol: "USDC", decimals: 6, priceUsd: 1.0 }, { symbol: "WETH", decimals: 18, priceUsd: 3512.80 }],
  avalanche:[{ symbol: "USDC", decimals: 6, priceUsd: 1.0 }, { symbol: "AVAX", decimals: 18, priceUsd: 35.40 }],
};

// Stellar-side assets settle with the network's fixed 7-decimal precision.
export const DST_TOKENS = [
  { symbol: "USDC", decimals: 7, priceUsd: 1.0,    contract: "CBIELTK6..." },
  { symbol: "XLM",  decimals: 7, priceUsd: 0.1182, contract: "native" },
  { symbol: "yXLM", decimals: 7, priceUsd: 0.1180, contract: "CCZX67..." },
] satisfies Token[];
