/**
 * Analytics snapshot export utilities.
 * Builds CSV bundles (KPIs, volume series, routes) with safe CSV escaping.
 * Shareable URL encoding/decoding for analytics range/filter state.
 */

import { escapeCsv } from "@/lib/csv";
import type { AnalyticsSummary, AnalyticsVolumePoint, AnalyticsRouteEntry } from "@/lib/analytics";

// ─── CSV export ────────────────────────────────────────────────────────────────

type ExportMeta = {
  title: string;
  range: string;
  generatedAt: string;
  network: string;
  dataCompletenessNote: string;
};

function buildMetaRows(meta: ExportMeta): string {
  const lines = [
    `# ${escapeCsv(meta.title)}`,
    `# Range: ${escapeCsv(meta.range)}`,
    `# Generated: ${escapeCsv(meta.generatedAt)}`,
    `# Network: ${escapeCsv(meta.network)}`,
    `# Note: ${escapeCsv(meta.dataCompletenessNote)}`,
    "",
  ];
  return lines.join("\n");
}

function volumeSeriesCsv(points: AnalyticsVolumePoint[]): string {
  const header = "date,totalVolumeUsd";
  const rows = points.map(
    (p) => `${escapeCsv(p.date)},${escapeCsv(p.totalVolumeUsd.toFixed(2))}`,
  );
  return [header, ...rows].join("\n");
}

function routesCsv(routes: AnalyticsRouteEntry[]): string {
  const header = "sourceChain,destinationToken,volumeUsd,intentCount,sharePercent";
  const totalVol = routes.reduce((s, r) => s + r.value, 0);
  const rows = routes.map((r) =>
    [
      escapeCsv(r.sourceChain),
      escapeCsv(r.destinationToken),
      escapeCsv(r.value.toFixed(2)),
      escapeCsv(String(r.count)),
      escapeCsv(totalVol > 0 ? ((r.value / totalVol) * 100).toFixed(2) : "0.00"),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

function kpisCsv(summary: AnalyticsSummary): string {
  const header = "metric,value";
  const rows = [
    `totalVolumeUsd,${summary.totalVolumeUsd.toFixed(2)}`,
    `rollingVolume7dUsd,${summary.rollingVolumeUsd.toFixed(2)}`,
    `averageIntentSizeUsd,${summary.averageVolumeUsd.toFixed(2)}`,
    `totalIntents,${summary.totalIntents}`,
    `filledIntents,${summary.statusCounts.filled}`,
    `failedIntents,${summary.statusCounts.failed}`,
    `pendingIntents,${summary.statusCounts.pending}`,
  ];
  return [header, ...rows].join("\n");
}

/**
 * Build a multi-section CSV bundle for analytics export.
 * Sections are separated by blank lines with section headers.
 */
export function buildAnalyticsCsvBundle(
  summary: AnalyticsSummary,
  meta: ExportMeta,
): string {
  const sections = [
    buildMetaRows(meta),
    "## KPIs\n" + kpisCsv(summary),
    "",
    "## Volume Series\n" + volumeSeriesCsv(summary.volumeOverTime),
    "",
    "## Routes\n" + routesCsv(summary.routeBreakdown),
  ];
  return sections.join("\n");
}

// ─── Shareable URL state ──────────────────────────────────────────────────────

export type AnalyticsShareState = {
  /** Date range start ISO string */
  from?: string;
  /** Date range end ISO string */
  to?: string;
  /** Selected chain filter */
  chain?: string;
  /** Selected token filter */
  token?: string;
};

const SHARE_PARAM = "av"; // analytics-view — short to keep URLs tidy

/**
 * Encode analytics filter state into a URL search-param string.
 * Only encodes range/filter data — never wallet or personal data.
 */
export function encodeShareState(state: AnalyticsShareState): string {
  const compact: Record<string, string> = {};
  if (state.from) compact.f = state.from;
  if (state.to) compact.t = state.to;
  if (state.chain) compact.c = state.chain;
  if (state.token) compact.tk = state.token;
  return btoa(JSON.stringify(compact));
}

/**
 * Decode analytics filter state from a URL search-param value.
 * Returns null if the param is missing, malformed, or contains unexpected keys.
 */
export function decodeShareState(raw: string | null): AnalyticsShareState | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(atob(raw)) as Record<string, unknown>;
    const ALLOWED_KEYS = new Set(["f", "t", "c", "tk"]);
    // Validate — reject if any unexpected key is present
    for (const key of Object.keys(decoded)) {
      if (!ALLOWED_KEYS.has(key)) return null;
    }
    const state: AnalyticsShareState = {};
    if (typeof decoded.f === "string") state.from = decoded.f;
    if (typeof decoded.t === "string") state.to = decoded.t;
    if (typeof decoded.c === "string") state.chain = decoded.c;
    if (typeof decoded.tk === "string") state.token = decoded.tk;
    return state;
  } catch {
    return null;
  }
}

/**
 * Build a full shareable URL for the analytics page.
 * Reads current pathname from window.location.
 */
export function buildShareUrl(state: AnalyticsShareState): string {
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(SHARE_PARAM, encodeShareState(state));
  return url.toString();
}

/**
 * Read share state from the current URL (client-side only).
 * Returns null when not in a browser context or param is absent/invalid.
 */
export function readShareStateFromUrl(): AnalyticsShareState | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return decodeShareState(params.get(SHARE_PARAM));
}

export { SHARE_PARAM };
