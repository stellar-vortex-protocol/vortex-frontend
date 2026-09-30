/**
 * Assumed solver bond API contract (see docs/bond-management.md).
 * All amounts are decimal strings in USDC with up to 7 decimal places.
 */
export type PendingWithdrawal = {
  id: string;
  amount: string;
  requestedAt: string;
  /** ISO time the cooldown ends and funds can be claimed. */
  availableAt: string;
};

export type BondState = {
  address: string;
  /** Total bond posted. */
  bond: string;
  /** Portion backing accepted-but-unsettled intents. */
  locked: string;
  /** bond − locked − pending withdrawals. */
  available: string;
  minimumBond: string;
  cooldownSeconds: number;
  pendingWithdrawals: PendingWithdrawal[];
};

export type BondOperationKind = "top-up" | "withdrawal";

export type BuiltBondOperation = {
  operationId: string;
  unsignedXdr: string;
};

export type BondAdapter = {
  /** False for the local mock, which has no real transaction to sign. */
  requiresSignature: boolean;
  getBond: (address: string) => Promise<BondState>;
  build: (address: string, kind: BondOperationKind, amount: string) => Promise<BuiltBondOperation>;
  submit: (address: string, operationId: string, signedXdr: string) => Promise<BondState>;
};
