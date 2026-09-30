"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { BarChart } from "@/components/charts/BarChart";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import {
  STATS_WINDOWS,
  computeCoverage,
  computeSolverStats,
  filterByStatus,
  type StatsWindow,
} from "@/lib/solverStats";
import { sanitizeDisplayText } from "@/lib/textSafety";
import { timeAgo } from "@/lib/time";
import type { FeedItem, IntentStatus } from "@/lib/types";

const PAGE_SIZE = 10;
const STATUS_FILTERS: Array<IntentStatus | "all"> = ["all", "pending", "accepted", "filled", "failed"];
const FOCUS_RING = "focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

type SolverPerformanceProps = {
  /** Fills already scoped to this solver. */
  fills: FeedItem[];
  avgFillTimeSeconds: number;
  now?: number;
};

export function SolverPerformance({ fills, avgFillTimeSeconds, now }: SolverPerformanceProps) {
  const { t } = useTranslation();
  const [statsWindow, setStatsWindow] = useState<StatsWindow>(30);
  const [status, setStatus] = useState<IntentStatus | "all">("all");
  const [page, setPage] = useState(0);

  const stats = useMemo(() => computeSolverStats(fills, statsWindow, now), [fills, statsWindow, now]);
  const coverage = useMemo(() => computeCoverage(fills), [fills]);
  const history = useMemo(
    () => [...filterByStatus(fills, status)].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    [fills, status],
  );
  const pageCount = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = history.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  return (
    <div className="space-y-6">
      {/* ── Performance over time ─────────────────────────────────────── */}
      <section className="card p-4 sm:p-5 space-y-4" aria-labelledby="perf-title">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="perf-title" className="text-sm font-semibold text-vx-text">
            {t("solverDetail.perf.title")}
          </h2>
          <div role="group" aria-label={t("solverDetail.perf.window")} className="flex gap-1">
            {STATS_WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={statsWindow === w}
                onClick={() => setStatsWindow(w)}
                className={`text-xs px-2 py-1 rounded border ${FOCUS_RING} ${
                  statsWindow === w ? "border-vx-sage text-vx-sage" : "border-vx-border text-vx-muted"
                }`}
              >
                {t("solverDetail.perf.days", { days: w })}
              </button>
            ))}
          </div>
        </div>

        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-[10px] text-vx-muted">{t("solverDetail.perf.fills")}</dt>
            <dd className="num text-sm font-semibold text-vx-text">{stats.total}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-vx-muted">{t("solverDetail.perf.successRate")}</dt>
            <dd className="num text-sm font-semibold text-vx-text">
              {stats.successRatePct === null ? "—" : `${stats.successRatePct}%`}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-vx-muted">{t("solverDetail.perf.avgFillTime")}</dt>
            <dd className="num text-sm font-semibold text-vx-text">{avgFillTimeSeconds}s</dd>
          </div>
        </dl>

        {stats.insufficientData ? (
          <p role="status" className="text-xs text-vx-muted">
            {t("solverDetail.perf.insufficient", { count: stats.total })}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <BarChart
              title={t("solverDetail.perf.fillsChart")}
              valueLabel={t("solverDetail.perf.fills")}
              data={stats.series.map((b) => ({ label: b.start, value: b.fills }))}
              showTableLabel={t("chart.showTable")}
              hideTableLabel={t("chart.hideTable")}
              emptyLabel={t("chart.empty")}
            />
            <BarChart
              title={t("solverDetail.perf.successChart")}
              valueLabel={t("solverDetail.perf.successRate")}
              data={stats.series.map((b) => ({ label: b.start, value: b.successRatePct }))}
              formatValue={(v) => `${v}%`}
              showTableLabel={t("chart.showTable")}
              hideTableLabel={t("chart.hideTable")}
              emptyLabel={t("chart.empty")}
            />
          </div>
        )}
        <p className="text-[10px] text-vx-muted">{t("solverDetail.perf.utcNote")}</p>
      </section>

      {/* ── Coverage matrix ───────────────────────────────────────────── */}
      <section className="card p-4 sm:p-5" aria-labelledby="coverage-title">
        <h2 id="coverage-title" className="text-sm font-semibold text-vx-text mb-3">
          {t("solverDetail.coverage.title")}
        </h2>
        {coverage.length === 0 ? (
          <p className="text-xs text-vx-muted">{t("solverDetail.coverage.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-vx-muted text-left">
                  <th scope="col" className="font-normal py-1">{t("solverDetail.coverage.chain")}</th>
                  <th scope="col" className="font-normal py-1">{t("solverDetail.coverage.token")}</th>
                  <th scope="col" className="font-normal py-1 text-right">{t("solverDetail.coverage.count")}</th>
                  <th scope="col" className="font-normal py-1 text-right">{t("solverDetail.coverage.lastFill")}</th>
                </tr>
              </thead>
              <tbody>
                {coverage.map((c) => (
                  <tr key={`${c.chain}-${c.token}`} className="border-t border-vx-line">
                    <td className="py-1 capitalize text-vx-text">{sanitizeDisplayText(c.chain)}</td>
                    <td className="py-1 text-vx-text">{sanitizeDisplayText(c.token)}</td>
                    <td className="py-1 text-right num text-vx-text">{c.count}</td>
                    <td className="py-1 text-right num text-vx-muted">
                      <time dateTime={c.lastFillAt}>{timeAgo(c.lastFillAt)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Fill history ──────────────────────────────────────────────── */}
      <section className="card overflow-hidden" aria-labelledby="history-title">
        <div className="px-4 sm:px-5 py-3 border-b border-vx-border bg-vx-surface/30 flex flex-wrap items-center justify-between gap-2">
          <h2 id="history-title" className="text-sm font-semibold text-vx-text">
            {t("solverDetail.history.title")}
          </h2>
          <label className="text-xs text-vx-muted flex items-center gap-2">
            {t("solverDetail.history.status")}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as IntentStatus | "all");
                setPage(0);
              }}
              className={`bg-vx-surface border border-vx-border rounded px-2 py-1 text-vx-text ${FOCUS_RING}`}
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? t("solverDetail.history.all") : s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {pageItems.length === 0 ? (
          <div className="p-6 sm:p-8 text-center">
            <p className="text-sm font-medium text-vx-text mb-1">{t("solverDetail.fillHistory.empty.title")}</p>
            <p className="text-xs text-vx-muted max-w-xs mx-auto">{t("solverDetail.fillHistory.empty.message")}</p>
          </div>
        ) : (
          <ul className="divide-y divide-vx-line">
            {pageItems.map((fill) => (
              <li key={fill.id}>
                <Link
                  href={`/explore/${encodeURIComponent(fill.id)}`}
                  className={`flex items-center justify-between gap-4 px-4 sm:px-5 py-3 hover:bg-vx-surface/30 ${FOCUS_RING}`}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-vx-text truncate">
                      {fill.srcAmount} {sanitizeDisplayText(fill.srcToken)} → {sanitizeDisplayText(fill.dstToken)}
                    </div>
                    <div className="text-xs text-vx-muted capitalize">{sanitizeDisplayText(fill.srcChain)}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <IntentStatusBadge status={fill.status} />
                    <span className="text-xs text-vx-muted num">{timeAgo(fill.createdAt)}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 && (
          <nav aria-label={t("solverDetail.history.pagination")} className="flex items-center justify-between px-4 sm:px-5 py-2 border-t border-vx-border text-xs">
            <button
              type="button"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className={`text-vx-sage disabled:text-vx-muted rounded px-2 py-1 ${FOCUS_RING}`}
            >
              {t("solverDetail.history.prev")}
            </button>
            <span className="text-vx-muted num" aria-live="polite">
              {t("solverDetail.history.page", { page: currentPage + 1, total: pageCount })}
            </span>
            <button
              type="button"
              disabled={currentPage >= pageCount - 1}
              onClick={() => setPage(currentPage + 1)}
              className={`text-vx-sage disabled:text-vx-muted rounded px-2 py-1 ${FOCUS_RING}`}
            >
              {t("solverDetail.history.next")}
            </button>
          </nav>
        )}
      </section>
    </div>
  );
}
