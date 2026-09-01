import { freighterAdapter } from "./freighterAdapter";

export type { WalletAdapter } from "./types";
export { freighterAdapter } from "./freighterAdapter";

// Hardcoded to Freighter for now. Swap this to select a different adapter
// once wallet-choice UI exists.
export const walletAdapter: WalletAdapter = freighterAdapter;
