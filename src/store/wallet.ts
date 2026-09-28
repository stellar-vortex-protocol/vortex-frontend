import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import freighterApi from "@stellar/freighter-api";
import { walletAdapter, normalizeWalletError } from "@/lib/wallet";
import type { WalletErrorKind } from "@/lib/wallet";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

export type { WalletErrorKind } from "@/lib/wallet";

/** i18n key for each wallet error kind; see `docs/wallet-hydration.md`. */
export type WalletErrorKey = `wallet.error.${WalletErrorKind}`;

export function walletErrorKey(kind: WalletErrorKind): WalletErrorKey {
  return `wallet.error.${kind}`;
}

/**
 * English fallback copy per kind, for non-React callers (hooks that throw).
 * UI should render `t(errorKey)` instead.
 */
export const WALLET_ERROR_FALLBACK: Record<WalletErrorKind, string> = {
  "not-installed": "Freighter extension is not installed or enabled.",
  locked: "Freighter is locked. Unlock it and try again.",
  "user-rejected": "The request was declined in Freighter.",
  "wrong-network": "Freighter is on the wrong network.",
  "unsupported-method": "This version of Freighter does not support this action. Update the extension.",
  timeout: "Freighter did not respond in time.",
  unknown: "Failed to connect wallet.",
};

function errorFields(kind: WalletErrorKind) {
  return {
    error: WALLET_ERROR_FALLBACK[kind],
    errorKind: kind,
    errorKey: walletErrorKey(kind),
  };
}

const NO_ERROR = { error: null, errorKind: null, errorKey: null } as const;

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

function isValidPersistedState(state: unknown): state is {
  address: string | null;
  lastKnownAddress: string | null;
  network: string | null;
  isConnected: boolean;
} {
  if (typeof state !== "object" || state === null) {
    return false;
  }

  const obj = state as Record<string, unknown>;

  if (
    typeof obj.address !== "string" &&
    obj.address !== null &&
    obj.address !== undefined
  ) {
    return false;
  }

  if (
    typeof obj.lastKnownAddress !== "string" &&
    obj.lastKnownAddress !== null &&
    obj.lastKnownAddress !== undefined
  ) {
    return false;
  }

  if (
    typeof obj.network !== "string" &&
    obj.network !== null &&
    obj.network !== undefined
  ) {
    return false;
  }

  if (typeof obj.isConnected !== "boolean") {
    return false;
  }

  const address = obj.address;
  if (typeof address === "string" && !isValidStellarPublicKey(address)) {
    return false;
  }

  const lastKnownAddress = obj.lastKnownAddress;
  if (
    typeof lastKnownAddress === "string" &&
    !isValidStellarPublicKey(lastKnownAddress)
  ) {
    return false;
  }

  return true;
}

export type WalletState = {
  address: string | null;
  lastKnownAddress: string | null;
  network: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  /** English fallback copy for the current error; never raw extension text. */
  error: string | null;
  /** Typed failure category; hooks and UI should branch on this. */
  errorKind: WalletErrorKind | null;
  /** i18n key for the current error (`t(errorKey)`), derived from `errorKind`. */
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
      ...NO_ERROR,
      networkMismatch: false,
      notInstalled: false,

      connect: async () => {
        set({
          isConnecting: true,
          ...NO_ERROR,
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
              ...errorFields("not-installed"),
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
            ...NO_ERROR,
            networkMismatch: mismatch,
            notInstalled: false,
          });
        } catch (err) {
          // Adapters already reject with a WalletError; normalise anything
          // else so the UI only ever sees a typed kind and our own copy.
          const { kind } = normalizeWalletError(err);
          set({
            address: null,
            network: null,
            isConnected: false,
            isConnecting: false,
            wasSessionCleared: false,
            ...errorFields(kind),
            networkMismatch: false,
            notInstalled: kind === "not-installed",
          });
        }
      },

      checkForChanges: async () => {
        const state = get();
        if (!state.isConnected) return;
        try {
          const isAppConnected = await freighterApi.isConnected();
          const allowed = isAppConnected && (await freighterApi.isAllowed());
          // Don't clear the session here: an extension that's momentarily
          // locked isn't the same as the user revoking access, and connect()
          // already owns the "not installed" flow.
          if (!allowed) return;

          const address = await freighterApi.getPublicKey();
          const network = await freighterApi.getNetwork();
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
          ...NO_ERROR,
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
          ...NO_ERROR,
          networkMismatch: false,
          notInstalled: false,
        };
        try {
          const isAppConnected = await walletAdapter.isConnected();
          const allowed = isAppConnected && (await walletAdapter.isAllowed());
          if (!allowed) {
            set({
              address: null,
              lastKnownAddress: get().address ?? get().lastKnownAddress,
              network: null,
              isConnected: false,
              wasSessionCleared: true,
              ...NO_ERROR,
              networkMismatch: false,
              notInstalled: false,
            });
            return;
          }

          const address = await walletAdapter.getPublicKey();
          const network = await walletAdapter.getNetwork();
          const mismatch = network.toUpperCase() !== EXPECTED_NETWORK;

          set({
            address,
            lastKnownAddress: address,
            network,
            isConnected: true,
            wasSessionCleared: false,
            ...NO_ERROR,
            networkMismatch: mismatch,
            notInstalled: false,
          });
        } catch {
          set({
            address: null,
            network: null,
            isConnected: false,
            wasSessionCleared: false,
            ...NO_ERROR,
            networkMismatch: false,
            notInstalled: false,
          });
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
            ...NO_ERROR,
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
    },
  ),
);
