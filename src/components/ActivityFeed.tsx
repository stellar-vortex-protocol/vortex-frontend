"use client";

import { useIntentFeed } from "@/hooks/useIntentFeed";
import { timeAgo } from "@/lib/time";

const CHAIN_COLOR: Record<string, string> = {
  ethereum: "#627EEA", base: "#0052FF", polygon: "#8247E5",
  arbitrum: "#12AAFF", optimism: "#FF0420", avalanche: "#E84142",
};

export function ActivityFeed() {
  const { items, isLoading, isLive } = useIntentFeed();

  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[52px] bg-vx-surface/40 rounded-lg border border-vx-line animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-[10px] text-vx-muted px-1">
        <span aria-hidden="true" className={`state-dot ${isLive ? "bg-vx-sage" : "bg-vx-dim"}`} />
        {isLive ? "Live" : "Polling"}
      </div>
      {items.slice(0, 6).map((item) => {
        const color = CHAIN_COLOR[item.srcChain] ?? "#8B8B93";
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
              <div className="text-[10px] text-vx-muted capitalize">
                {item.srcChain} · via {item.solver}
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
