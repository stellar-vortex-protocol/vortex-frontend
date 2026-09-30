/**
 * Centralised, network-aware block explorer URLs (#443). Every external link
 * to an explorer should be built here so the network mapping lives in one place.
 */

export type ExplorerEntity = "tx" | "account" | "contract";

const STELLAR_EXPERT_NETWORKS: Record<string, string> = {
  testnet: "testnet",
  mainnet: "public",
  public: "public",
  pubnet: "public",
  futurenet: "futurenet",
};

// Identifiers are alphanumeric (hex tx hashes, base32 StrKeys). Anything else
// (whitespace, `:`, `/`, bidi characters...) is rejected rather than linked.
const IDENTIFIER_RE = /^[A-Za-z0-9]{1,128}$/;

export const CONFIGURED_NETWORK = process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet";

/**
 * Returns a stellar.expert URL, or `null` for an unknown network or a value
 * that isn't a plain identifier (so callers render plain text instead of a
 * broken or spoofed link).
 */
export function explorerUrl(
  entity: ExplorerEntity,
  value: string,
  network: string = CONFIGURED_NETWORK,
): string | null {
  const segment = STELLAR_EXPERT_NETWORKS[network.toLowerCase()];
  if (!segment) return null;
  if (!IDENTIFIER_RE.test(value)) return null;
  return `https://stellar.expert/explorer/${segment}/${entity}/${encodeURIComponent(value)}`;
}
