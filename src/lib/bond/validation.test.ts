import { describe, expect, it } from "vitest";
import { validateBondAmount } from "./validation";

describe("validateBondAmount", () => {
  it("accepts a positive amount", () => {
    expect(validateBondAmount(5)).toEqual({ ok: true, amount: 5 });
  });

  it("rejects non-finite amounts", () => {
    expect(validateBondAmount(NaN).ok).toBe(false);
    expect(validateBondAmount(Infinity).ok).toBe(false);
    expect(validateBondAmount(-Infinity).ok).toBe(false);
  });

  it("rejects zero", () => {
    expect(validateBondAmount(0).ok).toBe(false);
  });

  it("rejects negative amounts", () => {
    expect(validateBondAmount(-1).ok).toBe(false);
    expect(validateBondAmount(-5).ok).toBe(false);
  });
});
