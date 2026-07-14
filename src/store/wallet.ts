import { create } from "zustand";
import freighterApi from "@stellar/freighter-api";

export type WalletState = {
  address: string | null;
  network: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
};

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  network: null,
  isConnected: false,
  isConnecting: false,
  error: null,

  connect: async () => {
    set({ isConnecting: true, error: null });
    try {
      const isAppConnected = await freighterApi.isConnected();
      if (!isAppConnected) {
        throw new Error("Freighter extension is not installed or enabled.");
      }

      const address = await freighterApi.requestAccess();
      const network = await freighterApi.getNetwork();

      set({
        address,
        network,
        isConnected: true,
        isConnecting: false,
        error: null,
      });
    } catch (err) {
      set({
        address: null,
        network: null,
        isConnected: false,
        isConnecting: false,
        error: err instanceof Error ? err.message : "Failed to connect wallet.",
      });
    }
  },

  disconnect: () => {
    set({
      address: null,
      network: null,
      isConnected: false,
      isConnecting: false,
      error: null,
    });
  },
}));
