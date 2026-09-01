"use client";

import { useEffect } from "react";
import { useWalletStore, PERSIST_KEY, type PersistedWalletState } from "@/store/wallet";

// Mounted once in the root layout. On first client paint, attempts to
// silently restore a previously-connected wallet session (persisted in
// localStorage) without triggering the Freighter popup. Also keeps this tab's
// wallet state in step with connect/disconnect done in other tabs (#302).
export function WalletHydrator() {
  useEffect(() => {
    useWalletStore.getState().hydrate();

    const onStorage = (event: StorageEvent) => {
      // `storage` fires only for changes made in *other* tabs.
      if (event.key !== PERSIST_KEY || event.newValue === null) return;
      try {
        const parsed = JSON.parse(event.newValue) as {
          state?: PersistedWalletState;
        } & Partial<PersistedWalletState>;
        const persisted = parsed.state ?? (parsed as PersistedWalletState);
        useWalletStore.getState().syncFromStorage(persisted);
      } catch {
        // Ignore a malformed write rather than crashing the app.
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return null;
}
