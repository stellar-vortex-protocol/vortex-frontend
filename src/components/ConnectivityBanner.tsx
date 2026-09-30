"use client";

import { useEffect, useRef, useState } from "react";
import { useConnectivity } from "@/hooks/useConnectivity";
import { useAnnounce } from "@/components/Announcer";
import { useTranslation } from "@/lib/i18n/I18nProvider";

/**
 * App-wide offline/connectivity-loss banner.
 *
 * Mounts once (in layout.tsx alongside WalletHydrator / ToastViewport) and
 * listens for browser online/offline events via `useConnectivity`. Shows a
 * persistent, accessible banner while the user is offline and automatically
 * dismisses it a moment after connectivity is restored.
 *
 * When offline, the banner also surfaces the timestamp of the last successful
 * data refresh (published by the service worker / data layer via the
 * `vx:last-updated` window event) so users know how stale the cached feed is.
 * Submissions are blocked while offline — the banner makes that explicit.
 *
 * The banner is dismissed automatically on reconnect (after a brief grace
 * period) and does NOT need a manual close button in the offline state — the
 * act of coming back online is the dismissal signal.
 *
 * Connectivity changes are also routed through the central Announcer so screen
 * readers hear a single, deduplicated, polite announcement per transition
 * (see docs/accessibility.md for the live-region policy).
 */
export function ConnectivityBanner() {
  const { t } = useTranslation();
  const { connectivity } = useConnectivity();
  const [visible, setVisible] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const announce = useAnnounce();

  // Track the last successful data refresh so the offline banner can show
  // "offline — last updated X". The service worker / data layer dispatches
  // `vx:last-updated` with a `detail.timestamp` (ms since epoch).
  useEffect(() => {
    const onLastUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ timestamp?: number }>).detail;
      if (detail && typeof detail.timestamp === "number") {
        setLastUpdated(detail.timestamp);
      }
    };
    window.addEventListener("vx:last-updated", onLastUpdated);
    return () => window.removeEventListener("vx:last-updated", onLastUpdated);
  }, []);

  useEffect(() => {
    if (connectivity === "offline") {
      // Cancel any pending dismissal — we've gone offline again.
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
      setVisible(true);
      announce("You appear to be offline — reconnecting", {
        politeness: "polite",
        key: "connectivity",
        coalesceMs: 1000,
      });
    } else {
      // Give the user a moment to see the "back online" state before hiding.
      dismissTimerRef.current = setTimeout(() => {
        setVisible(false);
        dismissTimerRef.current = null;
      }, 2500);
      announce("Back online — refreshing data", {
        politeness: "polite",
        key: "connectivity",
        coalesceMs: 1000,
      });
    }

    return () => {
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }
    };
  }, [connectivity, announce]);

  if (!visible) return null;

  const isOffline = connectivity === "offline";

  const lastUpdatedLabel =
    lastUpdated !== null
      ? new Date(lastUpdated).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="connectivity-banner"
      data-connectivity={connectivity}
      className={`fixed bottom-0 left-0 right-0 z-[100] flex items-center justify-center
                  gap-2 px-4 py-3 text-sm font-medium transition-colors
                  ${isOffline
                    ? "bg-amber-500/95 text-amber-950"
                    : "bg-vx-sage/95 text-vx-ink"
                  }`}
    >
      {isOffline ? (
        <>
          {/* Offline icon */}
          <svg
            aria-hidden="true"
            className="w-4 h-4 flex-shrink-0"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M2 2l12 12M8 3C5.5 3 3.3 4.1 1.8 5.9M14.2 5.9C12.7 4.1 10.5 3 8 3m-3.8 3.9C5.2 6.3 6.5 6 8 6s2.8.3 3.8.9M5.5 9.5C6.2 9.2 7.1 9 8 9s1.8.2 2.5.5M8 12.5a.5.5 0 110-1 .5.5 0 010 1z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            {lastUpdatedLabel
              ? t("connectivity.offlineWithTimestamp", { timestamp: lastUpdatedLabel })
              : t("connectivity.offline")}
          </span>
        </>
      ) : (
        <>
          {/* Back-online checkmark */}
          <svg
            aria-hidden="true"
            className="w-4 h-4 flex-shrink-0"
            viewBox="0 0 16 16"
            fill="none"
          >
            <path
              d="M2.5 8.5l4 4 7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>{t("connectivity.online")}</span>
        </>
      )}
    </div>
  );
}
