"use client";

import { useMemo } from "react";
import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { computeAnalytics, getStatusDistributionEntries } from "@/lib/analytics";
import { CHAINS } from "@/lib/marketData";

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

export default function AnalyticsPageClient() {
  const { intents, isLoading, error } = useLiveIntents();

  const analytics = useMemo(() => computeAnalytics(intents), [intents]);
  const statusEntries = useMemo(() => getStatusDistributionEntries(analytics.statusCounts), [analytics.statusCounts]);

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
      </main>
      <Footer />
    </div>
  );
}
