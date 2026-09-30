import { useTranslation } from "@/lib/i18n/I18nProvider";

/**
 * Displays a solver identifier with verification status.
 * Shows a visual indicator and warning message if the solver is not verified.
 * Optionally shows the stellar.toml domain identity state (display only).
 */

import { Tooltip } from "@/components/Tooltip";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import type { SolverIdentity, SolverIdentityState } from "@/lib/solverIdentity";

interface SolverBadgeProps {
  solverAddress?: string | null;
  isVerified: boolean;
  displayName: string;
  showWarning?: boolean;
  className?: string;
  /** stellar.toml home-domain identity; omitted → no identity chip. */
  identity?: SolverIdentity;
}

const IDENTITY_STYLE: Record<SolverIdentityState, { icon: string; className: string }> = {
  verified: { icon: "✓", className: "bg-vx-sage-bg text-vx-sage border-vx-sage/30" },
  mismatch: { icon: "✕", className: "bg-red-500/10 text-red-400 border-red-400/30" },
  unavailable: { icon: "?", className: "bg-vx-surface text-vx-muted border-vx-border" },
  unverified: { icon: "–", className: "bg-vx-surface text-vx-muted border-vx-border" },
};

export function SolverIdentityChip({ identity }: { identity: SolverIdentity }) {
  const { t } = useTranslation();
  const style = IDENTITY_STYLE[identity.state];
  const domain =
    identity.domainUnicode && identity.domainUnicode !== identity.domain
      ? `${identity.domainUnicode} (${identity.domain})`
      : identity.domain ?? "";
  const tip = t(`solve.identity.tooltip.${identity.state}` as MessageKey, {
    domain,
    org: identity.orgName ?? domain,
  });
  return (
    <Tooltip content={tip}>
      <button
        type="button"
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage ${style.className}`}
      >
        <span aria-hidden="true">{style.icon}</span>
        {t(`solve.identity.state.${identity.state}` as MessageKey)}
        {identity.state === "verified" && identity.orgName ? (
          <span className="text-vx-muted font-normal truncate max-w-[10rem]">· {identity.orgName}</span>
        ) : null}
      </button>
    </Tooltip>
  );
}

export function SolverBadge({
  solverAddress,
  isVerified,
  displayName,
  showWarning = true,
  className = "",
  identity,
}: SolverBadgeProps) {
  const { t } = useTranslation();
  return (
    <div className={className}>
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <div
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
            isVerified
              ? "bg-vx-sage-bg text-vx-sage"
              : "bg-amber-500/10 text-amber-400 border border-amber-400/30"
          }`}
        >
          {!isVerified && (
            <svg
              aria-hidden="true"
              className="w-3 h-3 flex-shrink-0"
              viewBox="0 0 12 12"
              fill="none"
            >
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
              <path d="M6 3v4" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <circle cx="6" cy="9.5" r="0.5" fill="currentColor" />
            </svg>
          )}
          <span>{displayName}</span>
        </div>
        {identity && <SolverIdentityChip identity={identity} />}
      </div>
      {!isVerified && showWarning && (
        <p className="text-[11px] text-amber-400/80 mt-1.5">
          {t("solverBadge.unverified")}{" "}
          {solverAddress && (
            <span className="font-mono text-[10px] block mt-0.5 break-all">{solverAddress}</span>
          )}
        </p>
      )}
    </div>
  );
}
