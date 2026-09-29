"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useOriginTrust } from "@/hooks/useOriginTrust";

/**
 * Displays the current hostname (punycode-aware) and network
 * beside each other so users can compare with their bookmarks.
 * Shows a warning when the origin is untrusted or the page is
 * framed.
 */
export function TrustedDomainIndicator() {
  const { t } = useTranslation();
  const { trustLevel, hostname, isFramed } = useOriginTrust();

  const network =
    process.env.NEXT_PUBLIC_NETWORK?.toUpperCase() ?? "TESTNET";

  return (
    <div
      data-testid="trusted-domain-indicator"
      className="flex flex-col gap-1 rounded border border-vx-border bg-vx-surface px-3 py-2 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="text-vx-muted">{t("originTrust.review.hostname", { hostname })}</span>
        <span
          className={
            trustLevel === "trusted"
              ? "text-vx-sage"
              : trustLevel === "untrusted"
                ? "text-rose-400"
                : "text-vx-muted"
          }
        >
          {trustLevel}
        </span>
      </div>

      <div className="flex items-center gap-2 text-vx-muted">
        {t("originTrust.review.network", { network })}
      </div>

      {isFramed && (
        <div
          role="alert"
          className="mt-1 rounded bg-rose-500/20 px-2 py-1 text-rose-300"
        >
          {t("originTrust.framing.breakout")}
        </div>
      )}

      {trustLevel === "untrusted" && (
        <div
          role="alert"
          className="mt-1 rounded bg-rose-500/20 px-2 py-1 text-rose-300"
        >
          {t("originTrust.review.untrustedWarning")}
        </div>
      )}
    </div>
  );
}
