"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import {
  computeAnalytics,
  getStatusDistributionEntries,
  SLA_THRESHOLDS,
  type AnalyticsResult,
  type KpiCard,
  type KpiDeltaState,
  type SankeyData,
  type SlaPanelData,
} from "@/lib/analytics";
import { CHAINS } from "@/lib/marketData";
import { buildAnalyticsCsvBundle, buildShareUrl } from "@/lib/export/analyticsExport";
import { downloadBlob, svgToPng } from "@/lib/export/svgToPng";
import { downloadCsv } from "@/lib/csv";
import { secureLogger } from "@/lib/secureLogging";
import { useTranslation } from "@/lib/i18n/I18nProvider";

// ─── Inline format helper ─────────────────────────────────────────────────────

const formatUsd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);

// ─── LineChart ────────────────────────────────────────────────────────────────

function LineChart({ points }: { points: { date: string; totalVolumeUsd: number }[] }) {
  const { t } = useTranslation();
  const reducedMotion =
    typeof window !== "undefined" &&
    document.documentElement.dataset["motion"] === "reduce";
  const width = 640;
  const height = 180;
  const padding = 24;

  if (points.length === 0) {
    return <div className="text-sm text-vx-muted">{t("analytics.chart.empty")}</div>;
  }

  const maxValue = Math.max(...points.map((p) => p.totalVolumeUsd), 1);
  const minValue = Math.min(...points.map((p) => p.totalVolumeUsd), 0);
  const range = Math.max(maxValue - minValue, 1);

  const path = points
    .map((point, index) => {
      const x =
        padding +
        (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y =
        height -
        padding -
        ((point.totalVolumeUsd - minValue) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-48 w-full"
        role="img"
        aria-label={t("analytics.chart.aria")}
      >
        <g>
          {Array.from({ length: 4 }).map((_, index) => {
            const y = padding + (index / 3) * (height - padding * 2);
            return (
              <line
                key={y}
                x1={padding}
                x2={width - padding}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            );
          })}
          <path
            d={path}
            fill="none"
            stroke="#4CEBA8"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={reducedMotion ? "" : "transition-all duration-300"}
          />
        </g>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wide text-vx-muted">
        {points.slice(0, 3).map((point) => (
          <div key={point.date} className="num">
            {new Date(point.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Sparkline (issue #467) ───────────────────────────────────────────────────

function Sparkline({ data, color = "#4CEBA8" }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const width = 80;
  const height = 28;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = Math.max(max - min, 1);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ─── KPI card (issue #467) ────────────────────────────────────────────────────

const DELTA_COLORS: Record<KpiDeltaState, string> = {
  up: "text-emerald-400",
  down: "text-red-400",
  neutral: "text-vx-muted",
  new: "text-sky-400",
  "no-data": "text-vx-dim",
};

const DELTA_ARROWS: Record<KpiDeltaState, string> = {
  up: "▲",
  down: "▼",
  neutral: "—",
  new: "★",
  "no-data": "",
};

function KpiCardComponent({
  label,
  tooltip,
  card,
}: {
  label: string;
  tooltip: string;
  card: KpiCard;
}) {
  const deltaPercent =
    card.delta !== undefined && card.value !== 0
      ? Math.abs((card.delta / (card.value - card.delta)) * 100)
      : undefined;

  const deltaLabel = buildDeltaAriaLabel(card.state, deltaPercent);

  return (
    <div className="card p-4 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="eyebrow">{label}</div>
        <Tooltip content={tooltip}>
          <button
            type="button"
            className="rounded text-vx-dim hover:text-vx-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent text-xs"
            aria-label={`${label} definition`}
          >
            ⓘ
          </button>
        </Tooltip>
      </div>

      <div className="flex items-end justify-between gap-2">
        <Tooltip content={card.formattedFull}>
          <span className="text-2xl font-semibold text-vx-text num cursor-default">
            {card.formatted}
          </span>
        </Tooltip>
        <Sparkline data={card.sparkline} />
      </div>

      {card.state !== "no-data" && (
        <div
          className={`text-xs ${DELTA_COLORS[card.state]}`}
          aria-label={deltaLabel}
        >
          {DELTA_ARROWS[card.state]}{" "}
          {deltaPercent !== undefined
            ? `${deltaPercent.toFixed(1)}% vs prior period`
            : card.state === "new"
              ? "New activity"
              : "No change"}
        </div>
      )}
    </div>
  );
}

function buildDeltaAriaLabel(state: KpiDeltaState, percent?: number): string {
  if (state === "up") return `Up ${percent?.toFixed(1) ?? "0"}% versus prior period`;
  if (state === "down") return `Down ${percent?.toFixed(1) ?? "0"}% versus prior period`;
  if (state === "neutral") return "No significant change versus prior period";
  if (state === "new") return "New activity — no prior period data";
  return "No prior period data available";
}

// ─── Simple Tooltip wrapper ───────────────────────────────────────────────────

function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  return (
    <span className="relative group">
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block group-focus-within:block z-50 w-max max-w-xs rounded bg-vx-surface border border-vx-border px-2 py-1 text-xs text-vx-text shadow-lg"
      >
        {content}
      </span>
    </span>
  );
}

// ─── Data-completeness banner (issue #467) ────────────────────────────────────

function DataQualityBanner({
  isCapped,
  datasetSize,
  datasetSince,
}: {
  isCapped: boolean;
  datasetSize: number;
  datasetSince: string | undefined;
}) {
  if (!isCapped) return null;
  const sinceStr = datasetSince
    ? new Date(datasetSince).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "unknown";

  return (
    <aside
      className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs text-amber-300 flex flex-wrap items-center gap-2"
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true">⚠</span>
      <span>
        Based on the latest{" "}
        <strong className="font-semibold num">{datasetSize}</strong> intents
        {datasetSince && (
          <>
            {" "}(since <time dateTime={datasetSince}>{sinceStr}</time>)
          </>
        )}
        . Data may be partial —{" "}
        <a
          href="https://github.com/stellar-vortex-protocol/vortex-frontend/blob/main/docs/architecture.md"
          className="underline underline-offset-2 hover:text-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
          target="_blank"
          rel="noopener noreferrer"
        >
          learn about data limitations
        </a>
        .
      </span>
    </aside>
  );
}

// ─── BarList ──────────────────────────────────────────────────────────────────

function BarList({
  items,
  formatLabel,
  total,
}: {
  items: { label: string; value: number; percent: number; color: string }[];
  formatLabel?: (value: string) => string;
  total: number;
}) {
  const { t } = useTranslation();

  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-sm text-vx-muted">No distribution data available.</div>
      ) : (
        items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs text-vx-muted">
              <span className="truncate">
                {formatLab
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-sm text-vx-muted">{t("analytics.bars.empty")}</div>
      ) : (
        items.map((item) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs text-vx-muted">
              <span className="truncate">
                {formatLabel ? formatLabel(item.label) : item.label}
              </span>
              <span className="num">{formatUsd(item.value)}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-vx-surface">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  background: item.color,
                }}
              />
            </div>
            <div className="text-[10px] uppercase tracking-wide text-vx-dim">
              {t("analytics.bars.percent", { percent: Math.round(item.percent) })}
            </div>
          </div>
        ))
      )}
      {total === 0 && (
        <div className="text-xs text-vx-muted">{t("analytics.bars.noVolume")}</div>
      )}
    </div>
  );
}

// ─── StatusBreakdown ──────────────────────────────────────────────────────────

function StatusBreakdown({
  counts,
}: {
  counts: ReturnType<typeof getStatusDistributionEntries>;
}) {
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const { t } = useTranslation();
  const labels = {
    pending: t("intent.status.pending"),
    accepted: t("intent.status.accepted"),
    filled: t("intent.status.filled"),
    failed: t("intent.status.failed"),
  } as const;

  return (
    <div className="space-y-3">
      {counts.map((item) => (
        <div key={item.status} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs text-vx-muted">
            <span>{labels[item.status]}</span>
            <span className="num">{item.count}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-vx-surface">
            <div
              className="h-full rounded-full"
              style={{
                width: `${total === 0 ? 0 : (item.count / total) * 100}%`,
                background: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Drives analytics from a Web Worker when available, falling back to a
 * synchronous recompute on the main thread (SSR, tests, old browsers).
 * The worker keeps an incremental aggregator alive and streams snapshots
 * back, so the main thread only ever renders precomputed results.
 */
function useAnalyticsWorker(intents: Parameters<typeof computeAnalytics>[0]) {
  const [snapshot, setSnapshot] = useState<AnalyticsResult | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof Worker === "undefined") {
      return;
    }

    let worker: Worker;
    try {
      worker = new Worker(new URL("../../lib/analytics/worker.ts", import.meta.url), { type: "module" });
    } catch {
      return;
    }

    workerRef.current = worker;
    worker.onmessage = (event: MessageEvent<{ type: string; snapshot?: AnalyticsResult }>) => {
      if (event.data?.type === "snapshot" && event.data.snapshot) {
        setSnapshot(event.data.snapshot);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
      initializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const worker = workerRef.current;
    if (!worker) {
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      worker.postMessage({ type: "init", intents });
    } else {
      worker.postMessage({ type: "apply", delta: { type: "replace", intents } });
    }
  }, [intents]);

  return snapshot;
}

// ─── SLA Panel (issue #465) ───────────────────────────────────────────────────

function SlaPanel({ data }: { data: SlaPanelData }) {
  const { percentiles, histogram, sla, filledCount, pendingCount, clampedCount, successRateMovingAvg } = data;

  if (filledCount === 0) {
    return (
      <div className="text-sm text-vx-muted" role="status">
        No filled intents with fill-time data available yet.
      </div>
    );
  }

  const binLabel = (lower: number, upper: number) =>
    upper === Number.POSITIVE_INFINITY ? `${lower}s+` : `${lower}–${upper}s`;

  const maxBinCount = Math.max(...histogram.map((b) => b.count), 1);

  return (
    <div className="space-y-6">
      {/* Percentile cards */}
      <div>
        <p className="mb-1 text-[10px] uppercase tracking-wide text-vx-dim">
          Nearest-rank percentile — p50 means 50% of fills completed within this time.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              { label: "p50 (median)", value: percentiles.p50, pass: sla.p50, threshold: SLA_THRESHOLDS.p50MaxSeconds },
              { label: "p90", value: percentiles.p90, pass: sla.p90, threshold: SLA_THRESHOLDS.p90MaxSeconds },
              { label: "p99", value: percentiles.p99, pass: sla.p99, threshold: SLA_THRESHOLDS.p99MaxSeconds },
            ] as const
          ).map(({ label, value, pass, threshold }) => (
            <div
              key={label}
              className={`rounded-lg border p-3 ${pass ? "border-emerald-500/40 bg-emerald-500/10" : "border-red-500/40 bg-red-500/10"}`}
            >
              <div className="eyebrow">{label}</div>
              <div className="mt-1 text-xl font-semibold num text-vx-text">
                {value.toFixed(1)}s
              </div>
              <div
                className={`mt-1 flex items-center gap-1 text-xs font-medium ${pass ? "text-emerald-400" : "text-red-400"}`}
                aria-label={`${label}: ${pass ? "Pass" : "Fail"} — SLA threshold is ${threshold} seconds`}
              >
                <span aria-hidden="true">{pass ? "✓" : "✗"}</span>
                {pass ? "Pass" : "Fail"} (SLA: {threshold}s)
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Histogram */}
      <div>
        <div className="eyebrow mb-2">Fill-time distribution</div>
        <div className="flex items-end gap-1 h-24" role="img" aria-label="Fill-time histogram">
          {histogram.map((bin) => (
            <Tooltip
              key={`${bin.lower}-${bin.upper}`}
              content={`${binLabel(bin.lower, bin.upper)}: ${bin.count} intent(s)`}
            >
              <div className="flex flex-1 flex-col items-center gap-1 cursor-default">
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${(bin.count / maxBinCount) * 80}px`,
                    background: bin.count > 0 ? "#4CEBA8" : "rgba(255,255,255,0.08)",
                  }}
                />
                <span className="text-[8px] text-vx-dim rotate-0 leading-none">
                  {bin.lower}s
                </span>
              </div>
            </Tooltip>
          ))}
        </div>
        <div className="mt-1 text-[10px] text-vx-dim">Time to fill (seconds)</div>
      </div>

      {/* Success rate sparkline */}
      {successRateMovingAvg.length > 1 && (
        <div>
          <div className="eyebrow mb-2">Success rate (7-day moving avg.)</div>
          <div className="h-20">
            <svg
              viewBox={`0 0 400 60`}
              className="w-full h-full"
              role="img"
              aria-label="7-day moving average success rate chart"
            >
              {(() => {
                const pts = successRateMovingAvg;
                const path = pts
                  .map((p, i) => {
                    const x = (i / Math.max(pts.length - 1, 1)) * 400;
                    const y = 60 - (p.rate / 100) * 60;
                    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(" ");
                return (
                  <path
                    d={path}
                    fill="none"
                    stroke="#4CEBA8"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              })()}
            </svg>
          </div>
        </div>
      )}

      {/* Data quality notes */}
      <div className="space-y-1 text-[11px] text-vx-dim">
        {pendingCount > 0 && (
          <p>{pendingCount} still-pending intent(s) excluded from fill-time stats.</p>
        )}
        {clampedCount > 0 && (
          <p>{clampedCount} intent(s) with negative duration clamped to 0 (clock skew).</p>
        )}
        <p>{filledCount} filled intent(s) included in analysis.</p>
      </div>
    </div>
  );
}

// ─── Route Flow / Sankey (issue #464) ─────────────────────────────────────────

function RouteFlowPanel({
  sankeyData,
  chainMeta,
}: {
  sankeyData: SankeyData;
  chainMeta: Record<string, { id: string; name: string; color: string }>;
}) {
  const [minVolumeThreshold, setMinVolumeThreshold] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const { nodes, links, totalValue } = sankeyData;

  const chainNodes = nodes.filter((n) => n.id.startsWith("chain:"));
  const tokenNodes = nodes.filter((n) => n.id.startsWith("token:"));

  const filteredLinks = links.filter((l) => l.value >= minVolumeThreshold);

  // Matrix heatmap data
  const heatmapRows = useMemo(() => {
    return chainNodes.map((chainNode) => ({
      chainNode,
      cells: tokenNodes.map((tokenNode) => {
        const link = filteredLinks.find(
          (l) => l.sourceId === chainNode.id && l.targetId === tokenNode.id,
        );
        return { tokenNode, link };
      }),
    }));
  }, [chainNodes, tokenNodes, filteredLinks]);

  const maxCellValue = Math.max(...filteredLinks.map((l) => l.value), 1);

  const handleExploreClick = useCallback(
    (chainId: string, tokenSymbol: string) => {
      const params = new URLSearchParams();
      params.set("chain", chainId);
      params.set("q", `token:${tokenSymbol}`);
      window.location.href = `/explore?${params.toString()}`;
    },
    [],
  );

  if (nodes.length === 0) {
    return <div className="text-sm text-vx-muted">No route data available.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Threshold slider */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-vx-muted">
        <label htmlFor="vol-threshold" className="shrink-0">
          Min. volume threshold:
        </label>
        <input
          id="vol-threshold"
          type="range"
          min={0}
          max={Math.round(totalValue / 10)}
          step={Math.max(1, Math.round(totalValue / 100))}
          value={minVolumeThreshold}
          onChange={(e) => setMinVolumeThreshold(Number(e.target.value))}
          className="w-32 accent-vx-accent"
          aria-label="Minimum volume threshold to show a route"
        />
        <span className="num">{formatUsd(minVolumeThreshold)}</span>
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="ml-auto rounded border border-vx-border bg-vx-surface px-2 py-1 text-xs hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
          aria-pressed={showTable}
        >
          {showTable ? "Hide table" : "Show table"}
        </button>
      </div>

      {/* Heatmap / matrix */}
      {!showTable && (
        <div
          className="overflow-x-auto"
          role="img"
          aria-label="Route flow heatmap: source chains vs destination tokens"
        >
          <table className="border-separate border-spacing-1 text-xs">
            <thead>
              <tr>
                <th className="text-left text-vx-muted pr-2 font-normal">
                  <span className="sr-only">Source chain</span>
                </th>
                {tokenNodes.map((tn) => (
                  <th
                    key={tn.id}
                    className="text-center text-vx-muted font-normal pb-1 px-1"
                    scope="col"
                    style={{ color: tn.color }}
                  >
                    {tn.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapRows.map(({ chainNode, cells }) => (
                <tr key={chainNode.id}>
                  <th
                    scope="row"
                    className="text-left text-vx-muted font-normal pr-2 whitespace-nowrap"
                    style={{ color: chainNode.color }}
                  >
                    {chainMeta[chainNode.id.replace("chain:", "")]?.name ??
                      chainNode.label}
                  </th>
                  {cells.map(({ tokenNode, link }) => {
                    const opacity = link
                      ? 0.15 + (link.value / maxCellValue) * 0.85
                      : 0;
                    const isFocused =
                      focusedId === `${chainNode.id}→${tokenNode.id}`;
                    return (
                      <td key={tokenNode.id} className="p-0">
                        {link ? (
                          <Tooltip
                            content={`${chainNode.label} → ${tokenNode.label}: ${formatUsd(link.value)} across ${link.count} intent(s) (${((link.value / totalValue) * 100).toFixed(1)}%)`}
                          >
                            <button
                              type="button"
                              className={`h-8 w-14 rounded transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent ${isFocused ? "ring-2 ring-vx-accent" : ""}`}
                              style={{
                                background: chainNode.color,
                                opacity,
                              }}
                              onFocus={() =>
                                setFocusedId(`${chainNode.id}→${tokenNode.id}`)
                              }
                              onBlur={() => setFocusedId(null)}
                              onClick={() =>
                                handleExploreClick(
                                  chainNode.id.replace("chain:", ""),
                                  tokenNode.label,
                                )
                              }
                              aria-label={`${chainNode.label} to ${tokenNode.label}: ${formatUsd(link.value)}, ${link.count} intent(s). Click to explore.`}
                            />
                          </Tooltip>
                        ) : (
                          <div
                            className="h-8 w-14 rounded"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                            }}
                            aria-hidden="true"
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Table alternative */}
      {showTable && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs" aria-label="All routes sortable table">
            <thead className="text-vx-muted uppercase tracking-wide text-[10px]">
              <tr>
                <th className="pb-3 pr-4">Route</th>
                <th className="pb-3 pr-4">Volume</th>
                <th className="pb-3 pr-4">Intents</th>
                <th className="pb-3 pr-4">Share</th>
                <th className="pb-3">Explore</th>
              </tr>
            </thead>
            <tbody>
              {filteredLinks.map((link) => {
                const chainId = link.sourceId.replace("chain:", "");
                const tokenSymbol = link.targetId.replace("token:", "");
                const chainName =
                  chainMeta[chainId]?.name ?? chainId;
                return (
                  <tr
                    key={`${link.sourceId}-${link.targetId}`}
                    className="border-t border-vx-border/80 text-vx-text"
                  >
                    <td className="py-2 pr-4">
                      {chainName} → {tokenSymbol}
                    </td>
                    <td className="py-2 pr-4 num">{formatUsd(link.value)}</td>
                    <td className="py-2 pr-4 num">{link.count}</td>
                    <td className="py-2 pr-4 num">
                      {((link.value / totalValue) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => handleExploreClick(chainId, tokenSymbol)}
                        className="text-vx-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent text-xs"
                        aria-label={`Explore ${chainName} to ${tokenSymbol} intents`}
                      >
                        Explore →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Export menu (issue #466) ─────────────────────────────────────────────────

function ExportMenu({
  onCsv,
  onPng,
  onCopyLink,
}: {
  onCsv: () => void;
  onPng: (theme: "light" | "dark") => void;
  onCopyLink: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleCopyLink = () => {
    onCopyLink();
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Export analytics snapshot"
        className="rounded-lg border border-vx-border bg-vx-surface/60 px-3 py-2 text-xs text-vx-muted hover:bg-vx-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
      >
        Export ▾
      </button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-vx-border bg-vx-surface shadow-lg"
          role="menu"
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent rounded-t-lg"
            onClick={() => { onCsv(); setOpen(false); }}
          >
            Download CSV
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
            onClick={() => { onPng("dark"); setOpen(false); }}
          >
            Download PNG (dark)
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent"
            onClick={() => { onPng("light"); setOpen(false); }}
          >
            Download PNG (light)
          </button>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-vx-text hover:bg-vx-surface/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-vx-accent rounded-b-lg"
            onClick={() => { handleCopyLink(); setOpen(false); }}
          >
            {linkCopied ? "Link copied! ✓" : "Copy shareable link"}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AnalyticsPageClient() {
  const { t } = useTranslation();
  const { intents, isLoading, error } = useLiveIntents();
  const chartRef = useRef<HTMLDivElement>(null);

  const workerSnapshot = useAnalyticsWorker(intents);
  const fallbackAnalytics = useMemo(
    () => (workerSnapshot ? null : computeAnalytics(intents)),
    [workerSnapshot, intents],
  );
  const analytics = workerSnapshot ?? fallbackAnalytics!;
  const deferredAnalytics = useDeferredValue(ana
export default function AnalyticsPageClient() {
  const { t } = useTranslation();
  const { intents, isLoading, error } = useLiveIntents();
  const chartRef = useRef<HTMLDivElement>(null);

  const workerSnapshot = useAnalyticsWorker(intents);
  const fallbackAnalytics = useMemo(
    () => (workerSnapshot ? null : computeAnalytics(intents)),
    [workerSnapshot, intents],
  );
  const analytics = workerSnapshot ?? fallbackAnalytics!;
  const deferredAnalytics = useDeferredValue(analytics);
  const statusEntries = useMemo(
    () => getStatusDistributionEntries(deferredAnalytics.statusCounts),
    [deferredAnalytics.statusCounts],
  );

  const chainMeta = useMemo(
    () =>
      CHAINS.reduce<Record<string, { id: string; name: string; color: string }>>(
        (acc, chain) => {
          acc[chain.id] = chain;
          return acc;
        },
        {},
      ),
    [],
  );

  const handleCsvExport = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const csv = buildAnalyticsCsvBundle(analytics, {
      title: "Vortex Protocol Analytics",
      range: analytics.datasetSince
        ? `${analytics.datasetSince} – ${today}`
        : today,
      generatedAt: new Date().toISOString(),
      network: "mainnet",
      dataCompletenessNote: analytics.isCapped
        ? `Partial dataset: latest ${analytics.datasetSize} intents only`
        : "Full dataset loaded",
    });
    downloadCsv(`vortex-analytics-${today}.csv`, csv);
  }, [analytics]);

  const handlePngExport = useCallback(
    async (theme: "light" | "dark") => {
      const svgEl = chartRef.current?.querySelector("svg");
      if (!svgEl) {
        secureLogger.warn("PNG export: no SVG element found in chart container");
        return;
      }
      try {
        const bg = theme === "light" ? "#ffffff" : "#0f1117";
        const blob = await svgToPng(svgEl as SVGSVGElement, { background: bg });
        const today = new Date().toISOString().slice(0, 10);
        downloadBlob(blob, `vortex-analytics-${today}.png`);
      } catch (err) {
        secureLogger.error("PNG export failed", err);
      }
    },
    [],
  );

  const handleCopyLink = useCallback(() => {
    const url = buildShareUrl({});
    navigator.clipboard.writeText(url).catch((err) => {
      secureLogger.error("Failed to copy shareable link", err);
    });
  }, []);

  if (isLoading && intents.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label={t("nav.analytics")} />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8 text-sm text-vx-muted">{t("analytics.loading")}</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label={t("nav.analytics")} />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8 text-sm text-vx-muted">{t("analytics.error")}</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (intents.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label={t("nav.analytics")} />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8">
            <div className="eyebrow mb-3">{t("analytics.eyebrow")}</div>
            <h1 className="text-3xl font-bold text-vx-text">{t("analytics.empty.title")}</h1>
            <p className="mt-3 max-w-xl text-sm text-vx-muted">{t("analytics.empty.message")}</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={t("nav.analytics")} />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow mb-3">{t("analytics.eyebrow")}</div>
            <h1 className="text-3xl font-bold text-vx-text">{t("analytics.title")}</h1>
            <p className="mt-2 text-sm text-vx-muted">{t("analytics.subtitle")}</p>
          </div>
          <div className="rounded-lg border border-vx-border bg-vx-surface/60 px-3 py-2 text-xs text-vx-muted">
            {t("analytics.window")}
          </div>
          <ExportMenu
            onCsv={handleCsvExport}
            onPng={handlePngExport}
            onCopyLink={handleCopyLink}
          />
        </div>

        {/* Data-quality banner (issue #467) */}
        <div className="mb-6">
          <DataQualityBanner
            isCapped={analytics.isCapped}
            datasetSize={analytics.datasetSize}
            datasetSince={analytics.datasetSince}
          />
        </div>

        {/* KPI cards with deltas + sparklines (issue #467) */}
        <div className="grid gap-4 md:grid-cols-4">
          <KpiCardComponent
            label="Total Volume"
            tooltip="Cumulative USD volume of all loaded intents."
            card={analytics.kpis.totalVolume}
          />
          <KpiCardComponent
            label="Rolling 7d"
            tooltip="USD volume in the last 7 days."
            card={analytics.kpis.rollingVolume}
          />
          <KpiCardComponent
            label="Intents"
            tooltip="Total number of intents in this dataset."
            card={analytics.kpis.intentCount}
          />
          <KpiCardComponent
            label="Avg. Intent"
            tooltip="Average USD value per intent."
            card={analytics.kpis.averageSize}
          />
        </div>

        {/* Volume chart + status breakdown */}
        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="card p-5" ref={chartRef}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="eyebrow">{t("analytics.volume.eyebrow")}</div>
                <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.volume.title")}</h2>
              </div>
            </div>
            <LineChart points={analytics.volumeOverTime} />
          </div>

          <div className="card p-5">
            <div className="eyebrow">{t("analytics.status.eyebrow")}</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.status.title")}</h2>
            <div className="mt-4">
              <StatusBreakdown counts={statusEntries} />
            </div>
          </div>
        </div>

        {/* Chain & token breakdowns */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="eyebrow">{t("analytics.chains.eyebrow")}</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.chains.title")}</h2>
            <div className="mt-4">
              <BarList
                items={analytics.chainBreakdown}
                formatLabel={(value) => chainMeta[value]?.name ?? value}
                total={analytics.totalVolumeUsd}
              />
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow">{t("analytics.tokens.eyebrow")}</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.tokens.title")}</h2>
            <div className="mt-4">
              <BarList
                items={analytics.destinationTokenBreakdown}
                total={analytics.totalVolumeUsd}
              />
            </div>
          </div>
        </div>

        {/* Route flow visualization (issue #464) */}
        <div className="mt-8 card p-5">
          <div className="eyebrow">Route flow</div>
          <h2 className="mt-2 text-lg font-semibold text-vx-text">
            Chain → destination token flow
          </h2>
          <p className="mt-1 text-xs text-vx-muted">
            Click any cell to explore those intents. Use the threshold slider to group
            small routes into &quot;Other&quot;.
          </p>
          <div className="mt-4">
            <RouteFlowPanel sankeyData={analytics.sankeyData} chainMeta={chainMeta} />
          </div>
        </div>

        {/* Legacy top-routes table */}
        <div className="mt-8 card p-5">
          <div className="eyebrow">{t("analytics.routes.eyebrow")}</div>
          <h2 className="mt-2 text-lg font-semibold text-vx-text">{t("analytics.routes.title")}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-vx-muted uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="pb-3 pr-4">{t("analytics.routes.route")}</th>
                  <th className="pb-3 pr-4">{t("analytics.routes.volume")}</th>
                  <th className="pb-3 pr-4">{t("analytics.routes.intents")}</th>
                </tr>
              </thead>
              <tbody>
                {analytics.routeBreakdown.map((route) => (
                  <tr
                    key={`${route.sourceChain}-${route.destinationToken}`}
                    className="border-t border-vx-border/80 text-vx-text"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: route.color }}
                        />
                        <span>
                          {chainMeta[route.sourceChain]?.name ?? route.sourceChain} →{" "}
                          {route.destinationToken}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 num">{formatUsd(route.value)}</td>
                    <td className="py-3 pr-4 num">{route.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fill-time / SLA panel (issue #465) */}
        <div className="mt-8 card p-5">
          <div className="eyebrow">Fill-time &amp; SLA</div>
          <h2 className="mt-2 text-lg font-semibold text-vx-text">
            Fill-time distribution &amp; success-rate SLA
          </h2>
          <p className="mt-1 text-xs text-vx-muted">
            How fast and reliably intents are filled.
          </p>
          <div className="mt-4">
            <SlaPanel data={analytics.slaPanel} />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
