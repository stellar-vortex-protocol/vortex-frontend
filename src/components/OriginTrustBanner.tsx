"use client";

import { useTranslation } from "@/lib/i18n/I18nProvider";
import { useOriginTrust } from "@/hooks/useOriginTrust";

/**
 * Persistent, non-dismissible banner shown when the app is served
 * from an untrusted origin (look-alike domain, IPFS gateway mirror,
 * iframe/proxy).  Displays the canonical URL so the user can
 * navigate to the legitimate site and explains the risk.
 */
export function OriginTrustBanner() {
  const { t } = useTranslation();
  const { trustLevel, hostname, isFramed } = useOriginTrust();

  if (trustLevel !== "untrusted") return null;

  const canonicalBase =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "https://vortexprotocol.org";

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="origin-trust-banner"
      className="fixed top-0 left-0 right-0 z-[200] flex items-center justify-center gap-3 px-4 py-3 text-sm font-medium bg-rose-500/95 text-rose-950"
    >
      {/* Warning icon */}
      <svg
        aria-hidden="true"
        className="w-5 h-5 flex-shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>

      <span className="flex-1 text-center">
        {t("originTrust.banner.description")}
      </span>

      <a
        href={canonicalBase}
        className="underline font-semibold hover:no-underline"
      >
        {t("originTrust.banner.canonicalUrl", { url: canonicalBase })}
      </a>

      {isFramed && (
        <span className="sr-only">
          {t("originTrust.banner.framed")}
        </span>
      )}
    </div>
  );
}
