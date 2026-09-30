"use client";
import { useEffect } from "react";
import { walletAdapter } from "@/lib/wallet";
import { useWalletStore } from "@/store/wallet";
export function WalletHydrator() { const sync = useWalletStore((state) => state.syncFromStorage); useEffect(() => { const stop = walletAdapter.watch?.((change) => { if (!change.address) { useWalletStore.getState().disconnect(); return; } sync({ address: change.address, lastKnownAddress: change.address, network: change.network, isConnected: true }); }); return stop; }, [sync]); return null; }
