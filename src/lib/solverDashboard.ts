import type { FeedItem, Solver } from "@/lib/types";
import { fillsInWindow, normalizeAddress } from "@/lib/solverStats";

/** Matches the registration minimum enforced in SolvePageClient. */
export const MIN_BOND_USD = 50;
/** Bond within this multiple of the minimum is flagged as "at risk". */
export const BOND_WARNING_MULTIPLIER = 1.5;
/** Accepted intents expiring within this window trigger the expiry notification. */
export const EXPIRY_WARNING_MS = 5 * 60_000;

export type BondHealth = { ratio: number; level: "healthy" | "warning" | "critical" };

export function bondHealth(bondUsd: number, minBondUsd: number = MIN_BOND_USD): BondHealth {
  const ratio = minBondUsd > 0 ? bondUsd / minBondUsd : 0;
  const level = ratio < 1 ? "critical" : ratio < BOND_WARNING_MULTIPLIER ? "warning" : "healthy";
  return { ratio, level };
}

/** Intents currently accepted by this solver, soonest deadline first. */
export function activeIntents(items: FeedItem[], solver: string): FeedItem[] {
  const me = normalizeAddress(solver);
  return items
    .filter((i) => i.status === "accepted" && normalizeAddress(i.solver) === me)
    .sort((a, b) => Date.parse(a.deadline ?? "") - Date.parse(b.deadline ?? "") || 0);
}

export function expiringSoon(intents: FeedItem[], now: number = Date.now()): FeedItem[] {
  return intents.filter((i) => {
    if (!i.deadline) return false;
    const left = Date.parse(i.deadline) - now;
    return left > 0 && left <= EXPIRY_WARNING_MS;
  });
}

export function fillCounts(items: FeedItem[], solver: string, now: number = Date.now()) {
  const me = normalizeAddress(solver);
  const mine = items.filter((i) => normalizeAddress(i.solver) === me && i.status === "filled");
  const last24h = mine.filter((i) => {
    const t = Date.parse(i.createdAt);
    return t <= now && now - t < 86_400_000;
  }).length;
  return {
    last24h,
    last7d: fillsInWindow(mine, 7, now).length,
    last30d: fillsInWindow(mine, 30, now).length,
  };
}

export type InactiveReason = "status" | "bondBelowMinimum";

export function inactiveReasons(solver: Solver, minBondUsd: number = MIN_BOND_USD): InactiveReason[] {
  const reasons: InactiveReason[] = [];
  if (solver.status === "inactive") reasons.push("status");
  if (solver.bondUsd < minBondUsd) reasons.push("bondBelowMinimum");
  return reasons;
}
