"use client";

// NOTE on data source: this component filters the shared useIntentFeed (8-item
// cap) by solver address. For a prolific solver, this will under-represent their
// full fill history because the cap is hit by unrelated intents.  A future
// iteration should use a dedicated `/solvers/{address}/fills` REST endpoint
// (unbounded or paginated) rather than the broadcast feed — tracked separately.

import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { useIntentFeed } from "@/hooks/useIntentFeed";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { timeAgo } from "@/lib/time";
import type { FeedItem } from "@/lib/types";

export type SolverFillHistoryProps = {
  /** Stellar address of the solver whose fills to display. */
  solverAddress: string;
};

export function SolverFillHistory({ solverAddress }: SolverFillHistoryProps) {
  const { t } = useTranslation();
  const { items: fillHistory, isLoading, error } = useIntentFeed();

  const solverFills = (fillHistory || [])
    .filter((item: FeedItem) => item.solver === solverAddress)
    .slice(0, 10);

  if (isLoading && (!fillHistory || fillHistory.length === 0)) {
    return (
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-vx-border bg-vx-surface/30">
          <h2 className="text-sm font-semibold text-vx-text">
            Recent Fills by Solver
          </h2>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 bg-vx-surface/40 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="p-6 sm:p-8 text-center text-sm text-vx-muted">
          Couldn&apos;t load fill history right now.
        </div>
      ) : solverFills.length === 0 ? (
        <div className="p-6 sm:p-8 text-center">
          <p className="text-sm font-medium text-vx-text mb-1">
            {t("solverDetail.fillHistory.empty.title")}
          </p>
          <p className="text-xs text-vx-muted max-w-xs mx-auto">
            {t("solverDetail.fillHistory.empty.message")}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-vx-line">
          {solverFills.slice(0, 10).map((fill) => (
            <div
              key={fill.id}
              className="px-4 sm:px-5 py-4 hover:bg-vx-surface/30 transition-colors"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-vx-text truncate">
                    {fill.srcAmount} {fill.srcToken} → {fill.dstToken}
                  </div>
                  <div className="text-xs text-vx-muted capitalize">
                    {fill.srcChain}
                  </div>
                </div>
                <span className="text-xs text-vx-muted num flex-shrink-0">
                  {timeAgo(fill.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
