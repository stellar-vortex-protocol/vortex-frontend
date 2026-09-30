"use client";

import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { explorerUrl } from "@/lib/explorerLinks";
import { sanitizeDisplayText } from "@/lib/textSafety";
import { timeAgo } from "@/lib/time";
import { formatDuration, type TimelineStep } from "@/lib/timeline";

const DOT_CLASS: Record<TimelineStep["state"], string> = {
  done: "bg-vx-sage border-vx-sage",
  current: "bg-transparent border-vx-sage animate-pulse",
  upcoming: "bg-transparent border-vx-border",
  skipped: "bg-transparent border-vx-border border-dashed",
};

/** Presentational lifecycle timeline; reusable for solver history (#443). */
export function Timeline({ steps, network }: { steps: TimelineStep[]; network?: string }) {
  const { t } = useTranslation();
  const now = useLiveRelativeTime();

  return (
    <ol aria-label={t("timeline.label")} className="space-y-4">
      {steps.map((step) => {
        const solverHref = step.solver ? explorerUrl("account", step.solver, network) : null;
        return (
          <li key={step.key} className="flex gap-3" aria-current={step.state === "current" ? "step" : undefined}>
            <span aria-hidden="true" className={`mt-1 h-3 w-3 flex-shrink-0 rounded-full border-2 ${DOT_CLASS[step.state]}`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className={`text-sm font-medium ${step.state === "upcoming" || step.state === "skipped" ? "text-vx-muted" : "text-vx-text"}`}>
                  {t(`timeline.step.${step.key}`)}
                </span>
                <span className="sr-only">{t(`timeline.state.${step.state}`)}</span>
                {step.durationMs !== null && (
                  <span className="text-[11px] text-vx-muted num">
                    {t("timeline.after", { duration: formatDuration(step.durationMs) })}
                  </span>
                )}
              </div>
              {step.at ? (
                <time dateTime={step.at} className="block text-xs text-vx-muted num">
                  {new Date(step.at).toLocaleString()} · {timeAgo(step.at, now)}
                </time>
              ) : (
                step.state !== "upcoming" && (
                  <span className="block text-xs text-vx-dim">
                    {step.state === "skipped" ? t("timeline.skipped") : t("timeline.noTimestamp")}
                  </span>
                )
              )}
              {step.solver && (
                <span className="block text-xs text-vx-muted break-all">
                  {t("timeline.solver")}{" "}
                  {solverHref ? (
                    <a href={solverHref} target="_blank" rel="noopener noreferrer" className="text-vx-sage hover:underline">
                      {sanitizeDisplayText(step.solver)}
                    </a>
                  ) : (
                    sanitizeDisplayText(step.solver)
                  )}
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
