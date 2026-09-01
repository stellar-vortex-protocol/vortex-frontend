"use client";

import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";

const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";

export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const {
    address,
    isConnected,
    isConnecting,
    error,
    networkMismatch,
    notInstalled,
    wasSessionCleared,
    connect,
    disconnect,
  } = useWalletStore();

  const displayError = error ?? null;

  const handleConnect = async () => {
    await connect();
    const { error: latestError } = useWalletStore.getState();
    if (latestError) {
      useToastStore.getState().addToast(latestError, "error");
    }
  };

  // Tooltip carries the underlying failure text; the button label itself only
  // switches between "Connect" and "Retry".
  const displayError = errorKey ? t(errorKey) : error;

  const baseClass = compact
    ? "px-3 py-1.5 text-xs rounded-lg border transition-all"
    : "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all duration-150";

  if (isConnected && address) {
    return (
      <div className="flex flex-col items-end gap-1">
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

        <QrCode
          value={address}
          label={`QR code for wallet address ${truncateAddress(address)}`}
          size={160}
        />

        {networkMismatch && (
          <p role="alert" className="text-xs text-yellow-400">
            ⚠ Wrong network. Switch Freighter to <span className="font-semibold">{process.env.NEXT_PUBLIC_NETWORK ?? "testnet"}</span>.
          </p>
        )}
      </div>
    );
  }

  if (wasSessionCleared && !address && !isConnected) {
    return (
      <button
        type="button"
        onClick={handleConnect}
        className={`${baseClass} border-vx-border text-vx-muted hover:border-vx-sage/30 hover:text-vx-text disabled:opacity-60 disabled:cursor-wait`}
      >
        Reconnect {truncateAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ23456")}
      </button>
    );
  }

  if (notInstalled) {
    return (
      <a
        href={FREIGHTER_INSTALL_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Install the Freighter browser extension"
        className={`${baseClass} border-vx-border text-vx-muted hover:border-vx-sage/30 hover:text-vx-text`}
      >
        {!compact && (
          <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
        Install Freighter
      </a>
    );
  }

  // After a persisted session could not be silently restored, prompt to
  // reconnect and show which address we last saw.
  const reconnectLabel =
    !isConnected && wasSessionCleared && lastKnownAddress
      ? `Reconnect ${truncateAddress(lastKnownAddress)}`
      : null;

  return (
    <button
      type="button"
      onClick={handleConnect}
      disabled={isConnecting}
      title={error ?? undefined}
      className={`${baseClass} border-vx-border text-vx-muted hover:border-vx-sage/30 hover:text-vx-text disabled:opacity-60 disabled:cursor-wait`}
    >
      {isConnecting ? (
        <>
          <svg
            aria-hidden="true"
            className="w-3.5 h-3.5 animate-spin-slow flex-shrink-0"
            viewBox="0 0 16 16"
            fill="none"
          >
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="28" strokeDashoffset="8" />
          </svg>
          <span>Connecting</span>
          <span aria-hidden="true" className="inline-flex gap-0.5 items-end h-4">
            <span className="w-0.5 h-0.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
            <span className="w-0.5 h-0.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
            <span className="w-0.5 h-0.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
          </span>
        </>
      ) : (
        <>
          {!compact && (
            <svg aria-hidden="true" className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          )}
          {reconnectLabel ?? (error ? "Retry Connection" : "Connect Freighter")}
        </>
      )}
    </button>
  );
}
