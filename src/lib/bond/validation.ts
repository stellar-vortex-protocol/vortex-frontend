import { parseAmount, ZERO } from "@/lib/decimal";
import type { BondOperationKind, BondState } from "./types";

/** Upper bound for a single top-up, guarding against fat-finger inputs. */
export const MAX_TOP_UP = "1000000";

export type BondAmountError = "invalid" | "zero" | "tooLarge" | "exceedsAvailable";

export type BondAmountCheck = {
  error: BondAmountError | null;
  /** Withdrawal would leave the bond under the minimum (solver becomes inactive). */
  dropsBelowMinimum: boolean;
};

export function checkBondAmount(kind: BondOperationKind, input: string, state: BondState): BondAmountCheck {
  const amount = parseAmount(input);
  if (amount === null) return { error: "invalid", dropsBelowMinimum: false };
  if (amount === ZERO) return { error: "zero", dropsBelowMinimum: false };
  if (kind === "top-up") {
    return { error: amount > (parseAmount(MAX_TOP_UP) ?? ZERO) ? "tooLarge" : null, dropsBelowMinimum: false };
  }
  const available = parseAmount(state.available) ?? ZERO;
  if (amount > available) return { error: "exceedsAvailable", dropsBelowMinimum: false };
  const remaining = (parseAmount(state.bond) ?? ZERO) - pendingTotal(state) - amount;
  return { error: null, dropsBelowMinimum: remaining < (parseAmount(state.minimumBond) ?? ZERO) };
}

function pendingTotal(state: BondState): bigint {
  return state.pendingWithdrawals.reduce((sum, w) => sum + (parseAmount(w.amount) ?? ZERO), ZERO);
}

/** `ok` when the effective bond (bond − pending withdrawals) meets the minimum. */
export function thresholdStatus(state: BondState): "ok" | "below-min" {
  const effective = (parseAmount(state.bond) ?? ZERO) - pendingTotal(state);
  return effective >= (parseAmount(state.minimumBond) ?? ZERO) ? "ok" : "below-min";
}
