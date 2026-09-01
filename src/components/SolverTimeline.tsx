"use client";

import { useMemo } from "react";
import type { FeedItem } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type SolverTimelineProps = {
  /** The solver whose fill history to visualise. */
  solverAddress: string;
  /**
   * All feed items — the component filters to the solver's fills itself.
   * Passing the full feed (already loaded by the page) avoids a second fetch.
   */
  fills: FeedItem[];
  /** True while the parent is still fetching. */
  isLoading?: boolean;
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Group fills by ISO week (YYYY-Wnn). Returns an array of {week, count} sorted oldest→newest. */
function groupByWeek(items: FeedItem[]): Array<{ week: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.createdAt);
    // ISO week number
    const dayOfYear = Math.floor(
      (d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 86_400_000
    );
    const week = `${d.getFullYear()}-W${String(Math.ceil(dayOfYear / 7)).padStart(2, "0")}`;
    map.set(week, (map.get(week) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
}

const SPARKLINE_W = 280;
const SPARKLINE_H = 48;
const DOT_R = 3;
const MARGIN = DOT_R + 2;

/** Convert weekly bucket counts to SVG polyline points. */
function toPoints(buckets: Array<{ count: number }>): string {
  if (buckets.length === 0) return "";
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const step = (SPARKLINE_W - 2 * MARGIN) / Math.max(buckets.length - 1, 1);
  return buckets
    .map((b, i) => {
      const x = MARGIN + i * step;
      const y = SPARKLINE_H - MARGIN - ((b.count / maxCount) * (SPARKLINE_H - 2 * MARGIN));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Return a short human-readable label for an ISO week string like "2025-W32". */
function weekLabel(isoWeek: string): string {
  // Parse the year and week number to derive the Monday of that week.
  const [yearStr, weekStr] = isoWeek.split("-W");
  const year = parseInt(yearStr ?? "2025", 10);
  const week = parseInt(weekStr ?? "1", 10);
  // Jan 4 is always in week 1 of its year (ISO 8601).
  const jan4 = new Date(year, 0, 4);
  const monday = new Date(jan4.getTime() + (week - 1) * 7 * 86_400_000);
  // Snap to that week's Monday.
  const dayOfWeek = monday.getDay(); // 0=Sun
  monday.setDate(monday.getDate() - ((dayOfWeek + 6) % 7));
  return monday.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── Component ──────────────────────────────────────────────────────────────

export function SolverTimeline({ solverAddress, fills, isLoading }: SolverTimelineProps) {
  // ── Derive solver-specific fills ────────────────────────────────────────
  const solverFills = useMemo(
    () => fills.filter(f => f.solver === solverAddress),
    [fills, solverAddress]
  );

  const buckets = useMemo(() => groupByWeek(solverFills), [solverFills]);

  // ── Milestones ──────────────────────────────────────────────────────────
  const firstFill = useMemo(
    () =>
      solverFills.length > 0
        ? solverFills.reduce((a, b) =>
            new Date(a.createdAt) < new Date(b.createdAt) ? a : b
          )
        : null,
    [solverFills]
  );

  const latestFill = useMemo(
    () =>
      solverFills.length > 0
        ? solverFills.reduce((a, b) =>
            new Date(a.createdAt) > new Date(b.createdAt) ? a : b
          )
        : null,
    [solverFills]
  );

  const successCount = useMemo(
    () => solverFills.filter(f => f.status === "filled").length,
    [solverFills]
  );

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-vx-border bg-vx-surface/30">
          <div className="h-4 w-32 bg-vx-surface rounded animate-pulse" />
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          <div className="h-12 bg-vx-surface rounded animate-pulse" />
          <div className="h-3 w-3/4 bg-vx-surface rounded animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Empty / just-getting-started ─────────────────────────────────────────
  if (solverFills.length === 0) {
    return (
      <div className="card overflow-hidden">
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-vx-border bg-vx-surface/30">
          <h2 className="text-sm font-semibold text-vx-text">Solver Timeline</h2>
        </div>
        <div className="p-6 sm:p-8 text-center">
          <div aria-hidden="true" className="mb-3 text-2xl">🌱</div>
          <p className="text-sm font-medium text-vx-text mb-1">Just getting started</p>
          <p className="text-xs text-vx-muted max-w-xs mx-auto">
            This solver hasn&apos;t filled any intents yet. Once they start filling, a
            week-by-week volume trend will appear here.
          </p>
        </div>
      </div>
    );
  }

  // ── Sparse data (1–2 fills) — still render but without a polyline curve ──
  const hasSufficientData = buckets.length >= 2;

  // Pre-compute sparkline geometry for rich data path.
  const points = hasSufficientData ? toPoints(buckets) : "";
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const step = (SPARKLINE_W - 2 * MARGIN) / Math.max(buckets.length - 1, 1);

  // ── Accessible text summary ──────────────────────────────────────────────
  const summaryText = [
    `Solver timeline: ${solverFills.length} fill${solverFills.length !== 1 ? "s" : ""} total`,
    firstFill
      ? `first fill ${new Date(firstFill.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : null,
    latestFill && latestFill.id !== firstFill?.id
      ? `most recent fill ${new Date(latestFill.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : null,
    `${successCount} successful fill${successCount !== 1 ? "s" : ""}`,
    hasSufficientData
      ? `weekly fill counts: ${buckets.map(b => `${weekLabel(b.week)}: ${b.count}`).join(", ")}`
      : null,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-vx-border bg-vx-surface/30">
        <h2 className="text-sm font-semibold text-vx-text">Solver Timeline</h2>
        <p className="text-[10px] text-vx-muted mt-0.5">
          Based on available feed data — registration date not yet exposed by the API
        </p>
      </div>

      <div className="p-4 sm:p-5 space-y-5">
        {/* Milestones list */}
        <ol className="relative border-l border-vx-border ml-2 space-y-3" aria-label="Solver milestones">
          {firstFill && (
            <li className="ml-4">
              <span
                aria-hidden="true"
                className="absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full bg-vx-sage border-2 border-vx-ink"
              />
              <p className="text-xs font-semibold text-vx-text">
                First fill
                <span className="text-vx-muted ml-1 font-normal">
                  (proxy for registration — earliest known fill)
                </span>
              </p>
              <time
                dateTime={firstFill.createdAt}
                className="text-[10px] text-vx-muted num"
              >
                {new Date(firstFill.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
              <p className="text-[10px] text-vx-muted mt-0.5">
                {firstFill.srcAmount} {firstFill.srcToken} → {firstFill.dstToken}
              </p>
            </li>
          )}

          {solverFills.length >= 5 && (
            <li className="ml-4">
              <span
                aria-hidden="true"
                className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-vx-lav border-2 border-vx-ink"
              />
              <p className="text-xs font-semibold text-vx-text">5 fills milestone</p>
              <p className="text-[10px] text-vx-muted">Gaining traction</p>
            </li>
          )}

          {solverFills.length >= 10 && (
            <li className="ml-4">
              <span
                aria-hidden="true"
                className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-vx-ink"
              />
              <p className="text-xs font-semibold text-vx-text">10 fills milestone</p>
              <p className="text-[10px] text-vx-muted">Established solver</p>
            </li>
          )}

          {latestFill && latestFill.id !== firstFill?.id && (
            <li className="ml-4">
              <span
                aria-hidden="true"
                className="absolute -left-[5px] w-2.5 h-2.5 rounded-full bg-vx-sage/50 border-2 border-vx-ink"
              />
              <p className="text-xs font-semibold text-vx-text">Most recent fill</p>
              <time
                dateTime={latestFill.createdAt}
                className="text-[10px] text-vx-muted num"
              >
                {new Date(latestFill.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </time>
            </li>
          )}
        </ol>

        {/* Weekly volume sparkline */}
        <div>
          <p className="text-[10px] text-vx-muted mb-2 uppercase tracking-wide">
            Weekly fill volume
          </p>

          {/* Screen-reader summary — hides the SVG from AT */}
          <p className="sr-only">{summaryText}</p>

          {hasSufficientData ? (
            <svg
              aria-hidden="true"
              width={SPARKLINE_W}
              height={SPARKLINE_H}
              viewBox={`0 0 ${SPARKLINE_W} ${SPARKLINE_H}`}
              className="w-full h-auto overflow-visible"
            >
              {/* Zero baseline */}
              <line
                x1={MARGIN}
                y1={SPARKLINE_H - MARGIN}
                x2={SPARKLINE_W - MARGIN}
                y2={SPARKLINE_H - MARGIN}
                stroke="var(--color-vx-border, #2a2f3e)"
                strokeWidth="1"
              />

              {/* Fill area under sparkline */}
              <defs>
                <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-vx-sage, #4ade80)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--color-vx-sage, #4ade80)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                points={`${MARGIN},${SPARKLINE_H - MARGIN} ${points} ${
                  MARGIN + (buckets.length - 1) * step
                },${SPARKLINE_H - MARGIN}`}
                fill="url(#spark-fill)"
                stroke="none"
              />

              {/* Sparkline itself */}
              <polyline
                points={points}
                fill="none"
                stroke="var(--color-vx-sage, #4ade80)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Dots at each data point */}
              {buckets.map((b, i) => {
                const x = MARGIN + i * step;
                const y =
                  SPARKLINE_H -
                  MARGIN -
                  (b.count / maxCount) * (SPARKLINE_H - 2 * MARGIN);
                return (
                  <circle
                    key={b.week}
                    cx={x.toFixed(1)}
                    cy={y.toFixed(1)}
                    r={DOT_R}
                    fill="var(--color-vx-sage, #4ade80)"
                    stroke="var(--color-vx-ink, #080C14)"
                    strokeWidth="1.5"
                  />
                );
              })}
            </svg>
          ) : (
            /* Sparse: just show a single data point with context text */
            <div className="flex items-center gap-3 py-2">
              <span
                aria-hidden="true"
                className="w-2.5 h-2.5 rounded-full bg-vx-sage flex-shrink-0"
              />
              <span className="text-xs text-vx-muted">
                {solverFills.length} fill{solverFills.length !== 1 ? "s" : ""} —
                chart will populate as more data arrives
              </span>
            </div>
          )}

          {/* X-axis labels: first and last week */}
          {hasSufficientData && (
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-vx-muted num">
                {weekLabel(buckets[0]!.week)}
              </span>
              <span className="text-[9px] text-vx-muted num">
                {weekLabel(buckets[buckets.length - 1]!.week)}
              </span>
            </div>
          )}
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-vx-border">
          <div className="text-center">
            <div className="num text-sm font-semibold text-vx-text">{solverFills.length}</div>
            <div className="text-[10px] text-vx-muted">Total fills</div>
          </div>
          <div className="text-center">
            <div className="num text-sm font-semibold text-vx-text">{successCount}</div>
            <div className="text-[10px] text-vx-muted">Successful</div>
          </div>
          <div className="text-center">
            <div className="num text-sm font-semibold text-vx-text">
              {solverFills.length > 0
                ? `${Math.round((successCount / solverFills.length) * 100)}%`
                : "—"}
            </div>
            <div className="text-[10px] text-vx-muted">Success rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}
