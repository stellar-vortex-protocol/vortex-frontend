import { freighterAdapter } from "./freighterAdapter";
import type { WalletAdapter } from "./types";

export type { WalletAdapter } from "./types";
export { freighterAdapter } from "./freighterAdapter";
export {
  WalletError,
  WALLET_ERROR_KINDS,
  isWalletError,
  normalizeWalletError,
  withWalletTimeout,
} from "./errors";
export type { WalletErrorKind } from "./errors";

// Hardcoded to Freighter for now. Swap this to select a different adapter
// once wallet-choice UI exists.
export const walletAdapter: WalletAdapter = freighterAdapter;
