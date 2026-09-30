import type { IntentDetail } from "@/lib/types";

/** Pure timeline model for an intent's lifecycle (#443). */

export type TimelineStepKey = "created" | "accepted" | "submitted" | "filled" | "failed";
export type TimelineStepState = "done" | "current" | "upcoming" | "skipped";

export type TimelineStep = {
  key: TimelineStepKey;
  state: TimelineStepState;
  /** ISO timestamp when known and parseable. */
  at: string | null;
  /** Milliseconds since the previous step that has a timestamp, when both are known. */
  durationMs: number | null;
  /** Solver that accepted the intent (only on the `accepted` step). */
  solver?: string;
};

const ORDER: Record<IntentDetail["status"], number> = { pending: 0, accepted: 1, filled: 3, failed: 3 };

function validIso(value: string | undefined): string | null {
  if (!value) return null;
  return Number.isNaN(new Date(value).getTime()) ? null : value;
}

export function buildTimeline(intent: IntentDetail): TimelineStep[] {
  const terminal: TimelineStepKey = intent.status === "failed" ? "failed" : "filled";
  const reached = ORDER[intent.status];
  const raw: Array<{ key: TimelineStepKey; index: number; at: string | null }> = [
    { key: "created", index: 0, at: validIso(intent.createdAt) },
    { key: "accepted", index: 1, at: validIso(intent.acceptedAt) },
    { key: "submitted", index: 2, at: validIso(intent.submittedAt) },
    {
      key: terminal,
      index: 3,
      at: validIso(terminal === "failed" ? intent.failedAt : intent.filledAt),
    },
  ];

  let previousAt: string | null = null;
  return raw.map(({ key, index, at }) => {
    let state: TimelineStepState;
    if (index < reached) state = "done";
    else if (index === reached) state = reached === 3 ? "done" : "current";
    else state = "upcoming";
    // A failure may happen before acceptance/submission: those steps never ran.
    if (intent.status === "failed" && index > 0 && index < 3 && !at) state = "skipped";

    const durationMs =
      at && previousAt && state === "done" ? Math.max(0, new Date(at).getTime() - new Date(previousAt).getTime()) : null;
    if (at && state === "done") previousAt = at;

    const step: TimelineStep = { key, state, at: state === "upcoming" ? null : at, durationMs };
    if (key === "accepted" && state !== "upcoming" && state !== "skipped" && intent.solver) step.solver = intent.solver;
    return step;
  });
}

/** Compact duration label, e.g. "45s", "3m 12s", "2h 5m". */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 60) return `${minutes}m ${totalSeconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}
