import type { Chain, Token } from "@/lib/types";

export type SelectableToken = Token & { chainId: string; chainName: string };

export function rankTokens(tokens: SelectableToken[], query: string): SelectableToken[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...tokens];
  return tokens.map((token) => {
    const symbol = token.symbol.toLowerCase();
    const name = (token.name ?? "").toLowerCase();
    const contract = (token.contract ?? "").toLowerCase();
    const score = symbol === needle ? 100 : symbol.startsWith(needle) ? 80 : name.startsWith(needle) ? 60 : contract.includes(needle) ? 40 : name.includes(needle) || symbol.includes(needle) ? 20 : 0;
    return { token, score };
  }).filter((item) => item.score > 0).sort((a, b) => b.score - a.score || a.token.symbol.localeCompare(b.token.symbol)).map((item) => item.token);
}

export function flattenTokens(chains: Chain[], srcTokens: Record<string, Token[]>): SelectableToken[] {
  return chains.flatMap((chain) => (srcTokens[chain.id] ?? []).map((token) => ({ ...token, chainId: chain.id, chainName: chain.name })));
}
