import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import freighterApi from "@stellar/freighter-api";

export type WalletErrorKey =
  | "wallet.error.freighterUnavailable"
  | "wallet.error.connectFailed";

/** Shape of the slice persisted to localStorage under `PERSIST_KEY`. */
export type PersistedWalletState = {
  address: string | null;
  lastKnownAddress: string | null;
  network: string | null;
  isConnected: boolean;
};

export const PERSIST_KEY = "vortex-wallet";

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
   * Stable i18n key for the error when it maps to a known category, else null
   * (a raw error message from Freighter is surfaced via `error` only).
   */
  errorKey: WalletErrorKey | null;
  /**
   * `true` when a persisted session was dropped on hydrate because the
   * extension no longer allows this site - the UI can offer a one-click
   * reconnect keyed off `lastKnownAddress`.
   */
  wasSessionCleared: boolean;
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
  /**
   * Reconcile this tab's state with a persisted snapshot written by another
   * tab (delivered via the `storage` event). Trusts an explicit cross-tab
   * disconnect; re-verifies a changed account against the extension.
   */
  syncFromStorage: (persisted: PersistedWalletState) => void;
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
      errorKey: null,
      networkMismatch: false,
      notInstalled: false,

      connect: async () => {
        set({ isConnecting: true, error: null, errorKey: null, networkMismatch: false, notInstalled: false });
        try {
          const isAppConnected = await freighterApi.isConnected();
          if (!isAppConnected) {
            set({
              address: null,
              network: null,
              isConnected: false,
              isConnecting: false,
              error: "Freighter extension is not installed or enabled.",
              errorKey: "wallet.error.freighterUnavailable",
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
            errorKey: null,
            networkMismatch: mismatch,
            notInstalled: false,
          });
        } catch (err) {
          const externalError = err instanceof Error ? err.message : null;
          set({
            address: null,
            network: null,
            isConnected: false,
            isConnecting: false,
            wasSessionCleared: false,
            error: externalError ?? "Failed to connect wallet.",
            errorKey: externalError ? null : "wallet.error.connectFailed",
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
          errorKey: null,
          networkMismatch: false,
        });
      },

      // Silently restores a previously-connected session on app load, without
      // prompting the Freighter popup. Only re-populates state if the
      // extension still recognizes this site as allowed; otherwise clears
      // the stale persisted session.
      hydrate: async () => {
        if (!get().isConnected) return;
        // Preserve the address for a one-click reconnect if the session turns
        // out to be stale.
        const lastKnownAddress = get().address ?? get().lastKnownAddress;
        try {
          const isAppConnected = await freighterApi.isConnected();
          const allowed = isAppConnected && (await freighterApi.isAllowed());
          if (!allowed) {
            set({ address: null, lastKnownAddress, network: null, isConnected: false, error: null, errorKey: null, networkMismatch: false, notInstalled: false, wasSessionCleared: true });
            return;
          }

          const address = await freighterApi.getPublicKey();
          const network = await freighterApi.getNetwork();
          const mismatch = network.toUpperCase() !== EXPECTED_NETWORK;

          set({ address, network, isConnected: true, error: null, errorKey: null, networkMismatch: mismatch, notInstalled: false, wasSessionCleared: false });
        } catch {
          set({ address: null, lastKnownAddress, network: null, isConnected: false, error: null, errorKey: null, networkMismatch: false, notInstalled: false, wasSessionCleared: true });
        }
      },

      // === Cross-tab reconciliation (#302)
      // The `storage` event fires only in *other* tabs, so this never sees this
      // tab's own writes. A cross-tab disconnect (persisted isConnected=false)
      // is trusted; a changed account is re-verified against the extension.
      syncFromStorage: (persisted) => {
        const state = get();
        const inSync =
          persisted.isConnected === state.isConnected &&
          persisted.address === state.address;
        if (inSync) return;

        if (!persisted.isConnected) {
          set({
            address: null,
            network: null,
            isConnected: false,
            error: null,
            errorKey: null,
            networkMismatch: false,
            notInstalled: false,
          });
          return;
        }

        // Another tab connected, or switched account: adopt the address
        // optimistically, then let hydrate() confirm it with Freighter.
        set({
          address: persisted.address,
          lastKnownAddress: persisted.address ?? state.lastKnownAddress,
          network: persisted.network,
          isConnected: true,
        });
        void get().hydrate();
      },
    }),
    {
      name: PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): PersistedWalletState => ({
        address: state.address,
        lastKnownAddress: state.lastKnownAddress,
        network: state.network,
        isConnected: state.isConnected,
      }),
    }
  )
);
