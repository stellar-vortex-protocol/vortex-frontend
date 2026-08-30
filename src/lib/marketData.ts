/**
 * PRICES_AS_OF
 *
 * The date these hardcoded token prices were last updated (ISO 8601 date string).
 * These values are **static estimates** used only for the approximate-USD display
 * in SwapCard and the chains list — the real settlement amounts always come from
 * the live `useQuote` result, never from these numbers.
 *
 * ── How to refresh ────────────────────────────────────────────────────────────
 * 1. Look up current prices on CoinGecko/CoinMarketCap for each token below.
 * 2. Update the `priceUSD` values in `SRC_TOKENS` and `DST_TOKENS`.
 * 3. Update this constant to today's date.
 * 4. Open a PR — CI will verify the catalog and type-checks pass.
 *
 * A proper live-price oracle integration is tracked separately.
 */
export const PRICES_AS_OF = "2026-08-30";

export const CHAINS = [
  { id: "ethereum", name: "Ethereum",  short: "ETH",  color: "#627EEA" },
  { id: "base",     name: "Base",      short: "BASE", color: "#0052FF" },
  { id: "polygon",  name: "Polygon",   short: "POL",  color: "#8247E5" },
  { id: "arbitrum", name: "Arbitrum",  short: "ARB",  color: "#12AAFF" },
  { id: "optimism", name: "Optimism",  short: "OP",   color: "#FF0420" },
  { id: "avalanche",name: "Avalanche", short: "AVAX", color: "#E84142" },
];

export const SRC_TOKENS: Record<string, { symbol: string; decimals: number; priceUSD: number }[]> = {
  ethereum: [
    { symbol: "USDC", decimals: 6,  priceUSD: 1.0 },
    { symbol: "WETH", decimals: 18, priceUSD: 3512.80 },
    { symbol: "WBTC", decimals: 8,  priceUSD: 67420.50 },
    { symbol: "USDT", decimals: 6,  priceUSD: 1.0 },
  ],
  base:     [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  polygon:  [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "MATIC", decimals: 18, priceUSD: 0.58 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  arbitrum: [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  optimism: [{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "WETH", decimals: 18, priceUSD: 3512.80 }],
  avalanche:[{ symbol: "USDC", decimals: 6, priceUSD: 1.0 }, { symbol: "AVAX", decimals: 18, priceUSD: 35.40 }],
};

export const DST_TOKENS = [
  { symbol: "USDC", priceUSD: 1.0,    contract: "CBIELTK6..." },
  { symbol: "XLM",  priceUSD: 0.1182, contract: "native" },
  { symbol: "yXLM", priceUSD: 0.1180, contract: "CCZX67..." },
];
