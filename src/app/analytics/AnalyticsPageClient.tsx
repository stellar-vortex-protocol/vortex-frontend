"use client";

import { useMemo, useState } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import {
  computeAnalytics,
  getStatusDistributionEntries,
  computeShareSeries,
  computeConcentration,
  computeTopMovers,
  type ShareDimension,
  type ShareSeriesPoint,
  type TopMover,
  type ConcentrationResult,
} from "@/lib/analytics";
import { CHAINS } from "@/lib/marketData";
import { Tooltip } from "@/components/Tooltip";

const formatUsd = (value: number) => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: value >= 1000 ? 0 : 2,
}).format(value);

function LineChart({ points }: { points: { date: string; totalVolumeUsd: number }[] }) {
  const reducedMotion = typeof window !== "undefined" && document.documentElement.dataset.motion === "reduce";
  const width = 640;
  const height = 180;
  const padding = 24;

  if (points.length === 0) {
    return <div className="text-sm text-vx-muted">No volume data for this window.</div>;
  }

  const maxValue = Math.max(...points.map((point) => point.totalVolumeUsd), 1);
  const minValue = Math.min(...points.map((point) => point.totalVolumeUsd), 0);
  const range = Math.max(maxValue - minValue, 1);

  const path = points
    .map((point, index) => {
      const x = padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);
      const y = height - padding - ((point.totalVolumeUsd - minValue) / range) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x} ${y}`;
    })
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-48 w-full" role="img" aria-label="Volume over time chart">
        <g>
          {Array.from({ length: 4 }).map((_, index) => {
            const y = padding + (index / 3) * (height - padding * 2);
            return <line key={y} x1={padding} x2={width - padding} y1={y} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="1" />;
          })}
          <path d={path} fill="none" stroke="#4CEBA8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={reducedMotion ? "" : "transition-all duration-300"} />
        </g>
      </svg>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wide text-vx-muted">
        {points.slice(0, 3).map((point) => (
          <div key={point.date} className="num">{new Date(point.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
        ))}
      </div>
    </div>
  );
}

function BarList({ items, formatLabel, total }: { items: { label: string; value: number; percent: number; color: string }[]; formatLabel?: (value: string) => string; total: number }) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <div className="space-y-3">
      {items.length === 0 ? (
        <div className="text-sm text-vx-muted">No distribution data available.</div>
      ) : items.map((item) => (
        <div key={item.label} className="space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs text-vx-muted">
            <span className="truncate">{formatLabel ? formatLabel(item.label) : item.label}</span>
            <span className="num">{formatUsd(item.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-vx-surface">
            <div
              className="h-full rounded-full"
              style={{ width: `${(item.value / maxValue) * 100}%`, background: item.color }}
            />
          </div>
          <div className="text-[10px] uppercase tracking-wide text-vx-dim">{Math.round(item.percent)}% of volume</div>
        </div>
      ))}
      {total === 0 && <div className="text-xs text-vx-muted">No comparable volume recorded.</div>}
    </div>
  );
}

function StatusBreakdown({ counts }: { counts: ReturnType<typeof getStatusDistributionEntries> }) {
  const total = counts.reduce((sum, item) => sum + item.count, 0);
  const labels = { pending: "Pending", accepted: "Accepted", filled: "Filled", failed: "Failed" } as const;

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
              style={{ width: `${total === 0 ? 0 : (item.count / total) * 100}%`, background: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Issue #468 components ────────────────────────────────────────────────────

/**
 * Stacked area chart for market-share trends.
 * Supports a "100% normalised" toggle.
 */
function StackedAreaChart({
  seriesData,
  entities,
  colors,
  normalized,
}: {
  seriesData: ShareSeriesPoint[];
  entities: string[];
  colors: Record<string, string>;
  normalized: boolean;
}) {
  const width = 640;
  const height = 200;
  const padX = 24;
  const padY = 16;

  if (seriesData.length === 0 || entities.length === 0) {
    return <div className="text-sm text-vx-muted">No share data for this window.</div>;
  }

  // Build stacked paths: for each entity, compute cumulative baseline
  const stackedPaths: { entity: string; color: string; path: string }[] = [];

  const n = seriesData.length;

  // For each point, compute the stack
  const stackTops = seriesData.map((point) => {
    let cumulative = 0;
    return entities.map((entity) => {
      const value = normalized
        ? (point.shares[entity] ?? 0)
        : (point.volumes[entity] ?? 0);
      cumulative += value;
      return cumulative;
    });
  });

  // Max value for scaling
  const maxValue = Math.max(...stackTops.map((tops) => tops[tops.length - 1] ?? 0), 1);

  const xCoord = (i: number) =>
    padX + (i / Math.max(n - 1, 1)) * (width - padX * 2);

  const yCoord = (value: number) =>
    height - padY - (value / maxValue) * (height - padY * 2);

  entities.forEach((entity, entityIdx) => {
    const topLine = seriesData.map((_, i) => {
      const top = stackTops[i]?.[entityIdx] ?? 0;
      return { x: xCoord(i), y: yCoord(top) };
    });

    const baseLine =
      entityIdx === 0
        ? seriesData.map((_, i) => ({ x: xCoord(i), y: yCoord(0) }))
        : seriesData.map((_, i) => {
            const base = stackTops[i]?.[entityIdx - 1] ?? 0;
            return { x: xCoord(i), y: yCoord(base) };
          });

    const pathD = [
      `M ${topLine[0]!.x} ${topLine[0]!.y}`,
      ...topLine.slice(1).map((p) => `L ${p.x} ${p.y}`),
      ...baseLine.slice().reverse().map((p) => `L ${p.x} ${p.y}`),
      "Z",
    ].join(" ");

    stackedPaths.push({ entity, color: colors[entity] ?? "#4CEBA8", path: pathD });
  });

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-52 w-full"
        role="img"
        aria-label="Stacked area market share chart"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const y = padY + frac * (height - padY * 2);
          return (
            <line
              key={frac}
              x1={padX}
              x2={width - padX}
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
            />
          );
        })}

        {/* Stacked areas (render bottom-to-top) */}
        {[...stackedPaths].reverse().map(({ entity, color, path }) => (
          <path
            key={entity}
            d={path}
            fill={color}
            fillOpacity={0.75}
            stroke={color}
            strokeWidth={0.5}
          />
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3">
        {entities.map((entity) => (
          <div key={entity} className="flex items-center gap-1.5 text-[10px] text-vx-muted">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm inline-block"
              style={{ background: colors[entity] ?? "#4CEBA8" }}
            />
            {entity}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Top movers panel: entities ranked by largest share delta. */
function TopMoversPanel({ movers }: { movers: TopMover[] }) {
  if (movers.length === 0) {
    return <div className="text-sm text-vx-muted">Not enough data to calculate movers.</div>;
  }

  return (
    <div className="space-y-3">
      {movers.map((mover) => (
        <div
          key={mover.label}
          className="flex items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full flex-shrink-0"
              style={{ background: mover.color }}
            />
            <span className="truncate text-vx-text">{mover.label}</span>
          </div>
          <div className="flex items-center gap-2 text-right flex-shrink-0">
            <span className="text-vx-muted num">{mover.currentSharePct}%</span>
            <span
              className={`font-semibold num ${
                mover.deltaSharePct > 0
                  ? "text-vx-sage"
                  : mover.deltaSharePct < 0
                  ? "text-red-400"
                  : "text-vx-muted"
              }`}
              aria-label={`${mover.deltaSharePct >= 0 ? "Gained" : "Lost"} ${Math.abs(mover.deltaSharePct)} percentage points`}
            >
              {mover.deltaSharePct > 0 ? "▲" : mover.deltaSharePct < 0 ? "▼" : "—"}{" "}
              {Math.abs(mover.deltaSharePct)}pp
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Concentration indicator showing HHI and top-1/top-3 shares. */
function ConcentrationIndicator({ result }: { result: ConcentrationResult }) {
  const levelLabel = {
    competitive: "Competitive",
    moderate: "Moderately concentrated",
    concentrated: "Highly concentrated",
  }[result.level];

  const levelColor = {
    competitive: "text-vx-sage",
    moderate: "text-yellow-400",
    concentrated: "text-red-400",
  }[result.level];

  const hhiExplanation =
    "The Herfindahl–Hirschman Index (HHI) measures market concentration. " +
    "It is calculated as the sum of squared market-share percentages. " +
    "HHI < 1,500 = competitive; 1,500–2,500 = moderate; > 2,500 = concentrated (max 10,000 = monopoly). " +
    "High solver concentration is a decentralisation risk signal.";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${levelColor}`}>{levelLabel}</span>
        <Tooltip content={hhiExplanation}>
          <span className="text-xs text-vx-muted border border-vx-border rounded px-2 py-0.5 cursor-help">
            HHI: {result.hhi.toLocaleString()}
          </span>
        </Tooltip>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-vx-surface/40 rounded-lg border border-vx-border p-3">
          <div className="text-vx-muted mb-0.5">Top-1 share</div>
          <div className="text-base font-bold text-vx-text num">{result.top1SharePct}%</div>
        </div>
        <div className="bg-vx-surface/40 rounded-lg border border-vx-border p-3">
          <div className="text-vx-muted mb-0.5">Top-3 share</div>
          <div className="text-base font-bold text-vx-text num">{result.top3SharePct}%</div>
        </div>
      </div>

      {/* Top entities mini-list */}
      <div className="space-y-2">
        {result.entities.slice(0, 5).map((e) => (
          <div key={e.label} className="flex items-center justify-between text-xs text-vx-muted">
            <span className="truncate">{e.label}</span>
            <span className="num font-semibold text-vx-text">{Math.round(e.sharePct * 10) / 10}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPageClient() {
  const { intents, isLoading, error } = useLiveIntents();
  const [dimension, setDimension] = useState<ShareDimension>("srcChain");
  const [normalized, setNormalized] = useState(false);

  const analytics = useMemo(() => computeAnalytics(intents), [intents]);
  const statusEntries = useMemo(() => getStatusDistributionEntries(analytics.statusCounts), [analytics.statusCounts]);
  const shareSeries = useMemo(() => computeShareSeries(intents, dimension), [intents, dimension]);
  const concentration = useMemo(() => computeConcentration(intents, "solver"), [intents]);
  const topMovers = useMemo(() => computeTopMovers(intents, dimension), [intents, dimension]);

  if (isLoading && intents.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label="Analytics" />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8 text-sm text-vx-muted">Loading analytics…</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label="Analytics" />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8 text-sm text-vx-muted">Couldn&apos;t load analytics for this view.</div>
        </main>
        <Footer />
      </div>
    );
  }

  if (intents.length === 0) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label="Analytics" />
        <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
          <div className="card p-8">
            <div className="eyebrow mb-3">Protocol Analytics</div>
            <h1 className="text-3xl font-bold text-vx-text">No tracked intents yet</h1>
            <p className="mt-3 max-w-xl text-sm text-vx-muted">The analytics feed will populate as intents arrive. Based on the last 200 tracked intents, this view updates once the backend relay starts returning live data.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const chainMeta = CHAINS.reduce<Record<string, { id: string; name: string; color: string }>>((acc, chain) => {
    acc[chain.id] = chain;
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Analytics" />
      <main id="main-content" className="mx-auto max-w-6xl px-5 py-12">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="eyebrow mb-3">Protocol Analytics</div>
            <h1 className="text-3xl font-bold text-vx-text">Protocol Analytics</h1>
            <p className="mt-2 text-sm text-vx-muted">Volume & route activity</p>
          </div>
          <div className="rounded-lg border border-vx-border bg-vx-surface/60 px-3 py-2 text-xs text-vx-muted">
            Based on the last 200 tracked intents
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="card p-4">
            <div className="eyebrow">Total Volume</div>
            <div className="mt-3 text-2xl font-semibold text-vx-text num">{formatUsd(analytics.totalVolumeUsd)}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">Rolling 7d</div>
            <div className="mt-3 text-2xl font-semibold text-vx-text num">{formatUsd(analytics.rollingVolumeUsd)}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">Intents</div>
            <div className="mt-3 text-2xl font-semibold text-vx-text num">{analytics.totalIntents}</div>
          </div>
          <div className="card p-4">
            <div className="eyebrow">Avg. Intent</div>
            <div className="mt-3 text-2xl font-semibold text-vx-text num">{formatUsd(analytics.averageVolumeUsd)}</div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="eyebrow">Volume over time</div>
                <h2 className="mt-2 text-lg font-semibold text-vx-text">Daily tracked volume</h2>
              </div>
            </div>
            <LineChart points={analytics.volumeOverTime} />
          </div>

          <div className="card p-5">
            <div className="eyebrow">Status distribution</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">Intent lifecycle</h2>
            <div className="mt-4">
              <StatusBreakdown counts={statusEntries} />
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="eyebrow">Source chain mix</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">Top source chains</h2>
            <div className="mt-4">
              <BarList
                items={analytics.chainBreakdown}
                formatLabel={(value) => chainMeta[value]?.name ?? value}
                total={analytics.totalVolumeUsd}
              />
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow">Destination asset mix</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">Top destination tokens</h2>
            <div className="mt-4">
              <BarList items={analytics.destinationTokenBreakdown} total={analytics.totalVolumeUsd} />
            </div>
          </div>
        </div>

        <div className="mt-8 card p-5">
          <div className="eyebrow">Top routes</div>
          <h2 className="mt-2 text-lg font-semibold text-vx-text">Chain → destination token pairs</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-vx-muted uppercase tracking-wide text-[10px]">
                <tr>
                  <th className="pb-3 pr-4">Route</th>
                  <th className="pb-3 pr-4">Volume</th>
                  <th className="pb-3 pr-4">Intents</th>
                </tr>
              </thead>
              <tbody>
                {analytics.routeBreakdown.map((route) => (
                  <tr key={`${route.sourceChain}-${route.destinationToken}`} className="border-t border-vx-border/80 text-vx-text">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: route.color }} />
                        <span>{chainMeta[route.sourceChain]?.name ?? route.sourceChain} → {route.destinationToken}</span>
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

        {/* ── Issue #468: Market-share trends ────────────────────────────── */}
        <div className="mt-8 card p-5">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="eyebrow">Market share trends</div>
              <h2 className="mt-2 text-lg font-semibold text-vx-text">Share over time</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Dimension selector */}
              {(["srcChain", "dstToken", "solver"] as ShareDimension[]).map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setDimension(dim)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    dimension === dim
                      ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                      : "bg-vx-surface/50 text-vx-muted border border-vx-border hover:text-vx-text"
                  }`}
                  aria-pressed={dimension === dim}
                >
                  {dim === "srcChain" ? "Source Chain" : dim === "dstToken" ? "Dest Token" : "Solver"}
                </button>
              ))}
              {/* Normalise toggle */}
              <button
                type="button"
                onClick={() => setNormalized((v) => !v)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                  normalized
                    ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                    : "bg-vx-surface/50 text-vx-muted border-vx-border hover:text-vx-text"
                }`}
                aria-pressed={normalized}
              >
                100% normalised
              </button>
            </div>
          </div>
          <StackedAreaChart
            seriesData={shareSeries.series}
            entities={shareSeries.entities}
            colors={shareSeries.colors}
            normalized={normalized}
          />
        </div>

        {/* ── Issue #468: Top movers + Concentration ──────────────────────── */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="card p-5">
            <div className="eyebrow">Top movers (7d vs previous 7d)</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">Largest share shifts</h2>
            <div className="mt-4">
              <TopMoversPanel movers={topMovers} />
            </div>
          </div>

          <div className="card p-5">
            <div className="eyebrow">Solver concentration</div>
            <h2 className="mt-2 text-lg font-semibold text-vx-text">HHI & top-1/top-3 share</h2>
            <div className="mt-4">
              <ConcentrationIndicator result={concentration} />
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
