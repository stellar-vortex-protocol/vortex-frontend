export interface WalletAdapter {
  isConnected(): Promise<boolean>;
  isAllowed(): Promise<boolean>;
  connect(): Promise<string>;
  disconnect(): Promise<void>;
  getPublicKey(): Promise<string>;
  getNetwork(): Promise<string>;
  signTransaction(xdr: string, opts?: { network?: string }): Promise<string>;
}
