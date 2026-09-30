import { Networks } from "@stellar/stellar-sdk";

export type AppNetwork = "testnet" | "mainnet" | "futurenet" | "standalone";
const aliases: Record<string, AppNetwork> = { public: "mainnet", mainnet: "mainnet", testnet: "testnet", futurenet: "futurenet", standalone: "standalone" };
export function normalizeNetwork(value: string | null | undefined): AppNetwork | string { const key = (value ?? "testnet").trim().toLowerCase(); return aliases[key] ?? key; }
export function networkPassphrase(value: string | null | undefined): string { switch (normalizeNetwork(value)) { case "mainnet": return Networks.PUBLIC; case "testnet": return Networks.TESTNET; case "futurenet": return Networks.FUTURENET; default: return value ?? Networks.TESTNET; } }
export function networksMatch(expected: string | null | undefined, actual: string | null | undefined): boolean { return normalizeNetwork(expected) === normalizeNetwork(actual); }

export class NetworkMismatchError extends Error {
  readonly code = "NETWORK_MISMATCH" as const;
  constructor(public readonly expected: string, public readonly actual: string) { super(`Wallet is on ${actual}, but ${expected} is required. Switch networks before signing.`); this.name = "NetworkMismatchError"; }
}

export function assertWalletReady(expected: string | null | undefined, actual: string | null | undefined): void {
  if (!networksMatch(expected, actual)) throw new NetworkMismatchError(normalizeNetwork(expected), normalizeNetwork(actual));
}
