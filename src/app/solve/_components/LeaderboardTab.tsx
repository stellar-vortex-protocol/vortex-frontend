"use client";

import { useMemo, useState } from "react";
import { SkeletonCard } from "@/components/Skeleton";
import { useSolvers } from "@/hooks/useSolvers";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n";
import type { Solver } from "@/lib/types";
import { SolverRow } from "./SolverRow";

type SortField = "name" | "volume" | "fills" | "success";
type SortDirection = "asc" | "desc";

const SORT_FIELDS: { field: SortField; label: MessageKey }[] = [
  { field: "name", label: "solve.leaderboard.sort.name" },
  { field: "volume", label: "solve.leaderboard.volume" },
  { field: "fills", label: "solve.leaderboard.fills" },
  { field: "success", label: "solve.leaderboard.success" },
];

export function sortSolvers(solvers: Solver[], field: SortField, direction: SortDirection): Solver[] {
  const sign = direction === "asc" ? 1 : -1;
  return [...solvers].sort((a, b) => {
    switch (field) {
      case "name":
        return sign * a.name.localeCompare(b.name);
      case "volume":
        return sign * (a.volumeUsd - b.volumeUsd);
      case "fills":
        return sign * (a.fills - b.fills);
      case "success":
        return sign * (a.successRatePct - b.successRatePct);
    }
  });
}

export function LeaderboardTab() {
  const { t } = useTranslation();
  const { solvers, isLoading, error } = useSolvers();
  const [sortField, setSortField] = useState<SortField>("volume");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const sorted = useMemo(() => sortSolvers(solvers, sortField, sortDirection), [solvers, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "name" ? "asc" : "desc");
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="px-3 sm:px-5 py-3 sm:py-3.5 border-b border-vx-border bg-vx-surface/30 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-vx-text">{t("solve.leaderboard.title")}</span>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("solve.leaderboard.sortLabel")}>
          {SORT_FIELDS.map(({ field, label }) => {
            const active = sortField === field;
            return (
              <button
                key={field}
                type="button"
                onClick={() => handleSort(field)}
                aria-pressed={active}
                className={`px-2 py-1 rounded text-[11px] border transition-colors ${
                  active
                    ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                    : "text-vx-muted hover:text-vx-text border-transparent hover:border-vx-border"
                }`}
              >
                {t(label)}
                {active && <span aria-hidden="true">{sortDirection === "asc" ? " ↑" : " ↓"}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {isLoading && solvers.length === 0 ? (
        <div className="p-5">
          <SkeletonCard rows={3} rowHeight="h-16" />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-sm text-vx-muted">{t("solve.leaderboard.error")}</div>
      ) : solvers.length === 0 ? (
        <div className="p-8 text-center text-sm text-vx-muted">{t("solve.leaderboard.empty")}</div>
      ) : (
        <div className="divide-y divide-vx-line">
          {sorted.map((solver, index) => (
            <SolverRow key={solver.address} solver={solver} rank={index + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
