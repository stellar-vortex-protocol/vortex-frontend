import type { Solver } from "./types";

export const TIME_WINDOWS = ["24h", "7d", "30d", "all"] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export function isTimeWindow(value: string | null): value is TimeWindow {
  return value !== null && (TIME_WINDOWS as readonly string[]).includes(value);
}

export const LEADERBOARD_SORT_KEYS = [
  "rank",
  "name",
  "fills",
  "volumeUsd",
  "successRate",
  "avgFillTimeSeconds",
  "bondUsd",
] as const;
export type LeaderboardSortKey = (typeof LEADERBOARD_SORT_KEYS)[number];

export type SortDirection = "asc" | "desc";
export type SortSpec<K extends string = string> = { key: K; dir: SortDirection };

export type RankedSolver = Solver & {
  rank: number;
  /** Positive = moved up, negative = moved down, null = no previous rank. */
  rankDelta: number | null;
  /** Success rate recomputed from fills/failed; 0 for solvers with no attempts. */
  successRate: number;
};

/** Success rate in percent, guarded against divide-by-zero. */
export function successRate(solver: Pick<Solver, "fills" | "failed">): number {
  const attempts = solver.fills + solver.failed;
  if (!Number.isFinite(attempts) || attempts <= 0) return 0;
  return (solver.fills / attempts) * 100;
}

/**
 * Canonical ranking: volume desc, fills desc, success rate desc, avg fill time
 * asc, then address asc as a stable, deterministic tiebreaker.
 */
function compareForRank(a: Solver, b: Solver): number {
  return (
    b.volumeUsd - a.volumeUsd ||
    b.fills - a.fills ||
    successRate(b) - successRate(a) ||
    a.avgFillTimeSeconds - b.avgFillTimeSeconds ||
    a.address.localeCompare(b.address)
  );
}

/**
 * Rank solvers for a time window. Metrics are expected to already be scoped to
 * the window by the data source (`GET /solvers?window=`); `previousRanks`
 * (address → rank) is the fallback used when the relay omits `previousRank`.
 */
export function rankSolvers(
  solvers: readonly Solver[],
  previousRanks: Readonly<Record<string, number>> = {},
): RankedSolver[] {
  return [...solvers].sort(compareForRank).map((solver, index) => {
    const rank = index + 1;
    const prev = solver.previousRank ?? previousRanks[solver.address];
    return {
      ...solver,
      rank,
      rankDelta: typeof prev === "number" ? prev - rank : null,
      successRate: successRate(solver),
    };
  });
}

function sortValue(row: RankedSolver, key: LeaderboardSortKey): number | string {
  return key === "name" ? row.name.toLocaleLowerCase() : row[key];
}

/** Multi-key sort; falls back to rank so ties stay stable. */
export function sortRankedSolvers(
  rows: readonly RankedSolver[],
  sorts: readonly SortSpec<LeaderboardSortKey>[],
): RankedSolver[] {
  return [...rows].sort((a, b) => {
    for (const { key, dir } of sorts) {
      const av = sortValue(a, key);
      const bv = sortValue(b, key);
      const cmp =
        typeof av === "string" && typeof bv === "string"
          ? av.localeCompare(bv)
          : (av as number) - (bv as number);
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return a.rank - b.rank;
  });
}

/**
 * Plain click replaces the sort with the column (asc → desc → cleared);
 * shift-click adds/cycles the column as an additional key.
 */
export function toggleSort<K extends string>(
  sorts: readonly SortSpec<K>[],
  key: K,
  multi: boolean,
): SortSpec<K>[] {
  const existing = sorts.find((s) => s.key === key);
  const nextDir: SortDirection | null = !existing ? "asc" : existing.dir === "asc" ? "desc" : null;
  if (!multi) return nextDir ? [{ key, dir: nextDir }] : [];
  if (!existing) return [...sorts, { key, dir: "asc" }];
  return nextDir
    ? sorts.map((s) => (s.key === key ? { key, dir: nextDir } : s))
    : sorts.filter((s) => s.key !== key);
}

export function serializeSorts(sorts: readonly SortSpec[]): string {
  return sorts.map((s) => `${s.key}:${s.dir}`).join(",");
}

export function parseSorts<K extends string>(raw: string | null, allowed: readonly K[]): SortSpec<K>[] {
  if (!raw) return [];
  const out: SortSpec<K>[] = [];
  for (const part of raw.split(",")) {
    const [key = "", dir] = part.split(":");
    if ((allowed as readonly string[]).includes(key) && (dir === "asc" || dir === "desc")) {
      if (!out.some((s) => s.key === key)) out.push({ key: key as K, dir });
    }
  }
  return out;
}

export type LeaderboardFilters = {
  chain: string;
  status: "all" | "active" | "inactive";
  minBond: number;
  verifiedOnly: boolean;
};

export const DEFAULT_LEADERBOARD_FILTERS: LeaderboardFilters = {
  chain: "all",
  status: "all",
  minBond: 0,
  verifiedOnly: false,
};

export function filterSolvers<T extends Solver>(solvers: readonly T[], f: LeaderboardFilters): T[] {
  return solvers.filter(
    (s) =>
      (f.chain === "all" || s.chains.includes(f.chain)) &&
      (f.status === "all" || s.status === f.status) &&
      s.bondUsd >= f.minBond &&
      (!f.verifiedOnly || s.verified === true),
  );
}

// ── Local rank snapshots (fallback for rank deltas) ─────────────────────────

const SNAPSHOT_PREFIX = "vortex:leaderboard-ranks:";

type Snapshot = { previous: Record<string, number>; current: Record<string, number> };

function readSnapshot(window: TimeWindow): Snapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_PREFIX + window);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Snapshot>;
    if (typeof parsed.previous !== "object" || typeof parsed.current !== "object") return null;
    return { previous: parsed.previous ?? {}, current: parsed.current ?? {} };
  } catch {
    return null;
  }
}

function sameRanks(a: Record<string, number>, b: Record<string, number>): boolean {
  const ak = Object.keys(a);
  return ak.length === Object.keys(b).length && ak.every((k) => a[k] === b[k]);
}

/**
 * Records the latest observed ranks for `window` and returns the ranks from
 * the snapshot *before* the most recent change, so deltas persist across
 * reloads until the ranking moves again.
 */
export function updateRankSnapshot(
  window: TimeWindow,
  ranks: Record<string, number>,
): Record<string, number> {
  const stored = readSnapshot(window);
  let next: Snapshot;
  if (!stored) next = { previous: {}, current: ranks };
  else if (sameRanks(stored.current, ranks)) next = stored;
  else next = { previous: stored.current, current: ranks };
  try {
    localStorage.setItem(SNAPSHOT_PREFIX + window, JSON.stringify(next));
  } catch {
    // Best-effort only.
  }
  return next.previous;
}
