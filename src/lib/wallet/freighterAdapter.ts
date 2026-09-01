import freighterApi from "@stellar/freighter-api";
import type { WalletAdapter } from "./types";

export const freighterAdapter: WalletAdapter = {
  isConnected: () => freighterApi.isConnected(),
  isAllowed: () => freighterApi.isAllowed(),
  connect: () => freighterApi.requestAccess(),
  disconnect: async () => {},
  getPublicKey: () => freighterApi.getPublicKey(),
  getNetwork: () => freighterApi.getNetwork(),
  signTransaction: (xdr, opts) => freighterApi.signTransaction(xdr, opts),
};
