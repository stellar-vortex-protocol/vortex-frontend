import { CHAINS, DST_TOKENS, SRC_TOKENS } from "@/lib/marketData";
import type { FeedItem, IntentStatus } from "@/lib/types";

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
};

const STATUS_KEYS: IntentStatus[] = ["pending", "accepted", "filled", "failed"];

function formatDayKey(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getTokenPriceUsd(srcChain: string, tokenSymbol: string): number {
  const chainTokens = SRC_TOKENS[srcChain] ?? [];
  const exactMatch = chainTokens.find((token) => token.symbol === tokenSymbol);
  if (exactMatch) return exactMatch.priceUSD;

  const dstToken = DST_TOKENS.find((token) => token.symbol === tokenSymbol);
  if (dstToken) return dstToken.priceUSD;

  return 1;
}

function getChainColor(chainId: string): string {
  return CHAINS.find((chain) => chain.id === chainId)?.color ?? "#4CEBA8";
}

export function computeAnalytics(intents: FeedItem[]): AnalyticsSummary {
  const statusCounts: Record<IntentStatus, number> = {
    pending: 0,
    accepted: 0,
    filled: 0,
    failed: 0,
  };

  const chainMap = new Map<string, number>();
  const destinationTokenMap = new Map<string, number>();
  const routeMap = new Map<string, { sourceChain: string; destinationToken: string; value: number; count: number; color: string }>();
  const volumeByDay = new Map<string, number>();
  const now = Date.now();
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

  let totalVolumeUsd = 0;
  let rollingVolumeUsd = 0;

  for (const intent of intents) {
    const amount = Number.parseFloat(intent.srcAmount ?? "0");
    const tokenPriceUsd = getTokenPriceUsd(intent.srcChain, intent.srcToken);
    const volumeUsd = Number.isFinite(amount) ? amount * tokenPriceUsd : 0;

    totalVolumeUsd += volumeUsd;

    const dayKey = formatDayKey(intent.createdAt);
    volumeByDay.set(dayKey, (volumeByDay.get(dayKey) ?? 0) + volumeUsd);

    const createdAtMs = new Date(intent.createdAt).getTime();
    if (Number.isFinite(createdAtMs) && now - createdAtMs <= sevenDaysMs) {
      rollingVolumeUsd += volumeUsd;
    }

    statusCounts[intent.status] += 1;

    chainMap.set(intent.srcChain, (chainMap.get(intent.srcChain) ?? 0) + volumeUsd);
    destinationTokenMap.set(
      intent.dstToken,
      (destinationTokenMap.get(intent.dstToken) ?? 0) + volumeUsd,
    );

    const routeKey = `${intent.srcChain}:${intent.dstToken}`;
    const routeEntry = routeMap.get(routeKey) ?? {
      sourceChain: intent.srcChain,
      destinationToken: intent.dstToken,
      value: 0,
      count: 0,
      color: getChainColor(intent.srcChain),
    };

    routeEntry.value += volumeUsd;
    routeEntry.count += 1;
    routeMap.set(routeKey, routeEntry);
  }

  const chainBreakdown = [...chainMap.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: totalVolumeUsd > 0 ? (value / totalVolumeUsd) * 100 : 0,
      color: getChainColor(label),
    }))
    .sort((a, b) => b.value - a.value);

  const destinationTokenBreakdown = [...destinationTokenMap.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percent: totalVolumeUsd > 0 ? (value / totalVolumeUsd) * 100 : 0,
      color: DST_TOKENS.find((token) => token.symbol === label)?.symbol === "XLM"
        ? "#4CEBA8"
        : "#A78BFA",
    }))
    .sort((a, b) => b.value - a.value);

  const routeBreakdown = [...routeMap.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((entry) => ({
      ...entry,
      color: entry.color,
    }));

  const volumeOverTime = buildVolumeSeries(volumeByDay);

  return {
    totalIntents: intents.length,
    totalVolumeUsd,
    rollingVolumeUsd,
    averageVolumeUsd: intents.length > 0 ? totalVolumeUsd / intents.length : 0,
    statusCounts,
    chainBreakdown,
    destinationTokenBreakdown,
    routeBreakdown,
    volumeOverTime,
  };
}

function buildVolumeSeries(volumeByDay: Map<string, number>): AnalyticsVolumePoint[] {
  const orderedDates = [...volumeByDay.keys()].sort();
  if (orderedDates.length === 0) {
    return [];
  }

  const earliest = new Date(orderedDates[0]!);
  const latest = new Date(orderedDates[orderedDates.length - 1]!);
  const points: AnalyticsVolumePoint[] = [];
  const cursor = new Date(earliest);

  while (cursor <= latest) {
    const dayKey = cursor.toISOString().slice(0, 10);
    points.push({
      date: dayKey,
      totalVolumeUsd: volumeByDay.get(dayKey) ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
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
