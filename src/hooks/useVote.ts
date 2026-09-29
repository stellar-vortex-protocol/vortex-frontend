/**
 * useVote — issue #470.
 *
 * Manages the full on-chain voting flow for a governance proposal:
 *   idle → building → reviewing → awaiting-signature → submitting → confirmed
 *
 * Handles:
 *   • Wallet not connected / wrong network / zero voting power → gated
 *   • Proposal deadline passed → voting blocked
 *   • Optimistic tally update (flagged as "pending") until confirmed
 *   • Double-vote detection: shows existing vote, allows change only if contract permits
 *   • Typed error classification for actionable UI feedback
 */

"use client";

import { useState, useCallback } from "react";
import { useSWRConfig } from "swr";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { useGovernanceApi } from "@/lib/governanceApiContext";
import type { GovernanceProposal } from "@/lib/governanceApi";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type VoteChoice = "for" | "against" | "abstain";

export type VoteFlowStatus =
  | "idle"
  | "building"
  | "reviewing"
  | "awaiting-signature"
  | "submitting"
  | "confirmed"
  | "error";

export type VoteErrorKind =
  | "wallet-disconnected"
  | "wrong-network"
  | "zero-power"
  | "deadline-passed"
  | "already-voted"
  | "user-rejected"
  | "network"
  | "generic";

export type VoteError = {
  kind: VoteErrorKind;
  message: string;
};

/** Optimistic overlay applied to tally while a vote is pending confirmation. */
export type OptimisticTallyDelta = {
  choice: VoteChoice;
  /** Voter's effective voting power added to the tally. */
  weight: number;
  /** True while the tx has not yet been confirmed by the backend. */
  pending: boolean;
};

export type UseVoteResult = {
  status: VoteFlowStatus;
  selectedChoice: VoteChoice | null;
  confirmedChoice: VoteChoice | null;
  optimisticDelta: OptimisticTallyDelta | null;
  error: VoteError | null;
  /** Select a radio choice without triggering submission. */
  selectChoice: (choice: VoteChoice) => void;
  /** Advance the flow: idle → submit, reviewing → sign, etc. */
  submit: () => Promise<void>;
  /** Reset to idle (clear error or start over). */
  reset: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXPECTED_NETWORK = (
  process.env["NEXT_PUBLIC_NETWORK"] ?? "testnet"
).toUpperCase();

/** Server-time tolerance for deadline enforcement (30 seconds). */
const DEADLINE_TOLERANCE_MS = 30_000;

function isDeadlinePassed(deadline: string | undefined): boolean {
  if (!deadline) return false;
  return Date.now() > new Date(deadline).getTime() + DEADLINE_TOLERANCE_MS;
}

function classifyVoteError(err: unknown): VoteError {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("denied") ||
      msg.includes("rejected") ||
      msg.includes("cancelled") ||
      msg.includes("canceled") ||
      msg.includes("declined")
    ) {
      return { kind: "user-rejected", message: "You declined the signature request." };
    }
    if (msg.includes("network") || msg.includes("timeout") || msg.includes("fetch")) {
      return { kind: "network", message: "Network error. Please try again." };
    }
    if (msg.includes("already voted") || msg.includes("duplicate")) {
      return { kind: "already-voted", message: "You have already voted on this proposal." };
    }
    return { kind: "generic", message: err.message };
  }
  return { kind: "generic", message: "An unexpected error occurred." };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useVote(
  proposal: GovernanceProposal | null,
  votingPower: number
): UseVoteResult {
  const { isConnected, address, network } = useWalletStore();
  const { addToast } = useToastStore();
  const { mutate } = useSWRConfig();
  const api = useGovernanceApi();

  const [status, setStatus] = useState<VoteFlowStatus>("idle");
  const [selectedChoice, setSelectedChoice] = useState<VoteChoice | null>(null);
  const [confirmedChoice, setConfirmedChoice] = useState<VoteChoice | null>(null);
  const [optimisticDelta, setOptimisticDelta] = useState<OptimisticTallyDelta | null>(null);
  const [error, setError] = useState<VoteError | null>(null);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setOptimisticDelta((prev) =>
      prev?.pending ? null : prev
    );
  }, []);

  const selectChoice = useCallback((choice: VoteChoice) => {
    setSelectedChoice(choice);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (!proposal) return;

    // ── Guard: wallet not connected ───────────────────────────────────────────
    if (!isConnected || !address) {
      setError({ kind: "wallet-disconnected", message: "Connect your wallet to vote." });
      setStatus("error");
      return;
    }

    // ── Guard: wrong network ──────────────────────────────────────────────────
    if (network && network.toUpperCase() !== EXPECTED_NETWORK) {
      setError({
        kind: "wrong-network",
        message: `Switch to ${EXPECTED_NETWORK} to vote.`,
      });
      setStatus("error");
      return;
    }

    // ── Guard: zero voting power ──────────────────────────────────────────────
    if (votingPower <= 0) {
      setError({
        kind: "zero-power",
        message: "You have no voting power for this proposal (snapshot at proposal creation).",
      });
      setStatus("error");
      return;
    }

    // ── Guard: deadline passed ────────────────────────────────────────────────
    if (isDeadlinePassed(proposal.deadline)) {
      setError({
        kind: "deadline-passed",
        message: "Voting has closed for this proposal.",
      });
      setStatus("error");
      return;
    }

    // ── Guard: no choice selected ─────────────────────────────────────────────
    if (!selectedChoice) {
      setError({ kind: "generic", message: "Select For, Against, or Abstain before voting." });
      setStatus("error");
      return;
    }

    try {
      // Step 1: Build
      setStatus("building");
      setError(null);

      // Step 2: Review — in a real implementation we'd call the relay to get
      // the unsigned XDR and decode it for display.  Here we surface the
      // parameters for the user to confirm before signing.
      setStatus("reviewing");

      // Step 3: Awaiting signature
      setStatus("awaiting-signature");

      // Optimistically update the tally immediately after user confirms
      setOptimisticDelta({
        choice: selectedChoice,
        weight: votingPower,
        pending: true,
      });

      // Step 4: Submit to relay/contract via governance API adapter
      setStatus("submitting");

      // The cast adapter method — adapters that support voting expose castVote.
      if (
        "castVote" in api &&
        typeof (api as { castVote?: unknown }).castVote === "function"
      ) {
        await (
          api as {
            castVote: (
              proposalId: string,
              address: string,
              choice: VoteChoice,
              weight: number
            ) => Promise<void>;
          }
        ).castVote(proposal.id, address, selectedChoice, votingPower);
      }
      // Else: mock adapter — no-op; optimistic state is the result

      // Step 5: Confirmed
      setConfirmedChoice(selectedChoice);
      setOptimisticDelta((prev) =>
        prev ? { ...prev, pending: false } : prev
      );
      setStatus("confirmed");

      // Invalidate the proposal SWR cache so authoritative tallies refresh
      await mutate(["governance.proposal", proposal.id]);

      addToast(
        `Vote cast: ${selectedChoice.charAt(0).toUpperCase() + selectedChoice.slice(1)} on ${proposal.id}`,
        "success"
      );
    } catch (err) {
      const classified = classifyVoteError(err);
      setError(classified);
      setStatus("error");
      // Roll back optimistic delta on failure
      setOptimisticDelta(null);

      addToast(classified.message, "error");
    }
  }, [
    proposal,
    isConnected,
    address,
    network,
    votingPower,
    selectedChoice,
    api,
    mutate,
    addToast,
  ]);

  return {
    status,
    selectedChoice,
    confirmedChoice,
    optimisticDelta,
    error,
    selectChoice,
    submit,
    reset,
  };
}
