"use client";

import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";

function truncateAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const { address, isConnected, isConnecting, error, connect, disconnect } = useWalletStore();

  const handleConnect = async () => {
    await connect();
    const latestError = useWalletStore.getState().error;
    if (latestError) {
      useToastStore.getState().addToast(latestError, "error");
    }
  };

  const baseClass = compact
    ? "px-3 py-1.5 text-xs rounded-lg border transition-all"
    : "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-150";

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        aria-label={`Disconnect wallet ${truncateAddress(address)}`}
        className={`${baseClass} border-vx-sage/40 text-vx-text hover:border-vx-sage/70 hover:text-red-300 focus-visible:text-red-300 group`}
      >
        <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-vx-sage mr-1.5 align-middle" />
        <span aria-hidden="true" className="group-hover:hidden group-focus-visible:hidden">{truncateAddress(address)}</span>
        <span aria-hidden="true" className="hidden group-hover:inline group-focus-visible:inline">Disconnect</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isConnecting}
      title={error ?? undefined}
      className={`${baseClass} border-vx-border text-vx-muted hover:border-vx-sage/30 hover:text-vx-text disabled:opacity-60 disabled:cursor-wait`}
    >
      {!compact && (
        <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {isConnecting ? "Connecting..." : error ? "Retry Connection" : "Connect Freighter"}
    </button>
  );
}
