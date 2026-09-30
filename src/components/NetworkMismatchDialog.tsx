"use client";
import { useEffect, useRef } from "react";
import { useWalletStore } from "@/store/wallet";
import { normalizeNetwork } from "@/lib/network";

export function NetworkMismatchDialog({ open, onClose }: { open: boolean; onClose?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const hydrate = useWalletStore((state) => state.hydrate);
  const network = useWalletStore((state) => state.network);
  useEffect(() => { if (open) ref.current?.focus(); }, [open]);
  if (!open) return null;
  const expected = normalizeNetwork(process.env.NEXT_PUBLIC_NETWORK ?? "testnet");
  return <div role="dialog" aria-modal="true" aria-labelledby="network-mismatch-title" className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
    <div className="max-w-md rounded-xl border border-yellow-500/40 bg-vx-panel p-5">
      <h2 id="network-mismatch-title" className="text-lg font-semibold">Switch wallet network</h2>
      <p className="mt-2 text-sm text-vx-muted">This app expects <strong>{expected}</strong>, but your wallet reports <strong>{normalizeNetwork(network)}</strong>. Open your wallet, select the expected network, then re-check.</p>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => { void hydrate(); }} ref={ref} className="rounded border px-3 py-2">Re-check</button>{onClose && <button type="button" onClick={onClose} className="rounded border px-3 py-2">Close</button>}</div>
    </div>
  </div>;
}
