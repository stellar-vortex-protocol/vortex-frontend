import freighterApi from "@stellar/freighter-api";
import type { WalletAdapter } from "./types";
import { normalizeWalletError, WalletError, withWalletTimeout } from "./errors";

/**
 * Run a Freighter call, normalising every failure shape into a `WalletError`:
 * thrown strings/Errors (freighter-api <= 2.x), `{ error }` result objects
 * (>= 3.x), a missing method (older extension), and a hung extension.
 */
async function call<T>(method: keyof typeof freighterApi, run: () => Promise<T>): Promise<T> {
  if (typeof freighterApi[method] !== "function") {
    throw new WalletError("unsupported-method");
  }
  let result: T;
  try {
    result = await withWalletTimeout(run());
  } catch (err) {
    throw normalizeWalletError(err);
  }
  if (typeof result === "object" && result !== null && "error" in result && result.error) {
    throw normalizeWalletError(result);
  }
  return result;
}

export const freighterAdapter: WalletAdapter = {
  isConnected: () => call("isConnected", () => freighterApi.isConnected()),
  isAllowed: () => call("isAllowed", () => freighterApi.isAllowed()),
  connect: () => call("requestAccess", () => freighterApi.requestAccess()),
  disconnect: async () => {},
  getPublicKey: () => call("getPublicKey", () => freighterApi.getPublicKey()),
  getNetwork: () => call("getNetwork", () => freighterApi.getNetwork()),
  signTransaction: (xdr, opts) =>
    call("signTransaction", () => freighterApi.signTransaction(xdr, opts)),
};
