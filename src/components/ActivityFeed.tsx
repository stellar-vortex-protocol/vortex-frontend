"use client";

import { useMemo } from "react";
import { useIntentFeed } from "@/hooks/useIntentFeed";
import { SkeletonCard } from "@/components/Skeleton";
import { DEFAULT_CHAIN_COLOR, getChainMeta } from "@/lib/marketData";
import { timeAgo } from "@/lib/time";

/** Maximum number of activity items shown in the feed. */
const FEED_LIMIT = 6;

export function ActivityFeed() {
  const { items, isLoading, error, isLive } = useIntentFeed();

  /**
   * Memoized slice of the most recent feed items.
   * Avoids recreating the array on every render when `items` reference is stable.
   */
  const visibleItems = useMemo(() => items.slice(0, FEED_LIMIT), [items]);

  if (isLoading && items.length === 0) {
    return <SkeletonCard rows={3} />;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] text-vx-muted px-1">
        <span aria-hidden="true" className={`state-dot ${isLive ? "bg-vx-sage" : "bg-vx-dim"}`} />
        {isLive ? "Live" : "Polling"}
      </div>
      {error && items.length === 0 ? (
        <div className="p-4 text-center text-xs text-vx-muted bg-vx-surface/40 rounded-lg border border-vx-line">
          Live feed unavailable right now.
        </div>
      ) : items.length === 0 ? (
        <div className="p-4 text-center text-xs text-vx-muted bg-vx-surface/40 rounded-lg border border-vx-line">
          No fills yet.
        </div>
      ) : null}
      {visibleItems.map((item) => {
        const chain = getChainMeta(item.srcChain);
        const color = chain?.color ?? DEFAULT_CHAIN_COLOR;
        return (
          <div key={item.id} className="flex items-center gap-3 p-3 bg-vx-surface/40 rounded-lg
                                  border border-vx-line hover:border-vx-border transition-colors">
            <div aria-hidden="true" className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: `${color}20`, border: `1px solid ${color}30` }}>
              <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-vx-text truncate">
                {item.srcAmount} {item.srcToken} → {item.dstToken}
              </div>
              <div className="text-[10px] text-vx-muted">
                {chain?.name ?? item.srcChain} · via {item.solver}
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span aria-hidden="true" className="state-dot bg-vx-sage" />
              <span className="text-[10px] text-vx-muted">{timeAgo(item.createdAt)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
