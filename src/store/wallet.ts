import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import freighterApi from "@stellar/freighter-api";

export type WalletState = {
  address: string | null;
  network: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  hydrate: () => Promise<void>;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
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

      // Silently restores a previously-connected session on app load, without
      // prompting the Freighter popup. Only re-populates state if the
      // extension still recognizes this site as allowed; otherwise clears
      // the stale persisted session.
      hydrate: async () => {
        if (!get().isConnected) return;
        try {
          const isAppConnected = await freighterApi.isConnected();
          const allowed = isAppConnected && (await freighterApi.isAllowed());
          if (!allowed) {
            set({ address: null, network: null, isConnected: false, error: null });
            return;
          }

          const address = await freighterApi.getPublicKey();
          const network = await freighterApi.getNetwork();
          set({ address, network, isConnected: true, error: null });
        } catch {
          set({ address: null, network: null, isConnected: false, error: null });
        }
      },
    }),
    {
      name: "vortex-wallet",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        address: state.address,
        network: state.network,
        isConnected: state.isConnected,
      }),
    }
  )
);
