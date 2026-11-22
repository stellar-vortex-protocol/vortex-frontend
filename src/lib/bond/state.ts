import { formatAmount, parseAmount, ZERO } from "@/lib/decimal";
import type { BondOperationKind, BondState } from "./types";

export type BondStatus = "active" | "inactive" | "invalid";

export type BondStatusReason = "zero-balance" | "invalid-balance" | null;

export type BondStatusResult = {
  status: BondStatus;
  reason: BondStatusReason;
};

/**
 * Derives the solver's bond status from the posted bond amount.
 * Zero maps to the existing inactive state; negative or non-finite amounts are invalid.
 */
export function deriveBondStatus(bond: string): BondStatusResult {
  const amount = parseAmount(bond);
  if (amount === null) return { status: "invalid", reason: "invalid-balance" };
  if (amount === ZERO) return { status: "inactive", reason: "zero-balance" };
  return { status: "active", reason: null };
}

/** Expected state after an operation; used for optimistic updates and the mock adapter. */
export function applyBondOperation(state: BondState, kind: BondOperationKind, amount: string): BondState {
  const delta = parseAmount(amount) ?? ZERO;
  const available = parseAmount(state.available) ?? ZERO;
  if (kind === "top-up") {
    return {
      ...state,
      bond: formatAmount((parseAmount(state.bond) ?? ZERO) + delta),
      available: formatAmount(available + delta),
    };
  }
  if (delta > available) throw new Error("Withdrawal exceeds available bond.");
  const now = Date.now();
  return {
    ...state,
    available: formatAmount(available - delta),
    pendingWithdrawals: [
      ...state.pendingWithdrawals,
      {
        id: `wd-${now}`,
        amount,
        requestedAt: new Date(now).toISOString(),
        availableAt: new Date(now + state.cooldownSeconds * 1000).toISOString(),
      },
    ],
  };
}
