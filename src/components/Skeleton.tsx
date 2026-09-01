/**
 * Skeleton – reusable loading placeholder components.
 *
 * Usage:
 *   <SkeletonBlock className="h-6 w-1/2" />
 *   <SkeletonText lines={3} />
 *   <SkeletonCard rows={4} rowHeight="h-14" />
 */

import { clsx } from "clsx";

// ─── SkeletonBlock ─────────────────────────────────────────────────────────────
// A single rectangular animated pulse placeholder.

interface SkeletonBlockProps {
  className?: string;
}

export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "bg-vx-surface/40 rounded-lg animate-pulse",
        className,
      )}
    />
  );
}

// ─── SkeletonText ──────────────────────────────────────────────────────────────
// A stack of text-line skeletons (mimics a paragraph or label group).

interface SkeletonTextProps {
  lines?: number;
  className?: string;
}

export function SkeletonText({ lines = 2, className }: SkeletonTextProps) {
  const widths = ["w-full", "w-5/6", "w-4/6", "w-3/4", "w-2/3"];
  return (
    <div aria-hidden="true" className={clsx("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={clsx("h-4 bg-vx-surface/40 rounded animate-pulse", widths[i % widths.length])}
        />
      ))}
    </div>
  );
}

// ─── SkeletonCard ──────────────────────────────────────────────────────────────
// A list of full-width row skeletons — used for table/feed loading states.

interface SkeletonCardProps {
  /** Number of skeleton rows to show */
  rows?: number;
  /** Tailwind height class for each row, e.g. "h-14" */
  rowHeight?: string;
  className?: string;
}

export function SkeletonCard({ rows = 3, rowHeight = "h-14", className }: SkeletonCardProps) {
  return (
    <div aria-hidden="true" className={clsx("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonBlock
          // eslint-disable-next-line react/no-array-index-key
          key={i}
          className={clsx(rowHeight, "border border-vx-line")}
        />
      ))}
    </div>
  );
}

export function IntentListSkeleton({ count = 5 }: { count?: number }) {
  return <SkeletonCard rows={count} rowHeight="h-16" />;
}

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return <SkeletonCard rows={count} rowHeight="h-12" />;
}

// ─── SkeletonDetailCard ────────────────────────────────────────────────────────
// Skeleton for a detail card (e.g. intent detail, solver detail header).

export function SkeletonDetailCard() {
  return (
    <div aria-hidden="true" className="card p-6 space-y-4 animate-pulse">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2 flex-1">
          <SkeletonBlock className="h-4 w-16" />
          <SkeletonBlock className="h-7 w-2/3" />
        </div>
        <SkeletonBlock className="h-6 w-20 rounded-full" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <div key={i} className="bg-vx-surface/40 rounded-lg p-3 space-y-2">
            <SkeletonBlock className="h-3 w-1/3" />
            <SkeletonBlock className="h-4 w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}
