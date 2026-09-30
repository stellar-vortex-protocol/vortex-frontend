import { CHAINS, DST_TOKENS, SRC_TOKENS } from "@/lib/marketData";
import type { FeedItem, IntentStatus } from "@/lib/types";
import {
  addUtcBucket,
  autoGranularity,
  startOfUtcBucket,
  utcBucketKey,
  type Granularity,
} from "@/lib/time";
import { fromNumber, mul, toNumber, tryParseDecimal } from "@/lib/decimal";

/** Per-intent USD volume is computed exactly at micro-dollar precision. */
const USD_DECIMALS = 6;

export type AnalyticsBreakdownEntry = {
  label: string;
  value: number;
  percent: number;
  color: string;
};

export type AnalyticsRouteEntry = {
  sourceChain: string;
  destinationToken: string;
  value: number;
  count: number;
  color: string;
};

export type AnalyticsVolumePoint = {
  date: string;
  totalVolumeUsd: number;
};

// ─── KPI delta types (issue #467) ────────────────────────────────────────────

export type KpiDeltaState = "up" | "down" | "neutral" | "new" | "no-data";

export type KpiCard = {
  /** Current-period value */
  value: number;
  /** Absolute delta vs previous period (may be undefined when no prior data) */
  delta: number | undefined;
  /** Direction / quality of the delta */
  state: KpiDeltaState;
  /** Compact Intl-formatted value string */
  formatted: string;
  /** Full precision value for tooltip */
  formattedFull: string;
  /** Sparkline data points (value only, for the current period) */
  sparkline: number[];
};

export type KpiSummary = {
  totalVolume: KpiCard;
  rollingVolume: KpiCard;
  averageSize: KpiCard;
  intentCount: KpiCard;
};

// ─── Fill-time / SLA types (issue #465) ──────────────────────────────────────

export type FillTimePercentiles = {
  p50: number;
  p90: number;
  p99: number;
};

export type FillTimeHistogramBin = {
  /** Lower bound of bin in seconds */
  lower: number;
  /** Upper bound of bin in seconds */
  upper: number;
  count: number;
};

/** Configurable SLA thresholds (seconds). Centralised here so one file owns them. */
export const SLA_THRESHOLDS = {
  /** p50 must be under this to pass the p50 SLA */
  p50MaxSeconds: 30,
  /** p90 must be under this to pass the p90 SLA */
  p90MaxSeconds: 60,
  /** p99 must be under this to pass the p99 SLA */
  p99MaxSeconds: 120,
} as const;

export type SlaPanelData = {
  percentiles: FillTimePercentiles;
  histogram: FillTimeHistogramBin[];
  successRateByDay: { date: string; rate: number; count: number }[];
  /** Moving-average (7-day) success rate */
  successRateMovingAvg: { date: string; rate: number }[];
  /** Number of filled intents included in fill-time analysis */
  filledCount: number;
  /** Number of still-pending/accepted intents excluded from fill-time stats */
  pendingCount: number;
  /** Number of intents with negative durations clamped (clock skew) */
  clampedCount: number;
  /** Pass/fail for each SLA threshold */
  sla: {
    p50: boolean;
    p90: boolean;
    p99: boolean;
  };
};

// ─── Sankey / route-flow types (issue #464) ──────────────────────────────────

export type SankeyNode = {
  id: string;
  label: string;
  color: string;
  /** cumulative volume through this node */
  totalValue: number;
};

export type SankeyLink = {
  sourceId: string;
  targetId: string;
  value: number;
  count: number;
};

export type SankeyData = {
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** Total volume across all routes (for reconciliation with KPI card) */
  totalValue: number;
};

export type AnalyticsSummary = {
  totalIntents: number;
  totalVolumeUsd: number;
  rollingVolumeUsd: number;
  averageVolumeUsd: number;
  statusCounts: Record<IntentStatus, number>;
  chainBreakdown: AnalyticsBreakdownEntry[];
  destinationTokenBreakdown: AnalyticsBreakdownEntry[];
  routeBreakdown: AnalyticsRouteEntry[];
  volumeOverTime: AnalyticsVolumePoint[];
  granularity: Granularity;
  from: string;
  to: string;
  ignoredRows: number;
  /** True when the dataset is capped / partial (< full history loaded) */
  isCapped: boolean;
  /** How many intents are in the current loaded dataset */
  datasetSize: number;
  /** ISO date of the earliest intent in the dataset */
  datasetSince: string | undefined;
  /** KPI cards with period-over-period deltas and sparklines */
  kpis: KpiSummary;
  /** Fill-time / SLA analytics */
  slaPanel: SlaPanelData;
  /** Sankey flow data */
  sankeyData: SankeyData;
};

export type ComputeAnalyticsOptions = {
  from: Date;
  to: Date;
  granularity: Granularity;
  now: Date;
};

/**
 * Incremental delta applied to the aggregator. `insert` adds a new intent,
 * `update` replaces an existing intent (e.g. status change) and `remove`
 * evicts an intent by id. Deltas are keyed by `intent.id` so ordering across
 * messages does not matter as long as each id is applied at most once per
 * state transition.
 */
export type AnalyticsDelta =
  | { type: "insert"; intent: FeedItem }
  | { type: "update"; intent: FeedItem }
  | { type: "remove"; id: string };

const STATUS_KEYS: IntentStatus[] = ["pending", "accepted", "filled", "failed"];

/** Dataset is considered "capped" / partial when it has at least this many intents. */
const FEED_CAP = 200;

function formatDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getTokenPriceUsd(srcChain: string, tokenSymbol: string): number {
  const chainTokens = SRC_TOKENS[srcChain] ?? [];
  const exactMatch = chainTokens.find((token) => token.symbol === tokenSymbol);
  if (exactMatch) return exactMatch.priceUsd;

  const dstToken = DST_TOKENS.find((token) => token.symbol === tokenSymbol);
  if (dstToken) return dstToken.priceUsd;

  return 1;
}

function getChainColor(chainId: string): string {
  return CHAINS.find((chain) => chain.id === chainId)?.color ?? "#4CEBA8";
}

function emptyStatusCounts(): Record<IntentStatus, number> {
  return { pending: 0, accepted: 0, filled: 0, failed: 0 };
}

// ─── KPI helpers (issue #467) ─────────────────────────────────────────────────

/** Compact number formatter using Intl.NumberFormat notation:"compact" */
function formatCompact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCompactUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatFullUsd(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

const NEUTRAL_THRESHOLD = 0.001; // 0.1%

/**
 * Pure function: compute a KPI card with delta state.
 * Handles divide-by-zero, missing previous data, and neutral threshold.
 */
export function computeKpis(
  currentValue: number,
  previousValue: number | undefined,
  sparkline: number[],
  formatValue: (v: number) => string,
  formatFull: (v: number) => string,
): KpiCard {
  let delta: number | undefined;
  let state: KpiDeltaState;

  if (previousValue === undefined) {
    // No previous period data at all
    state = "no-data";
    delta = undefined;
  } else if (previousValue === 0 && currentValue > 0) {
    // Previous was zero — genuinely new activity
    state = "new";
    delta = undefined;
  } else if (previousValue === 0) {
    state = "neutral";
    delta = 0;
  } else {
    const relativeChange = (currentValue - previousValue) / Math.abs(previousValue);
    delta = currentValue - previousValue;
    if (Math.abs(relativeChange) < NEUTRAL_THRESHOLD) {
      state = "neutral";
    } else if (relativeChange > 0) {
      state = "up";
    } else {
      state = "down";
    }
  }

  return {
    value: currentValue,
    delta,
    state,
    formatted: formatValue(currentValue),
    formattedFull: formatFull(currentValue),
    sparkline,
  };
}

// ─── Percentile & histogram helpers (issue #465) ──────────────────────────────

/**
 * Nearest-rank percentile (1-indexed). Returns 0 for empty arrays.
 * Array must be sorted ascending before calling.
 */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  return sortedAsc[Math.min(rank, sortedAsc.length) - 1]!;
}

/** Log-ish histogram bins (seconds): 0-5, 5-10, 10-20, 20-30, 30-60, 60-120, 120-300, 300+ */
const HISTOGRAM_BINS: { lower: number; upper: number }[] = [
  { lower: 0, upper: 5 },
  { lower: 5, upper: 10 },
  { lower: 10, upper: 20 },
  { lower: 20, upper: 30 },
  { lower: 30, upper: 60 },
  { lower: 60, upper: 120 },
  { lower: 120, upper: 300 },
  { lower: 300, upper: Number.POSITIVE_INFINITY },
];

export function buildHistogram(fillTimesSeconds: number[]): FillTimeHistogramBin[] {
  return HISTOGRAM_BINS.map(({ lower, upper }) => ({
    lower,
    upper,
    count: fillTimesSeconds.filter((t) => t >= lower && t < upper).length,
  }));
}

/** 7-day moving average over a date-keyed rate series */
function movingAverage7(
  series: { date: string; rate: number; count: number }[],
): { date: string; rate: number }[] {
  return series.map((point, index) => {
    const window = series.slice(Math.max(0, index - 6), index + 1);
    const totalCount = window.reduce((s, p) => s + p.count, 0);
    const weightedRate =
      totalCount > 0
        ? window.reduce((s, p) => s + p.rate * p.count, 0) / totalCount
        : 0;
    return { date: point.date, rate: weightedRate };
  });
}

// ─── Sankey layout (issue #464) ───────────────────────────────────────────────

/**
 * Build Sankey node/link data from route breakdown.
 * Nodes: source chains (left) and destination tokens (right).
 * Links: directed edges from chain → token with volume.
 * Deterministic output (sorted by value desc then by id for equal values).
 */
export function buildSankeyData(
  intents: FeedItem[],
  minVolumeThreshold = 0,
): SankeyData {
  const chainVol = new Map<string, number>();
  const tokenVol = new Map<string, number>();
  const linkMap = new Map<string, { sourceId: string; targetId: string; value: number; count: number }>();

  let totalValue = 0;

  for (const intent of intents) {
    const amount = Number.parseFloat(intent.srcAmount ?? "0");
    const price = getTokenPriceUsd(intent.srcChain, intent.srcToken);
    const vol = Number.isFinite(amount) ? amount * price : 0;

    const srcId = `chain:${intent.srcChain}`;
    const dstId = `token:${intent.dstToken}`;

    chainVol.set(srcId, (chainVol.get(srcId) ?? 0) + vol);
    tokenVol.set(dstId, (tokenVol.get(dstId) ?? 0) + vol);
    totalValue += vol;

    const key = `${srcId}→${dstId}`;
    const existing = linkMap.get(key) ?? { sourceId: srcId, targetId: dstId, value: 0, count: 0 };
    existing.value += vol;
    existing.count += 1;
    linkMap.set(key, existing);
  }

  // Apply minimum-volume threshold — aggregate small routes into "Other" node
  const OTHER_TOKEN_ID = "token:Other";
  let otherValue = 0;
  let otherCount = 0;
  const filteredLinks: typeof linkMap extends Map<string, infer V> ? V[] : never[] = [];

  for (const link of linkMap.values()) {
    if (link.value < minVolumeThreshold) {
      otherValue += link.value;
      otherCount += link.count;
      tokenVol.set(OTHER_TOKEN_ID, (tokenVol.get(OTHER_TOKEN_ID) ?? 0) + link.value);
      // Remove from individual token volumes to keep totals correct
    } else {
      filteredLinks.push(link);
    }
  }

  if (otherValue > 0) {
    filteredLinks.push({ sourceId: "chain:other", targetId: OTHER_TOKEN_ID, value: otherValue, count: otherCount });
  }

  // Build nodes
  const chainNodes: SankeyNode[] = [...chainVol.entries()]
    .filter(([id]) => id !== "chain:other")
    .map(([id, totalVolume]) => {
      const chainId = id.replace("chain:", "");
      return {
        id,
        label: CHAINS.find((c) => c.id === chainId)?.name ?? chainId,
        color: getChainColor(chainId),
        totalValue: totalVolume,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue || a.id.localeCompare(b.id));

  const tokenNodes: SankeyNode[] = [...tokenVol.entries()]
    .map(([id, totalVolume]) => {
      const tokenSymbol = id.replace("token:", "");
      return {
        id,
        label: tokenSymbol,
        color: tokenSymbol === "XLM" ? "#4CEBA8" : tokenSymbol === "Other" ? "#6B7280" : "#A78BFA",
        totalValue: totalVolume,
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue || a.id.localeCompare(b.id));

  const links = filteredLinks.sort((a, b) => b.value - a.value || `${a.sourceId}${a.targetId}`.localeCompare(`${b.sourceId}${b.targetId}`));

  return {
    nodes: [...chainNodes, ...tokenNodes],
    links,
    totalValue,
  };
}

// ─── Main aggregator ──────────────────────────────────────────────────────────

export function computeAnalytics(allIntents: FeedItem[]): AnalyticsSummary {
  // Optimistic (unconfirmed client-side) entries never count toward analytics.
  const intents = allIntents.filter((i) => !(i as { optimistic?: boolean }).optimistic);
  const statusCounts: Record<IntentStatus, number> = {
    pending: 0,
    accepted: 0,
    filled: 0,
    failed: 0,
  };

/**
 * Incremental analytics aggregator. Both the synchronous `computeAnalytics`
 * helper and the Web Worker wrap this class so that incremental updates stay
 * equivalent to a full recompute. The class keeps per-intent contributions so
 * that `update`/`remove` can subtract the previous contribution before adding
 * the new one.
 */
export class AnalyticsAggregator {
  private readonly options: ComputeAnalyticsOptions;
  private readonly granularity: Granularity;
  private readonly fromMs: number;
  private readonly toMs: number;
  private readonly nowMs: number;
  private readonly sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  private readonly intents = new Map<string, FeedItem>();
  private readonly contributions = new Map<string, number>();

  private statusCounts: Record<IntentStatus, number> = emptyStatusCounts();
  private readonly chainMap = new Map<string, number>();
  private readonly destinationTokenMap = new Map<string, number>();
  private readonly routeMap = new Map<
    string,
    { sourceChain: string; destinationToken: string; value: number; count: number; color: string }
  >();
  private readonly volumeByBucket = new Map<string, number>();

  private totalVolumeUsd = 0;
  private rollingVolumeUsd = 0;
  private ignoredRows = 0;

  constructor(intents: FeedItem[], options: ComputeAnalyticsOptions) {
    this.options = options;
    this.granularity = autoGranularity(options.from, options.to, options.granularity);
    this.fromMs = options.from.getTime();
    this.toMs = options.to.getTime();
    this.nowMs = options.now.getTime();

    for (const intent of intents) {
      this.add(intent);
    }
  }

  /** Apply a single delta. Returns true when the aggregator state changed. */
  apply(delta: AnalyticsDelta): boolean {
    switch (delta.type) {
      case "insert":
        return this.add(delta.intent);
      case "update":
        return this.update(delta.intent);
      case "remove":
        return this.remove(delta.id);
      default:
        return false;
    }
  }

  /** Apply a batch of deltas in order. */
  applyAll(deltas: AnalyticsDelta[]): void {
    for (const delta of deltas) {
      this.apply(delta);
    }
  }

  add(intent: FeedItem): boolean {
    if (this.intents.has(intent.id)) {
      return this.update(intent);
    }

    const createdAtMs = new Date(intent.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) {
      this.ignoredRows += 1;
      this.intents.set(intent.id, intent);
      this.contributions.set(intent.id, 0);
      return true;
    }

    const amount = Number.parseFloat(intent.srcAmount ?? "0");
    const tokenPriceUsd = getTokenPriceUsd(intent.srcChain, intent.srcToken);
    // Exact decimal product; converted to a number only for chart aggregation.
    const volumeUsd = amount && Number.isFinite(tokenPriceUsd)
      ? toNumber(mul(amount, fromNumber(tokenPriceUsd, USD_DECIMALS), USD_DECIMALS))
      : 0;

    this.intents.set(intent.id, intent);
    this.contributions.set(intent.id, volumeUsd);

    this.totalVolumeUsd += volumeUsd;

    const createdAtMs = new Date(intent.createdAt).getTime();

    if (!datasetSince || intent.createdAt < datasetSince) {
      datasetSince = intent.createdAt;
    }

    if (Number.isFinite(createdAtMs) && now - createdAtMs <= sevenDaysMs) {
      rollingVolumeUsd += volumeUsd;
      sparklineByDay.set(dayKey, (sparklineByDay.get(dayKey) ?? 0) + volumeUsd);
      intentCountByDay.set(dayKey, (intentCountByDay.get(dayKey) ?? 0) + 1);
    } else if (Number.isFinite(createdAtMs) && now - createdAtMs <= fourteenDaysMs) {
      previousPeriodVolumeUsd += volumeUsd;
      previousPeriodRollingUsd += volumeUsd;
      previousPeriodIntents.push(intent);
    }

    if (createdAtMs >= this.fromMs && createdAtMs <= this.toMs) {
      const bucketKey = utcBucketKey(new Date(createdAtMs), this.granularity);
      this.volumeByBucket.set(bucketKey, (this.volumeByBucket.get(bucketKey) ?? 0) + volumeUsd);
    }

    if (this.nowMs - createdAtMs <= this.sevenDaysMs) {
      this.rollingVolumeUsd += volumeUsd;
    }
    }

    if (this.nowMs - createdAtMs <= this.sevenDaysMs) {
      this.rollingVolumeUsd += volumeUsd;
    }

    this.statusCounts[intent.status] += 1;

    this.chainMap.set(intent.srcChain, (this.chainMap.get(intent.srcChain) ?? 0) + volumeUsd);
    this.destinationTokenMap.set(
      intent.dstToken,
      (this.destinationTokenMap.get(intent.dstToken) ?? 0) + volumeUsd,
    );

    const routeKey = `${intent.srcChain}:${intent.dstToken}`;
    const routeEntry = this.routeMap.get(routeKey) ?? {
      sourceChain: intent.srcChain,
      destinationToken: intent.dstToken,
      value: 0,
      count: 0,
      color: getChainColor(intent.srcChain),
    };
    routeEntry.value += volumeUsd;
    routeEntry.count += 1;
    this.routeMap.set(routeKey, routeEntry);

    // Success-rate by day
    const dayBucket = successByDay.get(dayKey) ?? { filled: 0, total: 0 };
    dayBucket.total += 1;
    if (intent.status === "filled") {
      dayBucket.filled += 1;
    }
    successByDay.set(dayKey, dayBucket);

    // Fill-time computation
    if (intent.status === "filled" && intent.filledAt) {
      const createdMs = new Date(intent.createdAt).getTime();
      const filledMs = new Date(intent.filledAt).getTime();
      if (Number.isFinite(createdMs) && Number.isFinite(filledMs)) {
        let durationSeconds = (filledMs - createdMs) / 1000;
        if (durationSeconds < 0) {
          durationSeconds = 0;
          clampedCount += 1;
        }
        fillTimesSeconds.push(durationSeconds);
      }
    } else if (intent.status === "pending" || intent.status === "accepted") {
      pendingCount += 1;
    }

    return true;
  }

  update(intent: FeedItem): boolean {
    const previous = this.intents.get(intent.id);
    if (!previous) {
      return this.add(intent);
    }

    this.remove(intent.id);
    return this.add(intent);
  }

  remove(id: string): boolean {
    const intent = this.intents.get(id);
    if (!intent) {
      return false;
    }

    const volumeUsd = this.contributions.get(id) ?? 0;
    const createdAtMs = new Date(intent.createdAt).getTime();

    this.intents.delete(id);
    this.contributions.delete(id);

    if (!Number.isFinite(createdAtMs)) {
      this.ignoredRows = Math.max(0, this.ignoredRows - 1);
      return true;
    }

    this.totalVolumeUsd -= volumeUsd;

    if (createdAtMs >= this.fromMs && createdAtMs <= this.toMs) {
      const bucketKey = utcBucketKey(new Date(createdAtMs), this.granu

    const volumeUsd = this.contributions.get(id) ?? 0;
    const createdAtMs = new Date(intent.createdAt).getTime();

  remove(id: string): boolean {
    const intent = this.intents.get(id);
    if (!intent) {
      return false;
    }

    const volumeUsd = this.contributions.get(id) ?? 0;
    const createdAtMs = new Date(intent.createdAt).getTime();

}

/**
 * Pure analytics computation. Time is injected via `options.now`; no Date.now()
 * is called internally. Buckets are computed in UTC and empty buckets are
 * filled with zeros. Rows with invalid timestamps are ignored and counted.
 *
 * Delegates to `AnalyticsAggregator` so the synchronous path and the worker
 * path share the same core and stay equivalent.
 */
export function computeAnalytics(
  intents: FeedItem[],
  options: ComputeAnalyticsOptions,
): AnalyticsSummary {
  return new AnalyticsAggregator(intents, options).snapshot();
}

function buildVolumeSeries(
  volumeByBucket: Map<string, number>,
  from: Date,
  to: Date,
  granularity: Granularity,
): AnalyticsVolumePoint[] {
  if (to.getTime() < from.getTime()) {
    return [];
  }

  const points: AnalyticsVolumePoint[] = [];
  let cursor = startOfUtcBucket(from, granularity);
  const end = to.getTime();

  while (cursor.getTime() <= end) {
    const key = utcBucketKey(cursor, granularity);
    points.push({
      date: key,
      totalVolumeUsd: volumeByBucket.get(key) ?? 0,
    });
    cursor = addUtcBucket(cursor, granularity);
  }

  return points;
}

/** Build a 7-element sparkline array for the last 7 days (oldest first) */
function buildSparkline(byDay: Map<string, number>): number[] {
  const now = new Date();
  const points: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    points.push(byDay.get(key) ?? 0);
  }
  return points;
}

export function getStatusChartColors() {
  return {
    pending: "#FBBF24",
    accepted: "#60A5FA",
    filled: "#4CEBA8",
    failed: "#F87171",
  } as const;
}

export function getStatusDistributionEntries(statusCounts: Record<IntentStatus, number>) {
  const total = STATUS_KEYS.reduce((sum, status) => sum + statusCounts[status], 0);

  return STATUS_KEYS.map((status) => ({
    status,
    count: statusCounts[status],
    percent: total > 0 ? (statusCounts[status] / total) * 100 : 0,
    color: getStatusChartColors()[status],
  }));
}

// ─── Issue #468: Market-share series & concentration ─────────────────────────

export type ShareDimension = "srcChain" | "dstToken" | "solver";

export type ShareSeriesPoint = {
  /** ISO date string "YYYY-MM-DD" */
  date: string;
  /** entity label → share (0–100) */
  shares: Record<string, number>;
  /** entity label → raw volume USD */
  volumes: Record<string, number>;
};

export type ShareSeriesResult = {
  /** Ordered unique entity labels (top-N + "Other"). */
  entities: string[];
  /** One point per day, with normalised share and raw volume per entity. */
  series: ShareSeriesPoint[];
  /** Colours keyed by entity label. */
  colors: Record<string, string>;
};

/** Top-N entities to name individually; the rest collapse to "Other". */
const TOP_N = 5;

/**
 * Deterministic colour palette for entities without a registry colour.
 * Chosen for accessibility (WCAG AA contrast on dark backgrounds).
 */
const FALLBACK_PALETTE = [
  "#4CEBA8", // vx-sage
  "#A78BFA", // purple
  "#60A5FA", // blue
  "#F59E0B", // amber
  "#34D399", // emerald
  "#F87171", // red
  "#818CF8", // indigo
  "#FB923C", // orange
];

function entityColor(
  label: string,
  index: number,
  dimension: ShareDimension
): string {
  if (dimension === "srcChain") {
    const chain = CHAINS.find((c) => c.id === label);
    if (chain) return chain.color;
  }
  if (label === "Other") return "#6B7280"; // gray
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length] ?? "#4CEBA8";
}

/**
 * Build a stacked-area compatible share series for a given dimension.
 *
 * Algorithm:
 *   1. Bucket intents by day.
 *   2. Identify top-N entities by total volume across all days.
 *   3. For each day, compute each entity's share of that day's volume.
 *      Zero-volume days produce 0 share (never NaN).
 *   4. Entities outside top-N are collapsed into "Other".
 */
export function computeShareSeries(
  intents: FeedItem[],
  dimension: ShareDimension
): ShareSeriesResult {
  // Collect volume per (day, entity)
  const dayEntityVolume = new Map<string, Map<string, number>>();
  const entityTotals = new Map<string, number>();

  for (const intent of intents) {
    const amount = Number.parseFloat(intent.srcAmount ?? "0");
    const tokenPriceUsd = getTokenPriceUsd(intent.srcChain, intent.srcToken);
    const volumeUsd = Number.isFinite(amount) ? amount * tokenPriceUsd : 0;

    const day = formatDayKey(intent.createdAt);
    const entity =
      dimension === "srcChain"
        ? intent.srcChain
        : dimension === "dstToken"
        ? intent.dstToken
        : intent.solver;

    if (!dayEntityVolume.has(day)) {
      dayEntityVolume.set(day, new Map());
    }
    const dayMap = dayEntityVolume.get(day)!;
    dayMap.set(entity, (dayMap.get(entity) ?? 0) + volumeUsd);
    entityTotals.set(entity, (entityTotals.get(entity) ?? 0) + volumeUsd);
  }

  // Rank entities by total volume → take top-N
  const ranked = [...entityTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label]) => label);

  const topEntities = ranked.slice(0, TOP_N);
  const hasOther = ranked.length > TOP_N;
  const entities = hasOther ? [...topEntities, "Other"] : topEntities;

  // Build colours
  const colors: Record<string, string> = {};
  entities.forEach((label, i) => {
    colors[label] = entityColor(label, i, dimension);
  });

  // Build series over all days (fill gaps)
  const orderedDays = [...dayEntityVolume.keys()].sort();
  if (orderedDays.length === 0) {
    return { entities, series: [], colors };
  }

  const earliest = new Date(orderedDays[0]!);
  const latest = new Date(orderedDays[orderedDays.length - 1]!);
  const series: ShareSeriesPoint[] = [];
  const cursor = new Date(earliest);

  while (cursor <= latest) {
    const day = cursor.toISOString().slice(0, 10);
    const dayMap = dayEntityVolume.get(day) ?? new Map<string, number>();
    const dayTotal = [...dayMap.values()].reduce((sum, v) => sum + v, 0);

    const volumes: Record<string, number> = {};
    const shares: Record<string, number> = {};

    for (const entity of topEntities) {
      volumes[entity] = dayMap.get(entity) ?? 0;
    }

    if (hasOther) {
      let otherVolume = 0;
      for (const [ent, vol] of dayMap.entries()) {
        if (!topEntities.includes(ent)) {
          otherVolume += vol;
        }
      }
      volumes["Other"] = otherVolume;
    }

    for (const entity of entities) {
      shares[entity] =
        dayTotal > 0 ? ((volumes[entity] ?? 0) / dayTotal) * 100 : 0;
    }

    series.push({ date: day, shares, volumes });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { entities, series, colors };
}

// ─── Concentration (HHI) ──────────────────────────────────────────────────────

export type ConcentrationResult = {
  /**
   * Herfindahl–Hirschman Index, scaled 0–10 000.
   * > 2 500 = highly concentrated (one or few dominant entities).
   * 1 500–2 500 = moderately concentrated.
   * < 1 500 = competitive.
   */
  hhi: number;
  /** Share of the top-1 entity as a percentage (0–100). */
  top1SharePct: number;
  /** Combined share of the top-3 entities as a percentage (0–100). */
  top3SharePct: number;
  /** Human-readable concentration level for plain-language tooltip. */
  level: "competitive" | "moderate" | "concentrated";
  /** Ranked entities with their share percentages. */
  entities: { label: string; sharePct: number }[];
};

/**
 * Compute the Herfindahl–Hirschman Index for solver concentration.
 *
 * HHI = Σ (share_i)²  where share_i is expressed as 0–100.
 * Maximum HHI = 10 000 (monopoly).  Minimum → 0 (infinite competitors).
 */
export function computeConcentration(
  intents: FeedItem[],
  dimension: ShareDimension = "solver"
): ConcentrationResult {
  const totals = new Map<string, number>();
  let grandTotal = 0;

  for (const intent of intents) {
    const amount = Number.parseFloat(intent.srcAmount ?? "0");
    const tokenPriceUsd = getTokenPriceUsd(intent.srcChain, intent.srcToken);
    const volumeUsd = Number.isFinite(amount) ? amount * tokenPriceUsd : 0;

    const entity =
      dimension === "srcChain"
        ? intent.srcChain
        : dimension === "dstToken"
        ? intent.dstToken
        : intent.solver;

    totals.set(entity, (totals.get(entity) ?? 0) + volumeUsd);
    grandTotal += volumeUsd;
  }

  if (grandTotal === 0 || totals.size === 0) {
    return {
      hhi: 0,
      top1SharePct: 0,
      top3SharePct: 0,
      level: "competitive",
      entities: [],
    };
  }

  const ranked = [...totals.entries()]
    .map(([label, vol]) => ({
      label,
      sharePct: (vol / grandTotal) * 100,
    }))
    .sort((a, b) => b.sharePct - a.sharePct);

  const hhi = ranked.reduce((sum, e) => sum + e.sharePct * e.sharePct, 0);
  const top1SharePct = ranked[0]?.sharePct ?? 0;
  const top3SharePct = ranked
    .slice(0, 3)
    .reduce((sum, e) => sum + e.sharePct, 0);

  const level: ConcentrationResult["level"] =
    hhi > 2500 ? "concentrated" : hhi > 1500 ? "moderate" : "competitive";

  return {
    hhi: Math.round(hhi),
    top1SharePct: Math.round(top1SharePct * 10) / 10,
    top3SharePct: Math.round(top3SharePct * 10) / 10,
    level,
    entities: ranked,
  };
}

// ─── Top Movers ───────────────────────────────────────────────────────────────

export type TopMover = {
  label: string;
  currentSharePct: number;
  previousSharePct: number;
  /** Positive = gained share; negative = lost share. */
  deltaSharePct: number;
  color: string;
};

/**
 * Identify top movers by comparing share in the most-recent N-day window
 * vs the preceding N-day window.
 *
 * @param windowDays  How many days in each comparison window (default: 7).
 */
export function computeTopMovers(
  intents: FeedItem[],
  dimension: ShareDimension,
  windowDays = 7
): TopMover[] {
  const now = Date.now();
  const windowMs = windowDays * 24 * 60 * 60 * 1000;

  const currentWindow = intents.filter(
    (i) => now - new Date(i.createdAt).getTime() <= windowMs
  );
  const previousWindow = intents.filter((i) => {
    const age = now - new Date(i.createdAt).getTime();
    return age > windowMs && age <= 2 * windowMs;
  });

  function shareMap(items: FeedItem[]): Map<string, number> {
    const totals = new Map<string, number>();
    let grand = 0;
    for (const intent of items) {
      const amount = Number.parseFloat(intent.srcAmount ?? "0");
      const tokenPriceUsd = getTokenPriceUsd(intent.srcChain, intent.srcToken);
      const vol = Number.isFinite(amount) ? amount * tokenPriceUsd : 0;
      const entity =
        dimension === "srcChain"
          ? intent.srcChain
          : dimension === "dstToken"
          ? intent.dstToken
          : intent.solver;
      totals.set(entity, (totals.get(entity) ?? 0) + vol);
      grand += vol;
    }
    if (grand === 0) return new Map();
    return new Map(
      [...totals.entries()].map(([k, v]) => [k, (v / grand) * 100])
    );
  }

  const current = shareMap(currentWindow);
  const previous = shareMap(previousWindow);

  const allEntities = new Set([...current.keys(), ...previous.keys()]);
  const movers: TopMover[] = [];

  let colorIdx = 0;
  for (const label of allEntities) {
    const curr = current.get(label) ?? 0;
    const prev = previous.get(label) ?? 0;
    const delta = curr - prev;
    movers.push({
      label,
      currentSharePct: Math.round(curr * 10) / 10,
      previousSharePct: Math.round(prev * 10) / 10,
      deltaSharePct: Math.round(delta * 10) / 10,
      color: entityColor(label, colorIdx++, dimension),
    });
  }

  // Sort by absolute delta descending
  movers.sort((a, b) => Math.abs(b.deltaSharePct) - Math.abs(a.deltaSharePct));
  return movers.slice(0, 10);
}
