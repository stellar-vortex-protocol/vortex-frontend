import { describe, expect, it } from "vitest";
import {
  evaluateEligibility,
  formatAmount,
  INITIAL_WIZARD_STATE,
  minBondUnits,
  parseAmount,
  suggestedBonds,
  validateStep,
  wizardReducer,
  type Eligibility,
  type WizardContext,
  type WizardState,
} from "./registrationWizard";

const ADDRESS = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const allPass: Eligibility = { wallet: "pass", network: "pass", address: "pass", notRegistered: "pass", funded: "pass" };
const ctx = (over: Partial<WizardContext> = {}): WizardContext => ({
  eligibility: allPass,
  walletAddress: ADDRESS,
  isRegistered: false,
  minBond: minBondUnits(),
  ...over,
});

describe("bond math", () => {
  it("parses and formats with 7-decimal precision (no float drift)", () => {
    expect(parseAmount("0.1")! + parseAmount("0.2")!).toBe(parseAmount("0.3"));
    expect(formatAmount(parseAmount("12.3400000")!)).toBe("12.34");
    expect(formatAmount(parseAmount("50")!)).toBe("50");
    expect(parseAmount("1.12345678")).toBeNull();
    expect(parseAmount("-1")).toBeNull();
    expect(parseAmount("1e3")).toBeNull();
  });

  it("suggests multiples of the minimum", () => {
    expect(suggestedBonds(parseAmount("50")!)).toEqual(["50", "100", "250"]);
  });
});

describe("evaluateEligibility", () => {
  const base = { isConnected: true, walletAddress: ADDRESS, networkMismatch: false, solversLoaded: true, isRegistered: false, funded: true };

  it("passes when every requirement is met", () => {
    expect(evaluateEligibility(base)).toEqual(allPass);
  });

  it("reports each failure and pending state", () => {
    expect(evaluateEligibility({ ...base, isConnected: false, walletAddress: null })).toMatchObject({ wallet: "fail", network: "pending", funded: "pending" });
    expect(evaluateEligibility({ ...base, networkMismatch: true }).network).toBe("fail");
    expect(evaluateEligibility({ ...base, walletAddress: "GBAD" }).address).toBe("fail");
    expect(evaluateEligibility({ ...base, isRegistered: true }).notRegistered).toBe("fail");
    expect(evaluateEligibility({ ...base, solversLoaded: false }).notRegistered).toBe("pending");
    expect(evaluateEligibility({ ...base, funded: false }).funded).toBe("fail");
    expect(evaluateEligibility({ ...base, funded: null }).funded).toBe("pending");
  });
});

describe("wizardReducer", () => {
  const at = (over: Partial<WizardState>): WizardState => ({ ...INITIAL_WIZARD_STATE, ...over });

  it("gates next on each step's validator", () => {
    const failing = ctx({ eligibility: { ...allPass, funded: "fail" } });
    expect(wizardReducer(INITIAL_WIZARD_STATE, { type: "next", ctx: failing }).step).toBe("eligibility");
    let s = wizardReducer(INITIAL_WIZARD_STATE, { type: "next", ctx: ctx() });
    expect(s).toMatchObject({ step: "verify", maxStep: 1 });
    expect(wizardReducer(s, { type: "next", ctx: ctx() }).step).toBe("verify");
    s = wizardReducer(wizardReducer(s, { type: "setAddress", value: ` ${ADDRESS} ` }), { type: "next", ctx: ctx() });
    expect(s.step).toBe("bond");
    s = wizardReducer(wizardReducer(s, { type: "setBond", value: "10" }), { type: "next", ctx: ctx() });
    expect(s.step).toBe("bond");
    s = wizardReducer(wizardReducer(s, { type: "setBond", value: "75.5" }), { type: "next", ctx: ctx() });
    expect(s).toMatchObject({ step: "review", maxStep: 3 });
    expect(wizardReducer(s, { type: "next", ctx: ctx() }).step).toBe("review");
    expect(wizardReducer(s, { type: "complete" }).step).toBe("done");
  });

  it("validates the verify step against wallet and registry", () => {
    const s = at({ step: "verify", address: ADDRESS });
    expect(validateStep("verify", at({ address: "nope" }), ctx())).toBe("solve.register.validation.invalidAddress");
    expect(validateStep("verify", s, ctx({ walletAddress: "GOTHER" }))).toBe("solve.wizard.error.addressMismatch");
    expect(validateStep("verify", s, ctx({ isRegistered: true }))).toBe("solve.wizard.error.alreadyRegistered");
    expect(validateStep("bond", at({ bond: "abc" }), ctx())).toBe("solve.wizard.error.bondInvalid");
  });

  it("navigates back and only jumps to reached steps", () => {
    const s = at({ step: "bond", maxStep: 2 });
    expect(wizardReducer(s, { type: "back" }).step).toBe("verify");
    expect(wizardReducer(at({}), { type: "back" }).step).toBe("eligibility");
    expect(wizardReducer(s, { type: "goto", step: "review" }).step).toBe("bond");
    expect(wizardReducer(s, { type: "goto", step: "eligibility" }).step).toBe("eligibility");
    expect(wizardReducer(at({ step: "done", maxStep: 4 }), { type: "goto", step: "bond" }).step).toBe("done");
  });

  it("resets with a notice (e.g. wallet switched)", () => {
    expect(wizardReducer(at({ step: "bond", maxStep: 2, address: ADDRESS }), { type: "reset", notice: "walletChanged" })).toEqual({
      ...INITIAL_WIZARD_STATE,
      notice: "walletChanged",
    });
  });

  it("restores drafts and sends a below-minimum bond back to the bond step", () => {
    const draft = { step: "review" as const, maxStep: 3, address: ADDRESS, bond: "60" };
    expect(wizardReducer(INITIAL_WIZARD_STATE, { type: "restore", draft, minBond: parseAmount("50")! })).toMatchObject({ step: "review", bond: "60" });
    expect(wizardReducer(INITIAL_WIZARD_STATE, { type: "restore", draft, minBond: parseAmount("100")! })).toMatchObject({
      step: "bond",
      notice: "bondBelowMin",
    });
    expect(wizardReducer(INITIAL_WIZARD_STATE, { type: "restore", draft: { ...draft, step: "done" }, minBond: BigInt(0) })).toBe(INITIAL_WIZARD_STATE);
  });
});
