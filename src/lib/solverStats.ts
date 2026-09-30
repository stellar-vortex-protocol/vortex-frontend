import type { FeedItem, IntentStatus, Solver } from "@/lib/types";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

// Pure solver metrics used by the solver profile, dashboard and compare
// views. Timezone policy: every bucket boundary (day, ISO week, window start)
// is computed in UTC so results never depend on the viewer's locale or DST.

const DAY_MS = 86_400_000;

export type StatsWindow = 7 | 30 | 90;
export const STATS_WINDOWS: StatsWindow[] = [7, 30, 90];

/** Below this many fills in a window, trend panels show "insufficient data". */
export const MIN_FILLS_FOR_TRENDS = 5;

/** ISO 8601 week key ("YYYY-Www") for a date, evaluated in UTC. */
export function isoWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7; // Mon=1 … Sun=7
  // The Thursday of this week decides which ISO year the week belongs to.
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** UTC Monday (00:00) of an ISO week key such as "2025-W01". */
export function isoWeekStart(isoWeek: string): Date {
  const [yearStr, weekStr] = isoWeek.split("-W");
  const year = Number(yearStr);
  const week = Number(weekStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  return new Date(jan4.getTime() - (jan4Day - 1) * DAY_MS + (week - 1) * 7 * DAY_MS);
}

/** Group items by ISO week (UTC). Sorted oldest → newest. */
export function groupByWeek(items: Pick<FeedItem, "createdAt">[]): Array<{ week: string; count: number }> {
  const map = new Map<string, number>();
  for (const item of items) {
    const d = new Date(item.createdAt);
    if (Number.isNaN(d.getTime())) continue;
    const week = isoWeekKey(d);
    map.set(week, (map.get(week) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, count]) => ({ week, count }));
}

export type StatsBucket = {
  /** ISO date (YYYY-MM-DD, UTC) of the bucket start. */
  start: string;
  fills: number;
  filled: number;
  failed: number;
  /** null when the bucket has no settled (filled/failed) intents. */
  successRatePct: number | null;
};

export type SolverStats = {
  window: StatsWindow;
  total: number;
  filled: number;
  failed: number;
  successRatePct: number | null;
  insufficientData: boolean;
  /** Daily buckets for 7/30 d, weekly buckets for 90 d; gaps are zero-filled. */
  series: StatsBucket[];
};

function startOfUtcDay(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function successRate(filled: number, failed: number): number | null {
  const settled = filled + failed;
  return settled === 0 ? null : Math.round((filled / settled) * 1000) / 10;
}

/** Fills whose createdAt falls in the last `days` days (UTC, inclusive of today). */
export function fillsInWindow(fills: FeedItem[], days: number, now: number = Date.now()): FeedItem[] {
  const from = startOfUtcDay(now) - (days - 1) * DAY_MS;
  return fills.filter((f) => {
    const t = Date.parse(f.createdAt);
    return !Number.isNaN(t) && t >= from && t <= now;
  });
}

export function computeSolverStats(
  fills: FeedItem[],
  window: StatsWindow,
  now: number = Date.now(),
): SolverStats {
  const inWindow = fillsInWindow(fills, window, now);
  const bucketDays = window === 90 ? 7 : 1;
  const bucketCount = Math.ceil(window / bucketDays);
  const from = startOfUtcDay(now) - (bucketCount * bucketDays - 1) * DAY_MS;

  const series: StatsBucket[] = Array.from({ length: bucketCount }, (_, i) => ({
    start: new Date(from + i * bucketDays * DAY_MS).toISOString().slice(0, 10),
    fills: 0,
    filled: 0,
    failed: 0,
    successRatePct: null,
  }));

  let filled = 0;
  let failed = 0;
  for (const f of inWindow) {
    const idx = Math.floor((Date.parse(f.createdAt) - from) / (bucketDays * DAY_MS));
    const bucket = series[idx];
    if (!bucket) continue;
    bucket.fills += 1;
    if (f.status === "filled") {
      bucket.filled += 1;
      filled += 1;
    } else if (f.status === "failed") {
      bucket.failed += 1;
      failed += 1;
    }
  }
  for (const b of series) b.successRatePct = successRate(b.filled, b.failed);

  return {
    window,
    total: inWindow.length,
    filled,
    failed,
    successRatePct: successRate(filled, failed),
    insufficientData: inWindow.length < MIN_FILLS_FOR_TRENDS,
    series,
  };
}

export type CoverageCell = { chain: string; token: string; count: number; lastFillAt: string };

/** Chain × destination-token coverage with counts and the most recent fill. */
export function computeCoverage(fills: FeedItem[]): CoverageCell[] {
  const map = new Map<string, CoverageCell>();
  for (const f of fills) {
    const key = `${f.srcChain}\u0000${f.dstToken}`;
    const cell = map.get(key);
    if (!cell) {
      map.set(key, { chain: f.srcChain, token: f.dstToken, count: 1, lastFillAt: f.createdAt });
    } else {
      cell.count += 1;
      if (Date.parse(f.createdAt) > Date.parse(cell.lastFillAt)) cell.lastFillAt = f.createdAt;
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => a.chain.localeCompare(b.chain) || a.token.localeCompare(b.token),
  );
}

export function filterByStatus(fills: FeedItem[], status: IntentStatus | "all"): FeedItem[] {
  return status === "all" ? fills : fills.filter((f) => f.status === status);
}

// ── Comparison ──────────────────────────────────────────────────────────────

export type CompareMetric = "successRatePct" | "avgFillTimeSeconds" | "fills" | "volumeUsd" | "bondUsd" | "chains";

/** Direction in which a metric is "better". */
export const COMPARE_METRICS: Array<{ key: CompareMetric; higherIsBetter: boolean }> = [
  { key: "successRatePct", higherIsBetter: true },
  { key: "avgFillTimeSeconds", higherIsBetter: false },
  { key: "fills", higherIsBetter: true },
  { key: "volumeUsd", higherIsBetter: true },
  { key: "bondUsd", higherIsBetter: true },
  { key: "chains", higherIsBetter: true },
];

export type CompareResult = Record<CompareMetric, { best: number[]; worst: number[] }>;

function metricValue(s: Solver, key: CompareMetric): number {
  return key === "chains" ? s.chains.length : s[key];
}

/**
 * Returns, per metric, the indexes of the best and worst solvers. `null`
 * entries (missing solvers) are skipped. When every value is equal, or fewer
 * than two solvers are present, neither best nor worst is marked.
 */
export function compareSolvers(solvers: Array<Solver | null>): CompareResult {
  const result = {} as CompareResult;
  for (const { key, higherIsBetter } of COMPARE_METRICS) {
    const present = solvers
      .map((s, i) => (s ? { i, v: metricValue(s, key) } : null))
      .filter((x): x is { i: number; v: number } => x !== null);
    const values = present.map((p) => p.v);
    const max = Math.max(...values);
    const min = Math.min(...values);
    if (present.length < 2 || max === min) {
      result[key] = { best: [], worst: [] };
      continue;
    }
    const bestV = higherIsBetter ? max : min;
    const worstV = higherIsBetter ? min : max;
    result[key] = {
      best: present.filter((p) => p.v === bestV).map((p) => p.i),
      worst: present.filter((p) => p.v === worstV).map((p) => p.i),
    };
  }
  return result;
}

export const MAX_COMPARE = 3;
export const COMPARE_PARAMS = ["a", "b", "c"] as const;

/**
 * Validates compare-page query values: keeps valid strkeys (deduplicated,
 * upper-cased, max 3) and reports everything else as invalid.
 */
export function parseCompareParams(values: Array<string | null | undefined>): { addresses: string[]; invalid: string[] } {
  const addresses: string[] = [];
  const invalid: string[] = [];
  for (const raw of values) {
    if (!raw) continue;
    const value = raw.trim().toUpperCase();
    if (!isValidStellarPublicKey(value)) invalid.push(raw);
    else if (!addresses.includes(value) && addresses.length < MAX_COMPARE) addresses.push(value);
  }
  return { addresses, invalid };
}

export function compareHref(addresses: string[]): string {
  const params = new URLSearchParams();
  addresses.slice(0, MAX_COMPARE).forEach((a, i) => params.set(COMPARE_PARAMS[i]!, a));
  return `/solve/compare?${params.toString()}`;
}

/** Shared chains across all present solvers. */
export function coverageOverlap(solvers: Array<Solver | null>): string[] {
  const present = solvers.filter((s): s is Solver => s !== null);
  if (present.length === 0) return [];
  return present[0]!.chains.filter((c) => present.every((s) => s.chains.includes(c)));
}

// ── Dashboard earnings ──────────────────────────────────────────────────────

/**
 * Estimated fee earnings formula: for every intent with status "filled",
 * earnings = srcAmount × SOLVER_FEE_BPS / 10 000, summed per source token.
 * Amounts are handled as fixed-point BigInt (7 decimals, Stellar's native
 * precision) so large values never lose precision.
 */
export const SOLVER_FEE_BPS = 10;
const SCALE_DECIMALS = 7;
const SCALE = BigInt(10) ** BigInt(SCALE_DECIMALS);

export function parseDecimal(value: string): bigint | null {
  const m = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) return null;
  const frac = (m[2] ?? "").slice(0, SCALE_DECIMALS).padEnd(SCALE_DECIMALS, "0");
  return BigInt(m[1]!) * SCALE + BigInt(frac);
}

export function formatDecimal(value: bigint): string {
  const whole = value / SCALE;
  const frac = (value % SCALE).toString().padStart(SCALE_DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function estimateEarnings(fills: FeedItem[], feeBps: number = SOLVER_FEE_BPS): Array<{ token: string; amount: string }> {
  const totals = new Map<string, bigint>();
  for (const f of fills) {
    if (f.status !== "filled") continue;
    const amount = parseDecimal(f.srcAmount);
    if (amount === null) continue;
    const fee = (amount * BigInt(feeBps)) / BigInt(10_000);
    totals.set(f.srcToken, (totals.get(f.srcToken) ?? BigInt(0)) + fee);
  }
  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([token, amount]) => ({ token, amount: formatDecimal(amount) }));
}

/** Case/whitespace-normalised Stellar address for equality checks. */
export function normalizeAddress(address: string | null | undefined): string {
  return (address ?? "").trim().toUpperCase();
}
