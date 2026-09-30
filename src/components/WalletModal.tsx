"use client";

import { useEffect, useRef } from "react";
import { walletOptions } from "@/lib/wallet";
import { useWalletStore } from "@/store/wallet";

export function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const selectWallet = useWalletStore((state) => state.selectWallet);
  const connect = useWalletStore((state) => state.connect);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) first.current?.focus(); }, [open]);
  if (!open) return null;
  return <div role="dialog" aria-modal="true" aria-labelledby="wallet-modal-title" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onKeyDown={(event) => { if (event.key === "Escape") onClose(); }}>
    <div className="w-full max-w-md rounded-xl border border-vx-border bg-vx-panel p-5 shadow-xl">
      <div className="mb-4 flex items-center justify-between"><h2 id="wallet-modal-title" className="text-lg font-semibold">Choose a wallet</h2><button type="button" onClick={onClose} aria-label="Close wallet chooser">×</button></div>
      <div role="listbox" aria-label="Available wallets" className="grid gap-2">
        {walletOptions.map((wallet, index) => <div key={wallet.id} className="flex items-center justify-between rounded-lg border border-vx-border p-3"><button ref={index === 0 ? first : undefined} type="button" role="option" aria-selected={false} className="text-left font-medium" onClick={() => { selectWallet(wallet.id); onClose(); void connect(); }}>{wallet.name}</button><a href={wallet.installUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-vx-muted">Install</a></div>)}
      </div>
    </div>
  </div>;
}
