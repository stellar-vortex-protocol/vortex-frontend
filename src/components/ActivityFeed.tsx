"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useIntentFeed } from "@/hooks/useIntentFeed";
import { useBufferedFeed, useFeedPause } from "@/hooks/useBufferedFeed";
import { useLiveRelativeTime } from "@/hooks/useLiveRelativeTime";
import { LiveFeedControls } from "@/components/LiveFeedControls";
import { timeAgo } from "@/lib/time";

const CHAIN_COLOR: Record<string, string> = {
  ethereum: "#627EEA",
  base: "#0052FF",
  polygon: "#8247E5",
  arbitrum: "#12AAFF",
  optimism: "#FF0420",
  avalanche: "#E84142",
};

/** Maximum number of activity items shown in the feed. */
const FEED_LIMIT = 6;

/** How long to wait for a burst of arrivals to settle before announcing them. */
const ANNOUNCE_DEBOUNCE_MS = 1500;

type ActivityFeedViewProps = ReturnType<typeof useIntentFeed> & { now?: number };

export function ActivityFeedView({ items: liveItems, isLoading, error, isLive, now = Date.now() }: ActivityFeedViewProps) {
  const pause = useFeedPause("home-activity");
  const { visible: items, pending, overflow, flush } = useBufferedFeed(liveItems, { isPaused: pause.isPaused });

  // === Debounced live-region announcement for newly arrived fills
  const [announcement, setAnnouncement] = useState("");
  const knownIdsRef = useRef<Set<string> | null>(null);
  const pendingCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const currentIds = new Set(liveItems.map((item) => item.id));
    // The first snapshot is the baseline - it is not "new" activity.
    if (knownIdsRef.current === null) {
      knownIdsRef.current = currentIds;
      return;
    }
    let arrived = 0;
    for (const id of currentIds) if (!knownIdsRef.current.has(id)) arrived += 1;
    knownIdsRef.current = currentIds;
    if (arrived === 0) return;

    pendingCountRef.current += arrived;
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const count = pendingCountRef.current;
      pendingCountRef.current = 0;
      setAnnouncement(count === 1 ? "1 new fill" : `${count} new fills`);
    }, ANNOUNCE_DEBOUNCE_MS);
  }, [liveItems]);

  useEffect(() => () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
  }, []);

  const visibleItems = useMemo(() => items.slice(0, FEED_LIMIT), [items]);

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
    <div className="space-y-2 focus:outline-none" {...pause.containerProps}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-1.5 text-[10px] text-vx-muted">
          <span aria-hidden="true" className={`state-dot ${isLive ? "bg-vx-sage" : "bg-vx-dim"}`} />
          {isLive ? "Live" : "Polling"}
        </div>
        <LiveFeedControls
          userPaused={pause.userPaused}
          onToggle={pause.toggle}
          pending={pending}
          overflow={overflow}
          onFlush={() => {
            flush();
            pause.containerRef.current?.focus();
          }}
          announce={false}
        />
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {/* Error / empty states */}
      {error && items.length === 0 ? (
        <div className="p-4 text-center text-xs text-vx-muted bg-vx-surface/40 rounded-lg border border-vx-line">
          Live feed unavailable right now.
        </div>
      ) : items.length === 0 ? (
        <div className="p-4 text-center text-xs text-vx-muted bg-vx-surface/40 rounded-lg border border-vx-line">
          No fills yet.
        </div>
      ) : null}

      {/* Feed rows */}
      {visibleItems.map((item) => {
        const color = CHAIN_COLOR[item.srcChain] ?? "#8B8B93";
        return (
          <div
            key={item.id}
            className="flex items-center gap-3 p-3 bg-vx-surface/40 rounded-lg
                       border border-vx-line hover:border-vx-border transition-colors"
          >
            <div
              aria-hidden="true"
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}20`, border: `1px solid ${color}30` }}
            >
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
              <span
                className="text-[10px] text-vx-muted"
                title={new Date(item.createdAt).toLocaleString()}
              >
                {timeAgo(item.createdAt, now)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ActivityFeed() {
  const feed = useIntentFeed();
  const now = useLiveRelativeTime();
  return <ActivityFeedView {...feed} now={now} />;
}
