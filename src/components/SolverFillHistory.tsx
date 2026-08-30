import { useIntentFeed } from "@/hooks/useIntentFeed";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { timeAgo } from "@/lib/time";
import type { FeedItem } from "@/lib/types";

export function SolverFillHistory({ solverAddress }: { solverAddress: string }) {
  const { items: fillHistory, isLoading, error } = useIntentFeed();

  const solverFills = fillHistory
    .filter((item: FeedItem) => item.solver === solverAddress)
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 bg-vx-surface/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="p-6 text-center text-sm text-vx-muted">
        Couldn&apos;t load fill history right now.
      </div>
    );
  }

  if (solverFills.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-vx-muted">
        No fills from this solver in the history.
      </div>
    );
  }

  return (
    <div className="divide-y divide-vx-line">
      {solverFills.map((fill: FeedItem) => (
        <div
          key={fill.id}
          className="px-4 py-4 hover:bg-vx-surface/30 transition-colors"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="num text-xs text-vx-muted mb-1 truncate">
                  ID: {fill.id}
                </div>
                <div className="text-xs font-medium text-vx-text capitalize">
                  {fill.srcAmount} {fill.srcToken} → {fill.dstToken}
                </div>
              </div>
              <IntentStatusBadge status={fill.status} />
            </div>
            <div className="text-xs text-vx-muted">
              {fill.srcChain} · {timeAgo(fill.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
