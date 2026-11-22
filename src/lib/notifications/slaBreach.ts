import type { NotificationIntent } from "@/lib/notifications/dispatcher";

export type SlaPercentileKey = "p50" | "p90" | "p99";

export type SlaPassState = Record<SlaPercentileKey, boolean>;

export type SlaBreachTransition = {
  percentile: SlaPercentileKey;
};

export type SlaThresholds = Record<SlaPercentileKey, number>;

export const SLA_PERCENTILE_KEYS: readonly SlaPercentileKey[] = ["p50", "p90", "p99"];

/**
 * Detect pass→fail transitions for each SLA percentile.
 *
 * `previous` is the last observed pass state (null on first observation, which
 * never alerts). Only `true → false` transitions are reported; sustained
 * failures (`false → false`) are suppressed so a breach notifies exactly once.
 */
export function detectSlaBreachTransitions(
  previous: SlaPassState | null,
  current: SlaPassState,
): SlaBreachTransition[] {
  if (!previous) return [];
  return SLA_PERCENTILE_KEYS.filter((key) => previous[key] === true && current[key] === false).map((key) => ({
    percentile: key,
  }));
}

/** Build the in-app notification intent for a set of SLA breaches. */
export function buildSlaBreachIntent(
  transitions: SlaBreachTransition[],
  percentiles: Record<SlaPercentileKey, number>,
  thresholds: SlaThresholds,
): NotificationIntent | null {
  if (transitions.length === 0) return null;
  const labels = transitions.map((t) => t.percentile).join(", ");
  const details = transitions
    .map((t) => `${t.percentile} ${percentiles[t.percentile].toFixed(1)}s > ${thresholds[t.percentile]}s`)
    .join("; ");
  return {
    status: "failed",
    title: `SLA breach: ${labels}`,
    body: `Fill-time SLA breached — ${details}.`,
    href: "/analytics",
  };
}
