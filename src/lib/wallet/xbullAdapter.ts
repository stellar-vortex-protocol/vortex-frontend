import { WalletAdapterError, type WalletAdapter } from "./types";

type XBullApi = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  getPublicKey?: () => Promise<string>;
  getNetwork?: () => Promise<string>;
  signXDR?: (xdr: string, opts?: { network?: string }) => Promise<string | { signedXdr: string }>;
};

function api(): XBullApi | undefined {
  return typeof window === "undefined" ? undefined : (window as Window & { xBullWallet?: XBullApi }).xBullWallet;
}

export const xBullAdapter: WalletAdapter = {
  id: "xbull",
  capabilities: ["canSignSoroban", "supportsNetworkQuery"],
  isConnected: async () => Boolean(api()),
  isAllowed: async () => Boolean(api()),
  connect: async () => {
    const client = api();
    if (!client?.connect || !client.getPublicKey) throw new WalletAdapterError("UNAVAILABLE", "xBull is not installed.");
    await client.connect();
    return client.getPublicKey();
  },
  disconnect: async () => { await api()?.disconnect?.(); },
  getPublicKey: async () => {
    const key = api()?.getPublicKey;
    if (!key) throw new WalletAdapterError("UNAVAILABLE", "xBull is not installed.");
    return key();
  },
  getNetwork: async () => (await api()?.getNetwork?.()) ?? "PUBLIC",
  signTransaction: async (xdr, opts) => {
    const client = api();
    if (!client?.signXDR) throw new WalletAdapterError("UNAVAILABLE", "xBull is not installed.");
    if (!opts?.network) throw new WalletAdapterError("NETWORK_UNSUPPORTED", "A network is required to sign.");
    const signed = await client.signXDR(xdr, opts);
    return typeof signed === "string" ? signed : signed.signedXdr;
  },
};
