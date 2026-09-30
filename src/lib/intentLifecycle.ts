import type { FeedItem, IntentStatus } from "@/lib/types";

/**
 * Pure intent-lifecycle derivation for IntentTracker.
 *
 * Journey: submitted → accepted → filled | failed | expired.
 * "expired" is derived client-side (non-terminal status past its deadline)
 * and is deliberately distinct from "failed": an expired intent was never
 * picked up, so funds never left the source chain.
 */

export type TrackerPhase = "pending" | "accepted" | "filled" | "failed" | "expired";
export type TrackerStepId = "submitted" | "accepted" | "settled";
export type TrackerStepState = "complete" | "current" | "upcoming" | "failed" | "expired";

export interface TrackerStep {
  id: TrackerStepId;
  state: TrackerStepState;
  /** ISO timestamp when known; missing timestamps are left undefined. */
  at?: string;
}

export interface TrackerView {
  phase: TrackerPhase;
  steps: TrackerStep[];
  /** ms until the deadline (≥ 0), or null when terminal / no deadline. */
  msRemaining: number | null;
  isTerminal: boolean;
}

/** Timestamps observed client-side (the API only exposes createdAt). */
export type ObservedAt = Partial<Record<IntentStatus, string>>;

export type TrackableIntent = Pick<FeedItem, "id" | "status" | "createdAt" | "deadline">;

const STATUS_RANK: Record<IntentStatus, number> = {
  pending: 0,
  accepted: 1,
  filled: 2,
  failed: 2,
};

const validTime = (iso: string | undefined): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
};

export function derivePhase(intent: TrackableIntent, now: number): TrackerPhase {
  if (intent.status === "filled" || intent.status === "failed") return intent.status;
  const deadline = validTime(intent.deadline);
  if (deadline !== null && now >= deadline) return "expired";
  return intent.status;
}

export function deriveTrackerSteps(
  intent: TrackableIntent,
  now: number,
  observed: ObservedAt = {},
): TrackerView {
  const phase = derivePhase(intent, now);
  const isTerminal = phase === "filled" || phase === "failed" || phase === "expired";
  // "failed" alone doesn't prove a solver accepted; rely on an observed accept.
  const reachedAccepted =
    intent.status === "accepted" || intent.status === "filled" || Boolean(observed.accepted);

  const submitted: TrackerStep = {
    id: "submitted",
    state: "complete",
    at: validTime(intent.createdAt) !== null ? intent.createdAt : undefined,
  };

  let acceptedState: TrackerStepState;
  if (phase === "filled" || reachedAccepted) acceptedState = "complete";
  else if (phase === "expired") acceptedState = "expired";
  else if (phase === "failed") acceptedState = "failed";
  else acceptedState = "current";
  const accepted: TrackerStep = { id: "accepted", state: acceptedState, at: observed.accepted };

  let settledState: TrackerStepState;
  if (phase === "filled") settledState = "complete";
  else if (phase === "failed") settledState = "failed";
  else if (phase === "expired") settledState = "expired";
  else settledState = phase === "accepted" ? "current" : "upcoming";
  const settled: TrackerStep = {
    id: "settled",
    state: settledState,
    at: phase === "filled" ? observed.filled : phase === "failed" ? observed.failed : intent.deadline,
  };

  const deadline = validTime(intent.deadline);
  const msRemaining = !isTerminal && deadline !== null ? Math.max(0, deadline - now) : null;

  return { phase, steps: [submitted, accepted, settled], msRemaining, isTerminal };
}

/**
 * Merge a live update into the current view of an intent. Status never
 * regresses (out-of-order frames, stale REST responses after a WS update).
 */
export function mergeIntentUpdate<T extends TrackableIntent>(current: T | undefined, update: T): T {
  if (!current || current.id !== update.id) return update;
  if (STATUS_RANK[update.status] < STATUS_RANK[current.status]) {
    return { ...update, status: current.status };
  }
  return update;
}

/** "1h 02m", "4m 05s", "12s". */
export function formatCountdown(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}h ${pad(m)}m`;
  if (m > 0) return `${m}m ${pad(s)}s`;
  return `${s}s`;
}

/** Retry link: pre-fills SwapCard via its URL params. Destination is never carried over. */
export function retryHref(intent: Pick<FeedItem, "srcChain" | "srcToken" | "srcAmount" | "dstToken">): string {
  const params = new URLSearchParams({
    srcChain: intent.srcChain,
    srcToken: intent.srcToken,
    amount: intent.srcAmount,
    dstToken: intent.dstToken,
  });
  return `/?${params.toString()}`;
}

// ── Persistence of the last submitted intent (survives reloads mid-flight) ──

export const LAST_INTENT_KEY = "vortex:lastSubmittedIntent";
export const LAST_INTENT_EVENT = "vortex:last-intent-changed";

export function saveLastSubmittedIntent(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(LAST_INTENT_KEY, id);
    else window.localStorage.removeItem(LAST_INTENT_KEY);
  } catch {
    // Storage may be unavailable (private mode); the tracker just won't persist.
  }
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LAST_INTENT_EVENT));
}

export function loadLastSubmittedIntent(): string | null {
  try {
    return window.localStorage.getItem(LAST_INTENT_KEY);
  } catch {
    return null;
  }
}
