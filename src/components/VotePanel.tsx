"use client";

/**
 * VotePanel — issue #470.
 *
 * Renders the voting interface for an active governance proposal:
 *   • For / Against / Abstain radio group
 *   • Voting power display
 *   • Multi-step confirmation (build → review → sign → submit)
 *   • Optimistic tally overlay (flagged as "pending")
 *   • Error states with actionable guidance
 *   • Gated when: wallet disconnected, wrong network, zero power, deadline passed
 */

import type { GovernanceProposal } from "@/lib/governanceApi";
import { useVote, type VoteChoice, type VoteFlowStatus } from "@/hooks/useVote";
import { formatVotingPower } from "@/hooks/useVotingPower";

type Props = {
  proposal: GovernanceProposal;
  votingPower: number;
};

const CHOICE_LABELS: Record<VoteChoice, string> = {
  for: "For",
  against: "Against",
  abstain: "Abstain",
};

const STATUS_LABELS: Partial<Record<VoteFlowStatus, string>> = {
  building: "Building transaction…",
  reviewing: "Review your vote",
  "awaiting-signature": "Awaiting signature…",
  submitting: "Submitting…",
};

function TallyBar({
  votesFor,
  votesAgainst,
  pendingFor,
  pendingAgainst,
}: {
  votesFor: number;
  votesAgainst: number;
  pendingFor: number;
  pendingAgainst: number;
}) {
  const totalFor = votesFor + pendingFor;
  const totalAgainst = votesAgainst + pendingAgainst;
  const total = totalFor + totalAgainst;
  const forPct = total > 0 ? (totalFor / total) * 100 : 50;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-vx-muted">
        <span>
          For:{" "}
          <strong className="text-vx-sage">
            {totalFor.toLocaleString()}
            {pendingFor > 0 && (
              <span className="ml-1 text-[10px] text-vx-muted italic">(pending)</span>
            )}
          </strong>
        </span>
        <span>
          Against:{" "}
          <strong className="text-vx-amber">
            {totalAgainst.toLocaleString()}
            {pendingAgainst > 0 && (
              <span className="ml-1 text-[10px] text-vx-muted italic">(pending)</span>
            )}
          </strong>
        </span>
      </div>
      <div
        className="h-2.5 w-full rounded-full overflow-hidden bg-vx-surface"
        role="meter"
        aria-valuenow={Math.round(forPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(forPct)}% voted For`}
      >
        <div
          className="h-full bg-vx-sage transition-all duration-500"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </div>
  );
}

export function VotePanel({ proposal, votingPower }: Props) {
  const {
    status,
    selectedChoice,
    confirmedChoice,
    optimisticDelta,
    error,
    selectChoice,
    submit,
    reset,
  } = useVote(proposal, votingPower);

  const isPending = [
    "building",
    "reviewing",
    "awaiting-signature",
    "submitting",
  ].includes(status);

  // Compute tally with optimistic overlay
  const pendingFor =
    optimisticDelta?.choice === "for" ? optimisticDelta.weight : 0;
  const pendingAgainst =
    optimisticDelta?.choice === "against" ? optimisticDelta.weight : 0;

  const powerFmt = formatVotingPower(votingPower);

  // Confirmed state
  if (status === "confirmed" && confirmedChoice) {
    return (
      <div className="card p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span
            aria-label="Vote confirmed"
            className="text-vx-sage text-lg"
            role="img"
          >
            ✓
          </span>
          <h3 className="text-sm font-semibold text-vx-text">Vote Confirmed</h3>
        </div>
        <p className="text-xs text-vx-muted">
          You voted{" "}
          <strong className="text-vx-sage">{CHOICE_LABELS[confirmedChoice]}</strong>{" "}
          on proposal {proposal.id}.
        </p>
        <TallyBar
          votesFor={proposal.votesFor}
          votesAgainst={proposal.votesAgainst}
          pendingFor={pendingFor}
          pendingAgainst={pendingAgainst}
        />
        <p className="text-[10px] text-vx-dim">
          Tally will update once the transaction is indexed by the relay.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-vx-text">Cast Your Vote</h3>
        <span
          className="text-xs text-vx-muted"
          title={powerFmt.full}
          aria-label={`Voting power: ${powerFmt.full}`}
        >
          Weight:{" "}
          <strong className={votingPower > 0 ? "text-vx-sage" : "text-vx-muted"}>
            {powerFmt.display}
          </strong>
        </span>
      </div>

      {/* Progress label when flow is in progress */}
      {isPending && STATUS_LABELS[status] && (
        <div
          role="status"
          aria-live="polite"
          className="text-xs text-vx-muted animate-pulse"
        >
          {STATUS_LABELS[status]}
        </div>
      )}

      {/* Radio group */}
      <fieldset disabled={isPending || status === "confirmed"}>
        <legend className="sr-only">Vote choice</legend>
        <div className="flex gap-3 flex-wrap">
          {(["for", "against", "abstain"] as VoteChoice[]).map((choice) => (
            <label
              key={choice}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border cursor-pointer text-xs font-semibold transition-colors ${
                selectedChoice === choice
                  ? choice === "for"
                    ? "bg-vx-sage-bg text-vx-sage border-vx-sage/40"
                    : choice === "against"
                    ? "bg-red-500/10 text-red-400 border-red-500/40"
                    : "bg-vx-surface text-vx-muted border-vx-border"
                  : "bg-vx-surface/50 text-vx-muted border-vx-border hover:border-vx-sage/30"
              }`}
            >
              <input
                type="radio"
                name={`vote-${proposal.id}`}
                value={choice}
                checked={selectedChoice === choice}
                onChange={() => selectChoice(choice)}
                className="sr-only"
                aria-label={CHOICE_LABELS[choice]}
              />
              {choice === "for" && <span aria-hidden="true">▲</span>}
              {choice === "against" && <span aria-hidden="true">▼</span>}
              {CHOICE_LABELS[choice]}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Error message */}
      {error && (
        <div role="alert" className="text-xs text-red-400 font-medium">
          {error.message}
          <button
            type="button"
            onClick={reset}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tally preview */}
      <TallyBar
        votesFor={proposal.votesFor}
        votesAgainst={proposal.votesAgainst}
        pendingFor={pendingFor}
        pendingAgainst={pendingAgainst}
      />

      {/* Finality notice */}
      <p className="text-[10px] text-vx-dim">
        Votes are final and cannot be changed once submitted. Confirm your
        choice carefully before signing.
      </p>

      {/* Submit */}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className="w-full py-2.5 px-4 bg-vx-sage-bg text-vx-sage border border-vx-sage/30 rounded-lg text-sm font-semibold hover:bg-vx-sage/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-busy={isPending}
      >
        {isPending ? STATUS_LABELS[status] ?? "Processing…" : "Submit Vote"}
      </button>
    </div>
  );
}
