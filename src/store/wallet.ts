import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import freighterApi from "@stellar/freighter-api";
import { DEFAULT_LOCALE, translate } from "@/lib/i18n";

export type WalletErrorKey =
  | "wallet.error.freighterUnavailable"
  | "wallet.error.connectFailed";

/** The network name the app expects, normalised to upper-case for comparison. */
const EXPECTED_NETWORK = (process.env.NEXT_PUBLIC_NETWORK ?? "testnet").toUpperCase();

export type WalletState = {
  address: string | null;
  lastKnownAddress: string | null;
  network: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** Generic connection error message (e.g. user declined access). */
  error: string | null;
  /**
   * `true` when the wallet is connected but on a different network than the
   * one configured via NEXT_PUBLIC_NETWORK. The wallet is still treated as
   * connected so the address remains accessible, but the UI should surface a
   * clear warning.
   */
  networkMismatch: boolean;
  /**
   * `true` when the connect attempt failed specifically because the Freighter
   * extension is not installed (as opposed to a generic failure). The UI can
   * use this to show an install link instead of a generic retry CTA.
   */
  notInstalled: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  hydrate: () => Promise<void>;
};

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      address: null,
      lastKnownAddress: null,
      network: null,
      isConnected: false,
      isConnecting: false,
      wasSessionCleared: false,
      error: null,
      networkMismatch: false,
      notInstalled: false,

      connect: async () => {
        set({ isConnecting: true, error: null, networkMismatch: false, notInstalled: false });
        try {
          const isAppConnected = await freighterApi.isConnected();
          if (!isAppConnected) {
            set({
              address: null,
              network: null,
              isConnected: false,
              isConnecting: false,
              error: "Freighter extension is not installed or enabled.",
              notInstalled: true,
            });
            return;
          }

          const address = await freighterApi.requestAccess();
          const network = await freighterApi.getNetwork();
          const mismatch = network.toUpperCase() !== EXPECTED_NETWORK;

          set({
            address,
            lastKnownAddress: address,
            network,
            isConnected: true,
            isConnecting: false,
            wasSessionCleared: false,
            error: null,
            networkMismatch: mismatch,
            notInstalled: false,
          });
        } catch (err) {
          const externalError = err instanceof Error ? err.message : null;
          if (!externalError) {
            errorKey = "wallet.error.connectFailed";
          }
          set({
            address: null,
            network: null,
            isConnected: false,
            isConnecting: false,
            wasSessionCleared: false,
            error: err instanceof Error ? err.message : "Failed to connect wallet.",
            networkMismatch: false,
            notInstalled: false,
          });
        }
      },

      disconnect: () => {
        set({
          address: null,
          network: null,
          isConnected: false,
          isConnecting: false,
          wasSessionCleared: false,
          error: null,
          networkMismatch: false,
        });
      },

      // Silently restores a previously-connected session on app load, without
      // prompting the Freighter popup. Only re-populates state if the
      // extension still recognizes this site as allowed; otherwise clears
      // the stale persisted session.
      hydrate: async () => {
        if (!get().isConnected) return;
        const previousAddress = get().address ?? get().lastKnownAddress;
        try {
          const isAppConnected = await freighterApi.isConnected();
          const allowed = isAppConnected && (await freighterApi.isAllowed());
          if (!allowed) {
            set({ address: null, network: null, isConnected: false, error: null, networkMismatch: false, notInstalled: false });
            return;
          }

          const address = await freighterApi.getPublicKey();
          const network = await freighterApi.getNetwork();
          const mismatch = network.toUpperCase() !== EXPECTED_NETWORK;

          set({ address, network, isConnected: true, error: null, networkMismatch: mismatch, notInstalled: false });
        } catch {
          set({ address: null, network: null, isConnected: false, error: null, networkMismatch: false, notInstalled: false });
        }
      },
    }),
    {
      name: "vortex-wallet",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        address: state.address,
        lastKnownAddress: state.lastKnownAddress,
        network: state.network,
        isConnected: state.isConnected,
      }),
    }
  )
);
