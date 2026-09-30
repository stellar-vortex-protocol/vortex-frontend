import { apiFetch } from "@/lib/api";
import { applyBondOperation } from "./state";
import { bondFeatureMode, type BondFeatureMode } from "./flag";
import type { BondAdapter, BondOperationKind, BondState, BuiltBondOperation } from "./types";

const enc = encodeURIComponent;

export const httpBondAdapter: BondAdapter = {
  requiresSignature: true,
  getBond: (address) => apiFetch<BondState>(`/solvers/${enc(address)}/bond`),
  build: (address, kind, amount) =>
    apiFetch<BuiltBondOperation>(`/solvers/${enc(address)}/bond/${kind === "top-up" ? "top-ups" : "withdrawals"}`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),
  submit: (address, operationId, signedXdr) =>
    apiFetch<BondState>(`/solvers/${enc(address)}/bond/operations/${enc(operationId)}/submit`, {
      method: "POST",
      body: JSON.stringify({ signedXdr }),
    }),
};

// ── In-memory mock (NEXT_PUBLIC_FEATURE_BOND_MGMT=mock) ─────────────────────

const MOCK_COOLDOWN_SECONDS = 15 * 60;
const mockStates = new Map<string, BondState>();
const mockOps = new Map<string, { kind: BondOperationKind; amount: string }>();

function mockState(address: string): BondState {
  let state = mockStates.get(address);
  if (!state) {
    state = {
      address,
      bond: "250",
      locked: "40",
      available: "210",
      minimumBond: "50",
      cooldownSeconds: MOCK_COOLDOWN_SECONDS,
      pendingWithdrawals: [],
    };
    mockStates.set(address, state);
  }
  return state;
}

export const mockBondAdapter: BondAdapter = {
  requiresSignature: false,
  getBond: async (address) => mockState(address),
  build: async (_address, kind, amount) => {
    const operationId = `op-${mockOps.size + 1}`;
    mockOps.set(operationId, { kind, amount });
    return { operationId, unsignedXdr: "" };
  },
  submit: async (address, operationId) => {
    const op = mockOps.get(operationId);
    if (!op) throw new Error("Unknown bond operation.");
    mockOps.delete(operationId);
    const next = applyBondOperation(mockState(address), op.kind, op.amount);
    mockStates.set(address, next);
    return next;
  },
};

export function getBondAdapter(mode: BondFeatureMode = bondFeatureMode()): BondAdapter {
  return mode === "mock" ? mockBondAdapter : httpBondAdapter;
}
