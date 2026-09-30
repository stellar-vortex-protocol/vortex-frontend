"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DataTable, type DataTableColumn } from "@/components/DataTable";
import { SkeletonCard } from "@/components/Skeleton";
import { SolverIdentityChip } from "@/components/SolverBadge";
import { useSolvers } from "@/hooks/useSolvers";
import { useSolverIdentity } from "@/hooks/useSolverIdentity";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { useQueryState } from "@/hooks/useQueryState";
import { useLocale, useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import { sanitizeDisplayText } from "@/lib/textSafety";
import { buildCsv, downloadCsv } from "@/lib/csv";
import {
  DEFAULT_LEADERBOARD_FILTERS,
  LEADERBOARD_SORT_KEYS,
  TIME_WINDOWS,
  filterSolvers,
  isTimeWindow,
  parseSorts,
  rankSolvers,
  serializeSorts,
  sortRankedSolvers,
  toggleSort,
  updateRankSnapshot,
  type LeaderboardFilters,
  type LeaderboardSortKey,
  type RankedSolver,
} from "@/lib/solverRanking";

const COLUMN_IDS = ["rank", "name", "fills", "volumeUsd", "successRate", "avgFillTimeSeconds", "bondUsd"] as const;
type ColumnId = (typeof COLUMN_IDS)[number];
const ALWAYS_VISIBLE: readonly ColumnId[] = ["rank", "name"];

function RankDelta({ delta }: { delta: number | null }) {
  const { t } = useTranslation();
  if (delta === null) return <span className="text-[10px] text-vx-muted">{t("solve.leaderboard.rankNew")}</span>;
  if (delta === 0) {
    return (
      <span className="text-[10px] text-vx-muted">
        <span aria-hidden="true">–</span>
        <span className="sr-only">{t("solve.leaderboard.rankSame")}</span>
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span className={`text-[10px] ${up ? "text-vx-sage" : "text-red-400"}`}>
      <span aria-hidden="true">
        {up ? "▲" : "▼"}
        {Math.abs(delta)}
      </span>
      <span className="sr-only">
        {t(up ? "solve.leaderboard.rankUp" : "solve.leaderboard.rankDown", { count: Math.abs(delta) })}
      </span>
    </span>
  );
}

function SolverNameCell({ solver }: { solver: RankedSolver }) {
  const identity = useSolverIdentity(solver.address, solver.homeDomain);
  return (
    <div className="min-w-0 max-sm:text-right">
      <Link
        href={`/solve/${solver.address}`}
        className="text-sm font-semibold text-vx-text hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage rounded"
      >
        {sanitizeDisplayText(solver.name)}
      </Link>
      <div className="num text-[11px] text-vx-muted truncate max-w-[14rem]">{solver.address}</div>
      {solver.homeDomain ? (
        <div className="mt-1">
          <SolverIdentityChip identity={identity} />
        </div>
      ) : null}
    </div>
  );
}

function readFilters(params: URLSearchParams): LeaderboardFilters {
  const status = params.get("status");
  const minBond = Number(params.get("minBond"));
  return {
    chain: params.get("chain") || DEFAULT_LEADERBOARD_FILTERS.chain,
    status: status === "active" || status === "inactive" ? status : "all",
    minBond: Number.isFinite(minBond) && minBond > 0 ? minBond : 0,
    verifiedOnly: params.get("verified") === "1",
  };
}

export function SolverLeaderboard() {
  const { t } = useTranslation();
  const locale = useLocale();
  const { params, update } = useQueryState();

  const windowParam = params.get("window");
  const timeWindow = isTimeWindow(windowParam) ? windowParam : "all";
  const filters = readFilters(new URLSearchParams(params.toString()));
  const sorts = parseSorts<LeaderboardSortKey>(params.get("sort"), LEADERBOARD_SORT_KEYS);

  const { solvers, isLoading, error } = useSolvers(timeWindow);
  const { visibility, toggle, isToggleable } = useColumnVisibility<ColumnId>(
    "vortex:leaderboard-columns",
    COLUMN_IDS,
    ALWAYS_VISIBLE,
  );

  // Rank deltas: relay `previousRank` wins; otherwise the locally persisted
  // snapshot for this window. Snapshot is updated after data arrives.
  const baseRanked = useMemo(() => rankSolvers(solvers), [solvers]);
  const [previousRanks, setPreviousRanks] = useState<Record<string, number>>({});
  useEffect(() => {
    if (baseRanked.length === 0) return;
    const current = Object.fromEntries(baseRanked.map((s) => [s.address, s.rank]));
    setPreviousRanks(updateRankSnapshot(timeWindow, current));
  }, [baseRanked, timeWindow]);

  const ranked = useMemo(() => rankSolvers(solvers, previousRanks), [solvers, previousRanks]);
  const { chain, status, minBond, verifiedOnly } = filters;
  const sortParam = serializeSorts(sorts);
  const rows = useMemo(
    () =>
      sortRankedSolvers(
        filterSolvers(ranked, { chain, status, minBond, verifiedOnly }),
        parseSorts<LeaderboardSortKey>(sortParam, LEADERBOARD_SORT_KEYS),
      ),
    [ranked, chain, status, minBond, verifiedOnly, sortParam],
  );

  const chains = useMemo(
    () => Array.from(new Set(solvers.flatMap((s) => s.chains))).sort(),
    [solvers],
  );

  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pct = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale]);
  const usd = useMemo(
    () => new Intl.NumberFormat(locale, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }),
    [locale],
  );

  const headers: Record<ColumnId, string> = {
    rank: t("solve.leaderboard.rank"),
    name: t("solve.leaderboard.solver"),
    fills: t("solve.leaderboard.fills"),
    volumeUsd: t("solve.leaderboard.volume"),
    successRate: t("solve.leaderboard.success"),
    avgFillTimeSeconds: t("solve.leaderboard.avgTime"),
    bondUsd: t("solve.leaderboard.bond"),
  };

  const allColumns: DataTableColumn<RankedSolver, ColumnId>[] = [
    {
      id: "rank",
      header: headers.rank,
      sortable: true,
      cell: (s) => (
        <span className="inline-flex items-center gap-2">
          <span className="num font-bold text-vx-dim">{String(s.rank).padStart(2, "0")}</span>
          <RankDelta delta={s.rankDelta} />
        </span>
      ),
    },
    { id: "name", header: headers.name, sortable: true, isRowHeader: true, cell: (s) => <SolverNameCell solver={s} /> },
    { id: "fills", header: headers.fills, sortable: true, align: "right", cell: (s) => <span className="num">{nf.format(s.fills)}</span> },
    { id: "volumeUsd", header: headers.volumeUsd, sortable: true, align: "right", cell: (s) => <span className="num">{usd.format(s.volumeUsd)}</span> },
    {
      id: "successRate",
      header: headers.successRate,
      sortable: true,
      align: "right",
      cell: (s) => (
        <span className={`num ${s.successRate > 99 ? "text-vx-sage" : "text-vx-amber"}`}>{pct.format(s.successRate)}%</span>
      ),
    },
    { id: "avgFillTimeSeconds", header: headers.avgFillTimeSeconds, sortable: true, align: "right", cell: (s) => <span className="num">{nf.format(s.avgFillTimeSeconds)}s</span> },
    { id: "bondUsd", header: headers.bondUsd, sortable: true, align: "right", cell: (s) => <span className="num">{usd.format(s.bondUsd)}</span> },
  ];
  const columns = allColumns.filter((c) => visibility[c.id]);

  const setFilter = (updates: Record<string, string | null>) => update(updates);

  const exportCsv = () => {
    const ids = columns.map((c) => c.id);
    const value = (s: RankedSolver, id: ColumnId): string | number => {
      if (id === "name") return sanitizeDisplayText(s.name);
      if (id === "successRate") return s.successRate.toFixed(1);
      return s[id];
    };
    const csv = buildCsv(
      [...ids.map((id) => headers[id]), "address"],
      rows.map((s) => [...ids.map((id) => value(s, id)), s.address]),
    );
    downloadCsv(`vortex-solvers-${timeWindow}.csv`, csv);
  };

  const control =
    "bg-vx-surface border border-vx-border rounded-md px-2 py-1.5 text-xs text-vx-text focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage";

  return (
    <div className="card overflow-hidden">
      <div className="px-3 sm:px-5 py-3 border-b border-vx-border bg-vx-surface/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-vx-text">{t("solve.leaderboard.title")}</h2>
          <div role="group" aria-label={t("solve.leaderboard.windowLabel")} className="inline-flex gap-1">
            {TIME_WINDOWS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={timeWindow === w}
                onClick={() => update({ window: w === "all" ? null : w })}
                className={`px-2 py-1 rounded text-[11px] border focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage ${
                  timeWindow === w
                    ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                    : "text-vx-muted border-transparent hover:text-vx-text hover:border-vx-border"
                }`}
              >
                {t(`solve.leaderboard.window.${w}` as MessageKey)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-[10px] text-vx-muted">
            {t("solve.leaderboard.filter.chain")}
            <select className={control} value={filters.chain} onChange={(e) => setFilter({ chain: e.target.value === "all" ? null : e.target.value })}>
              <option value="all">{t("solve.leaderboard.filter.all")}</option>
              {chains.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-vx-muted">
            {t("solve.leaderboard.filter.status")}
            <select className={control} value={filters.status} onChange={(e) => setFilter({ status: e.target.value === "all" ? null : e.target.value })}>
              <option value="all">{t("solve.leaderboard.filter.all")}</option>
              <option value="active">{t("solve.leaderboard.filter.active")}</option>
              <option value="inactive">{t("solve.leaderboard.filter.inactive")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[10px] text-vx-muted">
            {t("solve.leaderboard.filter.minBond")}
            <input
              type="number"
              min={0}
              inputMode="decimal"
              className={`${control} w-24`}
              value={filters.minBond || ""}
              onChange={(e) => setFilter({ minBond: e.target.value && Number(e.target.value) > 0 ? e.target.value : null })}
            />
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs text-vx-muted py-1.5">
            <input
              type="checkbox"
              checked={filters.verifiedOnly}
              onChange={(e) => setFilter({ verified: e.target.checked ? "1" : null })}
              className="accent-vx-sage"
            />
            {t("solve.leaderboard.filter.verifiedOnly")}
          </label>

          <div className="ml-auto flex items-center gap-2">
            <details className="relative">
              <summary className={`${control} cursor-pointer list-none`}>{t("solve.leaderboard.columns")}</summary>
              <fieldset className="absolute right-0 z-20 mt-1 w-44 card p-2 space-y-1">
                <legend className="sr-only">{t("solve.leaderboard.columns")}</legend>
                {COLUMN_IDS.map((id) => (
                  <label key={id} className="flex items-center gap-2 text-xs text-vx-text">
                    <input
                      type="checkbox"
                      checked={visibility[id]}
                      disabled={!isToggleable(id)}
                      onChange={() => toggle(id)}
                      className="accent-vx-sage"
                    />
                    {headers[id]}
                  </label>
                ))}
              </fieldset>
            </details>
            <button type="button" onClick={exportCsv} disabled={rows.length === 0} className={`${control} disabled:opacity-50`}>
              {t("solve.leaderboard.exportCsv")}
            </button>
          </div>
        </div>
      </div>

      {isLoading && solvers.length === 0 ? (
        <div className="p-5">
          <SkeletonCard rows={3} rowHeight="h-16" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-vx-muted">{t("solve.leaderboard.error")}</div>
      ) : rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-vx-muted">
          {solvers.length === 0 ? t("solve.leaderboard.empty") : t("solve.leaderboard.noMatches")}
        </div>
      ) : (
        <DataTable
          caption={t("solve.leaderboard.title")}
          sortHint={t("solve.leaderboard.sortHint")}
          columns={columns}
          rows={rows}
          getRowKey={(s) => s.address}
          sorts={sorts}
          onSort={(key, multi) => {
            const next = toggleSort(sorts, key as LeaderboardSortKey, multi);
            update({ sort: next.length ? serializeSorts(next) : null });
          }}
        />
      )}
    </div>
  );
}
