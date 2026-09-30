import { freighterAdapter } from "./freighterAdapter";
import type { WalletAdapter } from "./types";
export type { WalletAdapter } from "./types";
export { freighterAdapter } from "./freighterAdapter";
export const walletAdapter: WalletAdapter = freighterAdapter;
