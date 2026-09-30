import { isValidStellarPublicKey } from "./stellarAddress";
import type { MessageKey } from "./i18n";

// ── Bond configuration & precision-safe math ───────────────────────────────

/**
 * Solver bond parameters. Mirrors the solver-registry contract config; update
 * both together. The bond is denominated in USDC (1 USDC = 1 USD).
 */
export const SOLVER_BOND_CONFIG = {
  minBondUsd: "50",
  /** Unbonding period: capital stays locked this long after a withdrawal request. */
  lockDays: 7,
  suggestedMultipliers: [1, 2, 5],
  assetCode: "USDC",
} as const;

/** Stellar amounts have 7 decimal places. */
const DECIMALS = 7;
const SCALE = BigInt(10) ** BigInt(DECIMALS);

/** Parse a decimal string into integer base units; null when invalid. */
export function parseAmount(value: string): bigint | null {
  const v = value.trim();
  const m = /^(\d{1,15})(?:\.(\d{1,7}))?$/.exec(v);
  if (!m) return null;
  return BigInt(m[1] ?? "0") * SCALE + BigInt((m[2] ?? "").padEnd(DECIMALS, "0"));
}

/** Format base units back to a trimmed decimal string. */
export function formatAmount(units: bigint): string {
  const whole = units / SCALE;
  const frac = (units % SCALE).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function minBondUnits(): bigint {
  return parseAmount(SOLVER_BOND_CONFIG.minBondUsd) ?? BigInt(0);
}

export function suggestedBonds(min: bigint = minBondUnits()): string[] {
  return SOLVER_BOND_CONFIG.suggestedMultipliers.map((m) => formatAmount(min * BigInt(m)));
}

// ── Eligibility ─────────────────────────────────────────────────────────────

export type CheckStatus = "pass" | "fail" | "pending";
export const ELIGIBILITY_CHECKS = ["wallet", "network", "address", "notRegistered", "funded"] as const;
export type EligibilityCheck = (typeof ELIGIBILITY_CHECKS)[number];
export type Eligibility = Record<EligibilityCheck, CheckStatus>;

export type EligibilityInput = {
  isConnected: boolean;
  walletAddress: string | null;
  networkMismatch: boolean;
  solversLoaded: boolean;
  isRegistered: boolean;
  /** null = not checked yet / in flight. */
  funded: boolean | null;
};

export function evaluateEligibility(i: EligibilityInput): Eligibility {
  const connected = i.isConnected && !!i.walletAddress;
  const validAddress = connected && isValidStellarPublicKey(i.walletAddress ?? "");
  return {
    wallet: connected ? "pass" : "fail",
    network: !connected ? "pending" : i.networkMismatch ? "fail" : "pass",
    address: !connected ? "pending" : validAddress ? "pass" : "fail",
    notRegistered: !validAddress || !i.solversLoaded ? "pending" : i.isRegistered ? "fail" : "pass",
    funded: !validAddress || i.funded === null ? "pending" : i.funded ? "pass" : "fail",
  };
}

// ── Wizard reducer ──────────────────────────────────────────────────────────

export const WIZARD_STEPS = ["eligibility", "verify", "bond", "review", "done"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
export type WizardNotice = "walletChanged" | "bondBelowMin" | null;

export type WizardState = {
  step: WizardStep;
  /** Furthest step index reached — steps up to it can be revisited. */
  maxStep: number;
  address: string;
  bond: string;
  notice: WizardNotice;
};

export type WizardContext = {
  eligibility: Eligibility;
  walletAddress: string | null;
  isRegistered: boolean;
  minBond: bigint;
};

export type WizardDraft = Pick<WizardState, "step" | "maxStep" | "address" | "bond">;

export type WizardAction =
  | { type: "next"; ctx: WizardContext }
  | { type: "back" }
  | { type: "goto"; step: WizardStep }
  | { type: "setAddress"; value: string }
  | { type: "setBond"; value: string }
  | { type: "complete" }
  | { type: "reset"; notice?: WizardNotice }
  | { type: "restore"; draft: WizardDraft; minBond: bigint };

export const INITIAL_WIZARD_STATE: WizardState = {
  step: "eligibility",
  maxStep: 0,
  address: "",
  bond: "",
  notice: null,
};

const indexOf = (s: WizardStep) => WIZARD_STEPS.indexOf(s);

/** Returns the i18n key of the first blocking problem on `step`, or null. */
export function validateStep(step: WizardStep, s: WizardState, ctx: WizardContext): MessageKey | null {
  switch (step) {
    case "eligibility":
      return Object.values(ctx.eligibility).every((c) => c === "pass")
        ? null
        : "solve.wizard.error.eligibility";
    case "verify":
      if (!isValidStellarPublicKey(s.address)) return "solve.register.validation.invalidAddress";
      if (s.address !== ctx.walletAddress) return "solve.wizard.error.addressMismatch";
      if (ctx.isRegistered) return "solve.wizard.error.alreadyRegistered";
      return null;
    case "bond": {
      const units = parseAmount(s.bond);
      if (units === null) return "solve.wizard.error.bondInvalid";
      if (units < ctx.minBond) return "solve.register.validation.minimumBond";
      return null;
    }
    default:
      return null;
  }
}

export function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case "next": {
      const i = indexOf(state.step);
      if (state.step === "review" || state.step === "done") return state;
      if (validateStep(state.step, state, action.ctx)) return state;
      const next = WIZARD_STEPS[i + 1] ?? state.step;
      return { ...state, step: next, maxStep: Math.max(state.maxStep, i + 1), notice: null };
    }
    case "back": {
      const i = indexOf(state.step);
      if (i === 0 || state.step === "done") return state;
      return { ...state, step: WIZARD_STEPS[i - 1] ?? state.step };
    }
    case "goto": {
      const i = indexOf(action.step);
      if (i < 0 || i > state.maxStep || state.step === "done" || action.step === "done") return state;
      return { ...state, step: action.step };
    }
    case "setAddress":
      return { ...state, address: action.value.trim() };
    case "setBond":
      return { ...state, bond: action.value.trim(), notice: state.notice === "bondBelowMin" ? null : state.notice };
    case "complete":
      return { ...state, step: "done", maxStep: indexOf("done") };
    case "reset":
      return { ...INITIAL_WIZARD_STATE, notice: action.notice ?? null };
    case "restore": {
      const d = action.draft;
      const stepIdx = indexOf(d.step);
      if (stepIdx < 0 || d.step === "done") return state;
      const maxStep = Math.min(Math.max(d.maxStep, stepIdx), indexOf("review"));
      const restored: WizardState = {
        step: d.step,
        maxStep,
        address: typeof d.address === "string" ? d.address : "",
        bond: typeof d.bond === "string" ? d.bond : "",
        notice: null,
      };
      // The minimum may have been raised since the draft was saved.
      const units = parseAmount(restored.bond);
      if (restored.bond && (units === null || units < action.minBond) && stepIdx > indexOf("bond")) {
        return { ...restored, step: "bond", notice: "bondBelowMin" };
      }
      return restored;
    }
  }
}
