import { describe, expect, it } from "vitest";
import { formatAmount, parseAmount } from "@/lib/decimal";
import { applyBondOperation } from "./state";
import { bondFeatureMode } from "./flag";
import { checkBondAmount, thresholdStatus } from "./validation";
import type { BondState } from "./types";

const state: BondState = {
  address: "G",
  bond: "100",
  locked: "20",
  available: "80",
  minimumBond: "50",
  cooldownSeconds: 60,
  pendingWithdrawals: [],
};

describe("decimal", () => {
  it("parses and formats without float drift", () => {
    expect(formatAmount(parseAmount("0.1")! + parseAmount("0.2")!)).toBe("0.3");
    expect(parseAmount("1.12345678")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
});

describe("checkBondAmount", () => {
  it("rejects malformed, zero and oversized amounts", () => {
    expect(checkBondAmount("top-up", "1e3", state).error).toBe("invalid");
    expect(checkBondAmount("top-up", "0", state).error).toBe("zero");
    expect(checkBondAmount("top-up", "1000001", state).error).toBe("tooLarge");
    expect(checkBondAmount("withdrawal", "80.0000001", state).error).toBe("exceedsAvailable");
  });

  it("flags withdrawals that drop the bond below the minimum", () => {
    expect(checkBondAmount("withdrawal", "50", state).dropsBelowMinimum).toBe(false);
    expect(checkBondAmount("withdrawal", "50.0000001", state).dropsBelowMinimum).toBe(true);
  });
});

describe("bond state", () => {
  it("applies operations and derives threshold status", () => {
    const toppedUp = applyBondOperation(state, "top-up", "5");
    expect(toppedUp.bond).toBe("105");
    const withdrawn = applyBondOperation(state, "withdrawal", "60");
    expect(withdrawn.available).toBe("20");
    expect(withdrawn.pendingWithdrawals).toHaveLength(1);
    expect(thresholdStatus(withdrawn)).toBe("below-min");
    expect(thresholdStatus(state)).toBe("ok");
  });

  it("reads the feature flag", () => {
    expect(bondFeatureMode(undefined)).toBe("off");
    expect(bondFeatureMode("mock")).toBe("mock");
    expect(bondFeatureMode("1")).toBe("live");
  });
});
