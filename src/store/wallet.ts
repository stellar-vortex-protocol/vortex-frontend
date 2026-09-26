import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { walletAdapter } from "@/lib/wallet";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

export type WalletErrorKey =
  "wallet.error.freighterUnavailable" | "wallet.error.connectFailed";

/** Shape of the slice persisted to localStorage under `PERSIST_KEY`. */
export type PersistedWalletState = {
  address: string | null;
  lastKnownAddress: string | null;
  network: string | null;
  isConnected: boolean;
};

export const PERSIST_KEY = "vortex-wallet";

/** The network name the app expects, normalised to upper-case for comparison. */
const EXPECTED_NETWORK = (
  process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet"
).toUpperCase();

/**
 * Guards rehydration: a persisted payload is only merged into the store if it
 * has exactly the `PersistedWalletState` shape and any addresses in it are
 * valid Stellar public keys. Anything else (corrupted or hand-edited
 * localStorage) is ignored and the store starts disconnected.
 */
function isValidPersistedState(state: unknown): state is PersistedWalletState {
  if (typeof state !== "object" || state === null) {
    return false;
  }

  const obj = state as Record<string, unknown>;

  if (
    typeof obj["address"] !== "string" &&
    obj["address"] !== null &&
    obj["address"] !== undefined
  ) {
    return false;
  }

  if (
    typeof obj["lastKnownAddress"] !== "string" &&
    obj["lastKnownAddress"] !== null &&
    obj["lastKnownAddress"] !== undefined
  ) {
    return false;
  }

  if (
    typeof obj["network"] !== "string" &&
    obj["network"] !== null &&
    obj["network"] !== undefined
  ) {
    return false;
  }

  if (typeof obj["isConnected"] !== "boolean") {
    return false;
  }

  const address = obj["address"];
  if (typeof address === "string" && !isValidStellarPublicKey(address)) {
    return false;
  }

  const lastKnownAddress = obj["lastKnownAddress"];
  if (
    typeof lastKnownAddress === "string" &&
    !isValidStellarPublicKey(lastKnownAddress)
  ) {
    return false;
  }

  return true;
}

export type WalletState = {
  /** Connected Stellar public key, or `null` when disconnected. */
  address: string | null;
  /**
   * Last address this browser was connected with. Kept after a disconnect or a
   * cleared session so the UI can offer a one-click "Reconnect G...".
   */
  lastKnownAddress: string | null;
  /** Network reported by the wallet (e.g. `TESTNET`), or `null`. */
  network: string | null;
  isConnected: boolean;
  /** `true` while a user-initiated `connect()` is in flight. */
  isConnecting: boolean;
  /**
   * `true` when the session ended without the user asking in this tab: a
   * persisted session that could no longer be restored on hydrate, or an
   * explicit disconnect. Drives the reconnect prompt.
   */
  wasSessionCleared: boolean;
  /**
   * Raw error message to show when there's no translated copy — typically a
   * pass-through message from the extension (e.g. "User declined access").
   */
  error: string | null;
  /**
   * i18n key for errors whose copy we own (Freighter missing, generic connect
   * failure); `null` otherwise. Consumers show `t(errorKey)` when set, else
   * `error`.
   */
  errorKey: WalletErrorKey | null;
  /**
   * `true` when the wallet is connected but on a different network than
   * NEXT_PUBLIC_NETWORK (default `testnet`). The wallet stays connected so the
   * address remains usable; the UI surfaces a warning.
   */
  networkMismatch: boolean;
  /**
   * `true` when the last connect attempt failed because the Freighter
   * extension isn't installed, so the UI can offer an install link.
   */
  notInstalled: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  /** Silently restore a persisted session on app load (never prompts). */
  hydrate: () => Promise<void>;
  /**
   * Re-read the account and network from the wallet while connected, to pick
   * up a switch made in the extension (it doesn't push change events).
   */
  checkForChanges: () => Promise<void>;
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
        set({
          isConnecting: true,
          error: null,
          errorKey: null,
          networkMismatch: false,
          notInstalled: false,
        });
        try {
          const isAppConnected = await walletAdapter.isConnected();
          if (!isAppConnected) {
            set({
              address: null,
              network: null,
              isConnected: false,
              isConnecting: false,
              wasSessionCleared: false,
              error: "Freighter extension is not installed or enabled.",
              errorKey: "wallet.error.freighterUnavailable",
              notInstalled: true,
            });
            return;
          }

          const address = await walletAdapter.connect();
          const network = await walletAdapter.getNetwork();
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
          // A real Error from the extension carries a user-meaningful message
          // (e.g. "User declined access") that we surface verbatim. Anything
          // else is an opaque failure we describe with our own translated copy.
          const externalError = err instanceof Error ? err.message : null;
          const message = externalError ?? "Failed to connect wallet.";
          set({
            address: null,
            network: null,
            isConnected: false,
            isConnecting: false,
            wasSessionCleared: false,
            error: message,
            errorKey: externalError ? null : "wallet.error.connectFailed",
            networkMismatch: false,
            notInstalled: false,
          });
        }
      },

      checkForChanges: async () => {
        const state = get();
        if (!state.isConnected) return;
        try {
          const isAppConnected = await walletAdapter.isConnected();
          const allowed = isAppConnected && (await walletAdapter.isAllowed());
          // Don't clear the session here: an extension that's momentarily
          // locked isn't the same as the user revoking access, and connect()
          // already owns the "not installed" flow.
          if (!allowed) return;

          const address = await walletAdapter.getPublicKey();
          const network = await walletAdapter.getNetwork();
          const mismatch = network.toUpperCase() !== EXPECTED_NETWORK;

          if (address !== state.address || network !== state.network || mismatch !== state.networkMismatch) {
            set({ address, lastKnownAddress: address, network, networkMismatch: mismatch });
          }
        } catch {
          // Freighter unreachable mid-check; leave existing state as-is.
        }
      },

      disconnect: () => {
        set({
          address: null,
          network: null,
          isConnected: false,
          isConnecting: false,
          wasSessionCleared: true,
          error: null,
          errorKey: null,
          networkMismatch: false,
          notInstalled: false,
        });
      },

      // Silently restores a previously-connected session on app load, without
      // prompting the Freighter popup. Only re-populates state if the
      // extension still recognizes this site as allowed; otherwise clears
      // the stale persisted session.
      hydrate: async () => {
        if (!get().isConnected) return;
        const previousAddress = get().address ?? get().lastKnownAddress;
        // Shared shape for the two "session went away" paths below: keep the
        // last address around and flag it so the UI can offer a reconnect.
        const clearedSession: Partial<WalletState> = {
          address: null,
          network: null,
          isConnected: false,
          lastKnownAddress: previousAddress,
          wasSessionCleared: Boolean(previousAddress),
          error: null,
          errorKey: null,
          networkMismatch: false,
          notInstalled: false,
        };
        try {
          const isAppConnected = await walletAdapter.isConnected();
          const allowed = isAppConnected && (await walletAdapter.isAllowed());
          // A user-initiated connect() that started while we were waiting on
          // the extension owns the state from here; don't overwrite it.
          if (get().isConnecting) return;
          if (!allowed) {
            set(clearedSession);
            return;
          }

          const address = await walletAdapter.getPublicKey();
          const network = await walletAdapter.getNetwork();
          const mismatch = network.toUpperCase() !== EXPECTED_NETWORK;
          if (get().isConnecting) return;

          set({
            address,
            lastKnownAddress: address,
            network,
            isConnected: true,
            wasSessionCleared: false,
            error: null,
            errorKey: null,
            networkMismatch: mismatch,
            notInstalled: false,
          });
        } catch {
          // Extension removed or unreachable since the last session.
          if (get().isConnecting) return;
          set(clearedSession);
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
      // Ignore a corrupted/hand-edited persisted payload rather than trusting it.
      merge: (persisted, current) =>
        isValidPersistedState(persisted) ? { ...current, ...persisted } : current,
      partialize: (state): PersistedWalletState => ({
        address: state.address,
        lastKnownAddress: state.lastKnownAddress,
        network: state.network,
        isConnected: state.isConnected,
      }),
    },
  ),
);
