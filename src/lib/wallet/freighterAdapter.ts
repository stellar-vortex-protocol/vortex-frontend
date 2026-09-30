import freighterApi from "@stellar/freighter-api";
import type { WalletAdapter } from "./types";

export const freighterAdapter: WalletAdapter = {
  id: "freighter",
  capabilities: ["canSignSoroban", "supportsNetworkQuery"],
  isConnected: () => freighterApi.isConnected(),
  isAllowed: () => freighterApi.isAllowed(),
  connect: () => freighterApi.requestAccess(),
  disconnect: async () => {},
  getPublicKey: () => freighterApi.getPublicKey(),
  getNetwork: () => freighterApi.getNetwork(),
  signTransaction: (xdr, opts) => freighterApi.signTransaction(xdr, opts),
  watch: (onChange) => {
    const api = freighterApi as typeof freighterApi & { watchWalletChanges?: (callback: (address: string | null) => void) => () => void };
    if (!api.watchWalletChanges) return () => {};
    return api.watchWalletChanges((address) => { void freighterApi.getNetwork().then((network) => onChange({ address, network })); });
  },
};
