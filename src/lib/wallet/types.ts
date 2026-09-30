export type WalletCapability = "canSignSoroban" | "supportsNetworkQuery";

export class WalletAdapterError extends Error {
  constructor(
    public readonly code: "UNAVAILABLE" | "NETWORK_UNSUPPORTED" | "USER_REJECTED" | "UNKNOWN",
    message: string,
  ) {
    super(message);
    this.name = "WalletAdapterError";
  }
}

export interface WalletAdapter {
  readonly id?: string;
  readonly capabilities?: readonly WalletCapability[];
  isConnected(): Promise<boolean>;
  isAllowed(): Promise<boolean>;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<string>;
  signTransaction(xdr: string, opts?: { network?: string }): Promise<string>;
  watch?(onChange: (change: { address: string | null; network: string | null }) => void): () => void;
}
