import { afterEach, describe, expect, it } from "vitest";
import {
  deriveTrackerSteps,
  formatCountdown,
  LAST_INTENT_KEY,
  loadLastSubmittedIntent,
  mergeIntentUpdate,
  retryHref,
  saveLastSubmittedIntent,
  type TrackableIntent,
} from "./intentLifecycle";

const NOW = Date.parse("2026-01-01T12:00:00Z");
const base: TrackableIntent = {
  id: "i1",
  status: "pending",
  createdAt: "2026-01-01T11:55:00Z",
  deadline: "2026-01-01T12:10:00Z",
};

describe("deriveTrackerSteps", () => {
  it.each([
    // [label, overrides, phase, [submitted, accepted, settled], msRemaining]
    ["pending", {}, "pending", ["complete", "current", "upcoming"], 600_000],
    ["accepted", { status: "accepted" }, "accepted", ["complete", "complete", "current"], 600_000],
    ["filled", { status: "filled" }, "filled", ["complete", "complete", "complete"], null],
    ["failed", { status: "failed" }, "failed", ["complete", "failed", "failed"], null],
    ["expired while pending", { deadline: "2026-01-01T11:59:00Z" }, "expired", ["complete", "expired", "expired"], null],
    ["expired after accept", { status: "accepted", deadline: "2026-01-01T11:59:00Z" }, "expired", ["complete", "complete", "expired"], null],
    ["filled after deadline stays filled", { status: "filled", deadline: "2026-01-01T11:00:00Z" }, "filled", ["complete", "complete", "complete"], null],
    ["no deadline", { deadline: undefined }, "pending", ["complete", "current", "upcoming"], null],
    ["invalid deadline", { deadline: "garbage" }, "pending", ["complete", "current", "upcoming"], null],
  ] as const)("%s", (_label, overrides, phase, states, ms) => {
    const view = deriveTrackerSteps({ ...base, ...overrides } as TrackableIntent, NOW);
    expect(view.phase).toBe(phase);
    expect(view.steps.map((s) => s.state)).toEqual(states);
    expect(view.msRemaining).toBe(ms);
    expect(view.isTerminal).toBe(["filled", "failed", "expired"].includes(phase));
  });

  it("attaches known timestamps and tolerates missing ones", () => {
    const view = deriveTrackerSteps({ ...base, status: "filled" }, NOW, {
      accepted: "2026-01-01T11:57:00Z",
      filled: "2026-01-01T11:58:00Z",
    });
    expect(view.steps.map((s) => s.at)).toEqual([
      base.createdAt,
      "2026-01-01T11:57:00Z",
      "2026-01-01T11:58:00Z",
    ]);
    const bare = deriveTrackerSteps({ ...base, createdAt: "not a date", status: "failed" }, NOW);
    expect(bare.steps[0]!.at).toBeUndefined();
    expect(bare.steps[1]!.at).toBeUndefined();
    expect(bare.steps[2]!.at).toBeUndefined();
  });
});

describe("mergeIntentUpdate", () => {
  it("never regresses status on out-of-order updates", () => {
    const filled = { ...base, status: "filled" as const };
    expect(mergeIntentUpdate(filled, { ...base, status: "pending" }).status).toBe("filled");
    expect(mergeIntentUpdate({ ...base }, { ...base, status: "accepted" }).status).toBe("accepted");
    expect(mergeIntentUpdate(undefined, base)).toBe(base);
    expect(mergeIntentUpdate({ ...base, id: "x", status: "filled" }, base)).toBe(base);
  });
});

describe("helpers", () => {
  afterEach(() => window.localStorage.clear());

  it("formats countdowns", () => {
    expect(formatCountdown(12_000)).toBe("12s");
    expect(formatCountdown(245_000)).toBe("4m 05s");
    expect(formatCountdown(3_720_000)).toBe("1h 02m");
  });

  it("builds a retry link without the destination address", () => {
    const href = retryHref({ srcChain: "base", srcToken: "USDC", srcAmount: "1.5", dstToken: "XLM" });
    expect(href).toBe("/?srcChain=base&srcToken=USDC&amount=1.5&dstToken=XLM");
    expect(href).not.toContain("dst=");
  });

  it("persists and clears the last submitted intent", () => {
    saveLastSubmittedIntent("abc");
    expect(window.localStorage.getItem(LAST_INTENT_KEY)).toBe("abc");
    expect(loadLastSubmittedIntent()).toBe("abc");
    saveLastSubmittedIntent(null);
    expect(loadLastSubmittedIntent()).toBeNull();
  });
});
