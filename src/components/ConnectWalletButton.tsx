"use client";

import { useEffect } from "react";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { truncateAddress } from "@/lib/stellarAddress";
import type { WalletErrorKind } from "@/lib/wallet";
import { QrCode } from "./QrCode";

const FREIGHTER_INSTALL_URL = "https://www.freighter.app/";
const FREIGHTER_CHROME_URL =
  "https://chromewebstore.google.com/detail/freighter/bcacfldlkkdogcmkkibnjlakofdplcbk";
const FREIGHTER_FIREFOX_URL = "https://addons.mozilla.org/firefox/addon/freighter/";

/**
 * Store link for the current browser. Mobile browsers can't run the extension,
 * so they (and unknown browsers) get the Freighter homepage.
 */
export function freighterInstallUrl(
  userAgent: string = typeof navigator === "undefined" ? "" : navigator.userAgent,
): string {
  if (/Android|iPhone|iPad|Mobile/i.test(userAgent)) return FREIGHTER_INSTALL_URL;
  if (/Firefox\//.test(userAgent)) return FREIGHTER_FIREFOX_URL;
  if (/Chrome\/|Chromium\/|Edg\//.test(userAgent)) return FREIGHTER_CHROME_URL;
  return FREIGHTER_INSTALL_URL;
}

const expectedNetwork = () => process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

/** Kind-specific "what happened / what to do next" copy, announced to AT. */
function WalletErrorGuidance({ kind }: { kind: WalletErrorKind }) {
  const { t } = useTranslation();
  return (
    <p role="alert" className="max-w-xs text-right text-xs text-red-300">
      {t(`wallet.error.${kind}`)}{" "}
      {t(`wallet.errorHint.${kind}`, { network: expectedNetwork() })}
    </p>
  );
}

const NETWORK_CHECK_INTERVAL_MS = 8000;

export function ConnectWalletButton({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation();
  const {
    address,
    isConnected,
    isConnecting,
    error,
    errorKind,
    errorKey,
    lastKnownAddress,
    networkMismatch,
    notInstalled,
    wasSessionCleared,
    connect,
    disconnect,
  } = useWalletStore();

  const handleConnect = async () => {
    await connect();
    const { error: latestError, errorKey: latestKey } = useWalletStore.getState();
    if (latestError) {
      useToastStore.getState().addToast(latestKey ? t(latestKey) : latestError, "error");
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
          <span
            aria-hidden="true"
            className="inline-block w-1.5 h-1.5 rounded-full bg-vx-sage mr-1.5 align-middle"
          />
          <span
            aria-hidden="true"
            className="group-hover:hidden group-focus-visible:hidden"
          >
            {truncateAddress(address)}
          </span>
          <span
            aria-hidden="true"
            className="hidden group-hover:inline group-focus-visible:inline"
          >
            Disconnect
          </span>
        </button>

        <QrCode
          value={address}
          label={`QR code for wallet address ${truncateAddress(address)}`}
          size={160}
        />

        {networkMismatch && (
          <p role="alert" className="text-xs text-yellow-400">
            <span aria-hidden="true">⚠ </span>
            {t("wallet.networkMismatch", { network: expectedNetwork() })}
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
      <div className="flex flex-col items-end gap-1">
        <a
          href={freighterInstallUrl()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t("wallet.action.installAria")}
          className={`${baseClass} border-vx-border text-vx-muted hover:border-vx-sage/30 hover:text-vx-text`}
        >
          {!compact && (
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M8 5v3l2 2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          )}
          {t("wallet.action.install")}
        </a>
        <WalletErrorGuidance kind="not-installed" />
      </div>
    );
  }

  // After a persisted session could not be silently restored, prompt to
  // reconnect and show which address we last saw.
  const reconnectLabel =
    !isConnected && wasSessionCleared && lastKnownAddress
      ? `Reconnect ${truncateAddress(lastKnownAddress)}`
      : null;

  const retryLabel =
    errorKind === "locked" ? t("wallet.action.unlockedRetry") : t("wallet.connect.retry");

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        title={displayError ?? undefined}
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
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                viewBox="0 0 16 16"
                fill="none"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 5v3l2 2"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {reconnectLabel ?? (errorKind ? retryLabel : t("wallet.connect.cta"))}
          </>
        )}
      </button>
      {errorKind && !isConnecting && <WalletErrorGuidance kind={errorKind} />}
    </div>
  );
}
