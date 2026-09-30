/**
 * Shared transaction-lifecycle state machine (#416).
 *
 * Models the connect → build → review → sign → submit flow used by swap
 * submission, solver registration and intent acceptance. The reducer is pure:
 * every event is checked against the guard table below and an illegal
 * transition returns the *same* snapshot object, so it is a no-op for React.
 * See docs/transaction-flow.md for the statechart.
 */

/** Pending steps, in the only order the machine may traverse them. */
export const FLOW_STEPS = [
  "connecting",
  "building",
  "reviewing",
  "awaiting-signature",
  "submitting",
] as const;

export type FlowStep = (typeof FLOW_STEPS)[number];
export type FlowStatus = "idle" | FlowStep | "success" | "error";

export type FlowErrorKind =
  | "network"
  | "user-rejected"
  | "balance"
  | "no-solver"
  | "validation"
  | "generic";

export type FlowSnapshot = {
  status: FlowStatus;
  error: string | null;
  errorKind: FlowErrorKind | null;
  /** The pending step that was active when the run failed. */
  errorStep: FlowStep | null;
  /** Id of the current/last run (supplied by the caller, strictly increasing). */
  runId: number;
};

export type FlowEvent =
  | { type: "START"; runId: number; step: FlowStep }
  | { type: "ADVANCE"; runId: number; step: FlowStep }
  | { type: "SUCCEED"; runId: number }
  | { type: "FAIL"; runId: number; error: string; errorKind: FlowErrorKind }
  | { type: "CANCEL" }
  | { type: "RESET" };

export const INITIAL_FLOW_SNAPSHOT: FlowSnapshot = {
  status: "idle",
  error: null,
  errorKind: null,
  errorStep: null,
  runId: 0,
};

export function isPendingStatus(status: FlowStatus): status is FlowStep {
  return (FLOW_STEPS as readonly string[]).includes(status);
}

/** Guard: a pending step may only move strictly forward (steps can be skipped). */
export function canAdvance(from: FlowStatus, to: FlowStep): boolean {
  return isPendingStatus(from) && FLOW_STEPS.indexOf(to) > FLOW_STEPS.indexOf(from);
}

export function flowReducer(state: FlowSnapshot, event: FlowEvent): FlowSnapshot {
  switch (event.type) {
    case "START":
      // Double-submit guard: a new run can only begin from a resting state.
      // Starting from `error` is an explicit, user-initiated retry.
      if (isPendingStatus(state.status) || event.runId <= state.runId) return state;
      return {
        status: event.step,
        error: null,
        errorKind: null,
        errorStep: null,
        runId: event.runId,
      };
    case "ADVANCE":
      if (event.runId !== state.runId || !canAdvance(state.status, event.step)) return state;
      return { ...state, status: event.step };
    case "SUCCEED":
      if (event.runId !== state.runId || !isPendingStatus(state.status)) return state;
      return { ...state, status: "success" };
    case "FAIL":
      if (event.runId !== state.runId || !isPendingStatus(state.status)) return state;
      return {
        ...state,
        status: "error",
        error: event.error,
        errorKind: event.errorKind,
        errorStep: state.status,
      };
    case "CANCEL":
      // Cancelling never leaves a spinner: pending runs fall back to idle and
      // late ADVANCE/SUCCEED/FAIL events from that run are rejected by the
      // pending guard (or by runId once a newer run has started).
      if (!isPendingStatus(state.status)) return state;
      return { ...INITIAL_FLOW_SNAPSHOT, runId: state.runId };
    case "RESET":
      if (state.status === "idle") return state;
      return { ...INITIAL_FLOW_SNAPSHOT, runId: state.runId };
    default:
      return state;
  }
}
