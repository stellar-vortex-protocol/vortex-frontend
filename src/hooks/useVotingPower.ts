/**
 * useVotingPower — issue #471.
 *
 * Returns the connected wallet's voting power for a given proposal,
 * including snapshot semantics (power is frozen at proposal creation),
 * delegated-in / delegated-out breakdown, and eligibility derived state.
 *
 * SWR cache key is (address, proposalId) — wallet change triggers
 * cache invalidation automatically.
 *
 * Snapshot semantics:
 *   Each proposal captures a governance token balance snapshot at the
 *   block/ledger when the proposal was created (`snapshotAt`).  Your
 *   current live balance does NOT affect vote weight — only the snapshot
 *   matters.  This prevents last-minute token manipulation to swing votes.
 */

"use client";

import useSWR from "swr";
import { useGovernanceApi } from "@/lib/governanceApiContext";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VotingPower = {
  /** Raw governance token balance captured at snapshot. */
  own: number;
  /** Tokens delegated IN from other wallets (adds to your vote weight). */
  delegatedIn: number;
  /** Tokens you have delegated OUT (reduces your effective vote weight). */
  delegatedOut: number;
  /** Effective total: own + delegatedIn − delegatedOut. */
  total: number;
  /** ISO-8601 timestamp of the governance snapshot. */
  snapshotAt: string;
};

export type UseVotingPowerResult = {
  power: VotingPower | null;
  isLoading: boolean;
  error: Error | null;
  /** True when total > 0 — drives vote form eligibility. */
  canVote: boolean;
};

// ─── Validation ───────────────────────────────────────────────────────────────

function isVotingPower(v: unknown): v is VotingPower {
  if (typeof v !== "object" || v === null) return false;
  const obj = v as Record<string, unknown>;
  return (
    typeof obj["own"] === "number" &&
    typeof obj["delegatedIn"] === "number" &&
    typeof obj["delegatedOut"] === "number" &&
    typeof obj["total"] === "number" &&
    typeof obj["snapshotAt"] === "string"
  );
}

// ─── Mock power fetcher ───────────────────────────────────────────────────────
// The governance API adapter exposes voting power via a method that is added
// to the interface below.  For development/test the MockGovernanceApi returns
// a deterministic result; the HttpGovernanceApi hits the relay endpoint.

async function fetchVotingPower(
  fetcher: (address: string, proposalId: string) => Promise<unknown>,
  address: string,
  proposalId: string
): Promise<VotingPower> {
  const raw = await fetcher(address, proposalId);
  if (!isVotingPower(raw)) {
    // Relay didn't return a valid shape — treat as zero power so the UI can
    // explain how to acquire/delegate rather than crashing.
    return {
      own: 0,
      delegatedIn: 0,
      delegatedOut: 0,
      total: 0,
      snapshotAt: new Date().toISOString(),
    };
  }
  return raw;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * @param address   Stellar wallet address (null/empty → hook is disabled)
 * @param proposalId  Governance proposal ID
 */
export function useVotingPower(
  address: string | null | undefined,
  proposalId: string
): UseVotingPowerResult {
  const api = useGovernanceApi();

  // The base GovernanceApi interface is augmented with getVotingPower when
  // the adapter supports it; otherwise we fall back to a zero-power response.
  const fetcher =
    "getVotingPower" in api &&
    typeof (api as { getVotingPower?: unknown }).getVotingPower === "function"
      ? (addr: string, pid: string) =>
          (
            api as {
              getVotingPower: (a: string, p: string) => Promise<unknown>;
            }
          ).getVotingPower(addr, pid)
      : async (_addr: string, _pid: string): Promise<VotingPower> => ({
          // Graceful fallback — adapter not yet wired
          own: 0,
          delegatedIn: 0,
          delegatedOut: 0,
          total: 0,
          snapshotAt: new Date().toISOString(),
        });

  const enabled = Boolean(address && proposalId);

  const { data, error, isLoading } = useSWR<VotingPower>(
    enabled ? ["governance.votingPower", address, proposalId] : null,
    () => fetchVotingPower(fetcher, address!, proposalId),
    {
      revalidateOnFocus: false,
      // Do not block page render — load in background
      suspense: false,
    }
  );

  const power = data ?? null;

  return {
    power,
    isLoading: enabled ? isLoading : false,
    error:
      error instanceof Error
        ? error
        : error != null
        ? new Error(String(error))
        : null,
    canVote: power !== null && power.total > 0,
  };
}

// ─── Formatting helpers (exported for components) ─────────────────────────────

/**
 * Format a raw governance token amount for display.
 * Uses compact notation for large values (≥ 1 000) with the full value
 * available as an accessible title / aria-label for hover/focus.
 */
export function formatVotingPower(amount: number): {
  display: string;
  full: string;
} {
  const full = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 7,
  }).format(amount);

  if (amount >= 1_000_000) {
    const display = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(amount);
    return { display, full };
  }

  if (amount >= 1_000) {
    const display = new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(amount);
    return { display, full };
  }

  return { display: full, full };
}
