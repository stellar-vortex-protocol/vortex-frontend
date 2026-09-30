"use client";

import { diffSegments, type AddressAssessment } from "@/lib/addressRisk";
import { useTranslation } from "@/lib/i18n/I18nProvider";

function differingPositions(a: string, b: string): number[] {
  const positions: number[] = [];
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) positions.push(i + 1);
  return positions;
}

function Highlighted({ value, other }: { value: string; other: string }) {
  return (
    <code dir="ltr" className="block break-all font-mono text-[11px] leading-relaxed text-vx-text">
      {diffSegments(value, other).map((seg, i) =>
        seg.differs ? (
          <mark key={i} className="rounded-sm bg-amber-400/30 text-amber-200 px-[1px]">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </code>
  );
}

/**
 * Side-by-side comparison of an entered address and the known address it
 * resembles, with differing characters highlighted and listed for screen readers.
 */
export function AddressDiff({ candidate, known }: { candidate: string; known: string }) {
  const { t } = useTranslation();
  const positions = differingPositions(candidate, known);
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div>
        <div className="text-[10px] uppercase tracking-wider text-vx-muted mb-1">{t("addressRisk.entered")}</div>
        <Highlighted value={candidate} other={known} />
      </div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-vx-muted mb-1">{t("addressRisk.known")}</div>
        <Highlighted value={known} other={candidate} />
      </div>
      <p className="sr-only">
        {t("addressRisk.differingPositions", { positions: positions.join(", ") || "—" })}
      </p>
    </div>
  );
}

/** Blocking-but-dismissible warning shown for a `high` risk assessment. */
export function AddressRiskWarning({
  candidate,
  assessment,
  onDismiss,
}: {
  candidate: string;
  assessment: AddressAssessment;
  onDismiss: () => void;
}) {
  const { t } = useTranslation();
  if (assessment.risk !== "high" || !assessment.lookalike) return null;
  return (
    <div
      role="alert"
      aria-labelledby="address-risk-title"
      className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-3 space-y-2"
    >
      <p id="address-risk-title" className="text-xs font-semibold text-amber-300">
        {t("addressRisk.title")}
      </p>
      <p className="text-[11px] text-vx-muted">{t("addressRisk.body")}</p>
      <AddressDiff candidate={candidate.trim().toUpperCase()} known={assessment.lookalike} />
      <button
        type="button"
        onClick={onDismiss}
        className="text-[11px] font-semibold px-3 py-1.5 rounded-md border border-amber-400/40 text-amber-200 hover:bg-amber-500/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        {t("addressRisk.dismiss")}
      </button>
    </div>
  );
}
