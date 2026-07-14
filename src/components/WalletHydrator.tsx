"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/store/wallet";

// Mounted once in the root layout. On first client paint, attempts to
// silently restore a previously-connected wallet session (persisted in
// localStorage) without triggering the Freighter popup.
export function WalletHydrator() {
  useEffect(() => {
    useWalletStore.getState().hydrate();
  }, []);

  return null;
}
