"use client";

import Link from "next/link";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { useIntentLifecycle } from "@/hooks/useIntentLifecycle";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import {
  formatCountdown,
  retryHref,
  type TrackerPhase,
  type TrackerStep,
  type TrackerView,
} from "@/lib/intentLifecycle";
import type { IntentDetail } from "@/lib/types";

const STEP_KEY: Record<TrackerStep["id"], MessageKey> = {
  submitted: "tracker.step.submitted",
  accepted: "tracker.step.accepted",
  settled: "tracker.step.settled",
};

const PHASE_KEY: Record<TrackerPhase, MessageKey> = {
  pending: "tracker.phase.pending",
  accepted: "tracker.phase.accepted",
  filled: "tracker.phase.filled",
  failed: "tracker.phase.failed",
  expired: "tracker.phase.expired",
};

const GUIDANCE_KEY: Record<TrackerPhase, MessageKey> = {
  pending: "tracker.guidance.pending",
  accepted: "tracker.guidance.accepted",
  filled: "tracker.guidance.filled",
  failed: "tracker.guidance.failed",
  expired: "tracker.guidance.expired",
};

const BAR_CLASS: Record<TrackerStep["state"], string> = {
  complete: "bg-vx-sage",
  current: "bg-vx-sage/60 animate-pulse",
  upcoming: "bg-vx-line",
  failed: "bg-red-400",
  expired: "bg-amber-400",
};

function formatTime(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime())
    ? d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
    : null;
}

export type IntentTrackerViewProps = {
  intent: IntentDetail;
  view: TrackerView;
  /** Hide the "View details" link (e.g. already on /explore/[id]). */
  hideDetailsLink?: boolean;
  onDismiss?: () => void;
};

/** Presentational tracker; exported separately for stories and tests. */
export function IntentTrackerView({ intent, view, hideDetailsLink, onDismiss }: IntentTrackerViewProps) {
  const { t } = useTranslation();
  const canRetry = view.phase === "failed" || view.phase === "expired";

  return (
    <section
      aria-label={t("tracker.title")}
      className="card rounded-2xl border border-vx-line bg-vx-card p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">{t("tracker.title")}</div>
          <p className="text-sm text-vx-text num">
            {intent.srcAmount} {intent.srcToken} → {intent.dstToken}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <IntentStatusBadge status={intent.status} />
          {onDismiss && view.isTerminal && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("tracker.dismiss")}
              className="rounded p-1 text-vx-muted hover:text-vx-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-sage"
            >
              <span aria-hidden="true">×</span>
            </button>
          )}
        </div>
      </div>

      <ol className="flex items-start gap-2">
        {view.steps.map((step) => {
          const time = formatTime(step.at);
          const active = step.state === "current" || step.state === "failed" || step.state === "expired";
          return (
            <li
              key={step.id}
              className="flex-1 flex flex-col items-center gap-1"
              aria-current={active ? "step" : undefined}
            >
              <div aria-hidden="true" className={`w-full h-1.5 rounded-full ${BAR_CLASS[step.state]}`} />
              <span
                className={`text-[10px] font-medium text-center ${
                  step.state === "upcoming" ? "text-vx-dim" : "text-vx-text"
                }`}
              >
                {t(STEP_KEY[step.id])}
              </span>
              {time && <span className="text-[10px] text-vx-muted num">{time}</span>}
            </li>
          );
        })}
      </ol>

      <div role="status" aria-live="polite" className="space-y-1">
        <p
          className={`text-sm font-medium ${
            view.phase === "failed"
              ? "text-red-400"
              : view.phase === "expired"
                ? "text-amber-400"
                : "text-vx-text"
          }`}
        >
          {t(PHASE_KEY[view.phase])}
        </p>
        <p className="text-xs text-vx-muted">{t(GUIDANCE_KEY[view.phase])}</p>
      </div>

      {view.msRemaining !== null && (
        <p className="text-xs text-vx-muted num">
          {t("tracker.deadline", { time: formatCountdown(view.msRemaining) })}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        {canRetry && (
          <Link
            href={retryHref(intent)}
            className="rounded-lg bg-vx-sage px-3 py-1.5 text-xs font-semibold text-vx-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-vx-sage"
          >
            {t("tracker.retry")}
          </Link>
        )}
        {!hideDetailsLink && (
          <Link
            href={`/explore/${intent.id}`}
            className="text-xs text-vx-sage hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-sage"
          >
            {t("tracker.viewDetails")}
          </Link>
        )}
      </div>
    </section>
  );
}

export type IntentTrackerProps = Omit<IntentTrackerViewProps, "intent" | "view"> & {
  intentId: string;
};

/** Live tracker for one intent (REST + WebSocket, polling fallback). */
export function IntentTracker({ intentId, ...rest }: IntentTrackerProps) {
  const { t } = useTranslation();
  const { intent, view, isLoading, error } = useIntentLifecycle(intentId);

  if (!intent || !view) {
    return (
      <p role="status" className="text-xs text-vx-muted">
        {error && !isLoading ? t("tracker.unavailable") : t("tracker.loading")}
      </p>
    );
  }
  return <IntentTrackerView intent={intent} view={view} {...rest} />;
}
