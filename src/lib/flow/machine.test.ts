import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import {
  canAdvance,
  flowReducer,
  FLOW_STEPS,
  INITIAL_FLOW_SNAPSHOT,
  isPendingStatus,
  type FlowEvent,
  type FlowSnapshot,
  type FlowStatus,
} from "./machine";
import { classifyFlowError, FLOW_ERROR_GUIDANCE, isAbortError } from "./errors";
import { useTransactionFlow } from "./useTransactionFlow";

const STATUSES: FlowStatus[] = ["idle", ...FLOW_STEPS, "success", "error"];

function at(status: FlowStatus, runId = 1): FlowSnapshot {
  return { ...INITIAL_FLOW_SNAPSHOT, status, runId };
}

function eventsFor(runId: number): FlowEvent[] {
  return [
    ...FLOW_STEPS.map((step) => ({ type: "START", runId: runId + 1, step }) as const),
    ...FLOW_STEPS.map((step) => ({ type: "ADVANCE", runId, step }) as const),
    { type: "ADVANCE", runId: runId - 1, step: "submitting" },
    { type: "SUCCEED", runId },
    { type: "SUCCEED", runId: runId - 1 },
    { type: "FAIL", runId, error: "boom", errorKind: "generic" },
    { type: "FAIL", runId: runId - 1, error: "late", errorKind: "network" },
    { type: "CANCEL" },
    { type: "RESET" },
  ];
}

describe("flowReducer", () => {
  it("only allows the transitions in the statechart (exhaustive)", () => {
    for (const status of STATUSES) {
      for (const event of eventsFor(1)) {
        const before = at(status);
        const after = flowReducer(before, event);
        let legal: boolean;
        switch (event.type) {
          case "START":
            legal = !isPendingStatus(status);
            break;
          case "ADVANCE":
            legal = event.runId === 1 && canAdvance(status, event.step);
            break;
          case "SUCCEED":
          case "FAIL":
            legal = event.runId === 1 && isPendingStatus(status);
            break;
          case "CANCEL":
            legal = isPendingStatus(status);
            break;
          case "RESET":
            legal = status !== "idle";
            break;
        }
        if (legal) expect(after).not.toBe(before);
        else expect(after).toBe(before);
      }
    }
  });

  it("never reaches an illegal state under random event sequences (property)", () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31;
      return seed % n;
    };
    for (let trial = 0; trial < 500; trial++) {
      let state = INITIAL_FLOW_SNAPSHOT;
      for (let i = 0; i < 30; i++) {
        const events = eventsFor(state.runId);
        const prev = state;
        const event = events[rand(events.length)];
        if (!event) throw new Error("no event to apply");
        state = flowReducer(state, event);
        expect(STATUSES).toContain(state.status);
        // error details exist iff status is error
        expect(state.error !== null).toBe(state.status === "error");
        expect(state.errorStep !== null).toBe(state.status === "error");
        // pending steps only move forward within one run
        if (isPendingStatus(prev.status) && isPendingStatus(state.status) && prev.runId === state.runId) {
          expect(FLOW_STEPS.indexOf(state.status)).toBeGreaterThanOrEqual(FLOW_STEPS.indexOf(prev.status));
        }
        expect(state.runId).toBeGreaterThanOrEqual(prev.runId);
      }
    }
  });

  it("records the failing step and clears it on retry", () => {
    let s = flowReducer(INITIAL_FLOW_SNAPSHOT, { type: "START", runId: 1, step: "building" });
    s = flowReducer(s, { type: "ADVANCE", runId: 1, step: "awaiting-signature" });
    s = flowReducer(s, { type: "FAIL", runId: 1, error: "declined", errorKind: "user-rejected" });
    expect(s).toMatchObject({ status: "error", errorStep: "awaiting-signature", errorKind: "user-rejected" });
    s = flowReducer(s, { type: "START", runId: 2, step: "building" });
    expect(s).toMatchObject({ status: "building", error: null, errorKind: null, errorStep: null });
  });
});

describe("classifyFlowError", () => {
  const withStatus = (message: string, status: number) => Object.assign(new Error(message), { status });
  const named = (name: string, message = "x") => Object.assign(new Error(message), { name });

  it.each([
    [named("TimeoutError"), "network"],
    [new Error("Failed to fetch"), "network"],
    [new Error("User declined access"), "user-rejected"],
    [withStatus("no solver", 409), "no-solver"],
    [withStatus("insufficient funds", 422), "balance"],
    [named("XdrMismatchError"), "validation"],
    [named("ValidationError"), "validation"],
    [withStatus("server", 500), "generic"],
    ["not an error", "generic"],
  ])("classifies %s as %s", (err, kind) => {
    expect(classifyFlowError(err)).toBe(kind);
  });

  it("has guidance for every kind but generic", () => {
    expect(FLOW_ERROR_GUIDANCE.generic).toBe("");
    expect(FLOW_ERROR_GUIDANCE.network).not.toBe("");
    expect(isAbortError(named("AbortError"))).toBe(true);
  });
});

describe("useTransactionFlow", () => {
  it("ignores a double submit and cancels without leaving a pending state", async () => {
    let seenSignal: AbortSignal | undefined;
    let release: () => void = () => {};
    const { result } = renderHook(() =>
      useTransactionFlow<number, string>({
        run: async (_, { step }) => {
          await step("building", (signal) => {
            seenSignal = signal;
            return new Promise<void>((resolve) => {
              release = resolve;
            });
          });
          return "done";
        },
      }),
    );

    let first: Promise<string | undefined> = Promise.resolve(undefined);
    act(() => {
      first = result.current.start(1);
    });
    let second: string | undefined = "unset";
    await act(async () => {
      second = await result.current.start(2);
    });
    expect(second).toBeUndefined();
    expect(result.current.status).toBe("building");
    expect(result.current.activeParams).toBe(1);

    act(() => result.current.cancel());
    expect(seenSignal?.aborted).toBe(true);
    expect(result.current.status).toBe("idle");

    // A late response after cancel is discarded.
    await act(async () => {
      release();
      expect(await first).toBeUndefined();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("aborts the in-flight run on unmount", async () => {
    let seenSignal: AbortSignal | undefined;
    const { result, unmount } = renderHook(() =>
      useTransactionFlow<void, void>({
        run: (_, { step }) =>
          step("submitting", (signal) => {
            seenSignal = signal;
            return new Promise<void>(() => {});
          }),
      }),
    );
    act(() => {
      void result.current.start();
    });
    unmount();
    expect(seenSignal?.aborted).toBe(true);
  });
});
