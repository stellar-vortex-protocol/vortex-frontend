import { WalletAdapterError, type WalletAdapter } from "./types";

type AlbedoApi = {
  publicKey?: (args?: { require?: boolean }) => Promise<{ pubkey: string }>;
  signXDR?: (args: { xdr: string; network?: string }) => Promise<{ signed_envelope_xdr: string }>;
};

function api(): AlbedoApi | undefined {
  return typeof window === "undefined" ? undefined : (window as Window & { albedo?: AlbedoApi }).albedo;
}

export const albedoAdapter: WalletAdapter = {
  id: "albedo",
  capabilities: ["canSignSoroban", "supportsNetworkQuery"],
  isConnected: async () => Boolean(api()),
  isAllowed: async () => Boolean(api()),
  connect: async () => {
    const value = await albedoAdapter.getPublicKey();
    return value;
  },
  disconnect: async () => {},
  getPublicKey: async () => {
    const client = api();
    if (!client?.publicKey) throw new WalletAdapterError("UNAVAILABLE", "Albedo is not installed.");
    return (await client.publicKey()).pubkey;
  },
  getNetwork: async () => "PUBLIC",
  signTransaction: async (xdr, opts) => {
    const client = api();
    if (!client?.signXDR) throw new WalletAdapterError("UNAVAILABLE", "Albedo is not installed.");
    if (!opts?.network) throw new WalletAdapterError("NETWORK_UNSUPPORTED", "A network is required to sign.");
    return (await client.signXDR({ xdr, network: opts.network })).signed_envelope_xdr;
  },
};
