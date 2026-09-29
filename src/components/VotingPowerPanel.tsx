"use client";

/**
 * VotingPowerPanel — issue #471.
 *
 * Displays the connected wallet's voting power for a proposal,
 * including delegated-in/out breakdown, snapshot semantics explanation,
 * and 0-power guidance.
 */

import { useVotingPower, formatVotingPower } from "@/hooks/useVotingPower";
import { Tooltip } from "@/components/Tooltip";

type Props = {
  address: string | null | undefined;
  proposalId: string;
};

export function VotingPowerPanel({ address, proposalId }: Props) {
  const { power, isLoading, error, canVote } = useVotingPower(address, proposalId);

  if (!address) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        aria-busy="true"
        aria-label="Loading voting power…"
        className="card p-4 space-y-2 animate-pulse"
      >
        <div className="h-3 w-32 rounded bg-vx-surface/60" />
        <div className="h-6 w-24 rounded bg-vx-surface/50" />
        <div className="h-3 w-48 rounded bg-vx-surface/40" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="card p-4 text-xs text-vx-muted">
        Could not load voting power: {error.message}
      </div>
    );
  }

  if (!power) return null;

  const totalFmt = formatVotingPower(power.total);
  const ownFmt = formatVotingPower(power.own);
  const delegatedInFmt = formatVotingPower(power.delegatedIn);
  const delegatedOutFmt = formatVotingPower(power.delegatedOut);

  const snapshotDate = new Date(power.snapshotAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-vx-text">Your Voting Power</h3>
        <Tooltip
          content={
            `Voting power is determined by a governance token snapshot taken at proposal creation (${snapshotDate}). ` +
            "Your current live balance does not affect vote weight. " +
            "This prevents last-minute token purchases from influencing outcomes."
          }
        >
          <span
            className="text-[11px] text-vx-muted border border-vx-border rounded px-1.5 py-0.5 cursor-help"
            aria-label="Snapshot semantics explanation"
          >
            Snapshot: {snapshotDate}
          </span>
        </Tooltip>
      </div>

      {/* Total power */}
      <div>
        <div className="text-xs text-vx-muted mb-0.5">Total weight</div>
        <div
          className={`text-2xl font-bold num ${canVote ? "text-vx-sage" : "text-vx-muted"}`}
          title={totalFmt.full}
          aria-label={`Total voting power: ${totalFmt.full}`}
        >
          {totalFmt.display}
        </div>
      </div>

      {/* Breakdown */}
      {(power.delegatedIn > 0 || power.delegatedOut > 0) && (
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-vx-line text-xs">
          <div>
            <div className="text-vx-muted mb-0.5">Own balance</div>
            <div
              className="font-semibold text-vx-text num"
              title={ownFmt.full}
              aria-label={`Own balance: ${ownFmt.full}`}
            >
              {ownFmt.display}
            </div>
          </div>
          <div>
            <div className="text-vx-muted mb-0.5">Delegated in</div>
            <div
              className="font-semibold text-vx-sage num"
              title={delegatedInFmt.full}
              aria-label={`Delegated in: ${delegatedInFmt.full}`}
            >
              +{delegatedInFmt.display}
            </div>
          </div>
          <div>
            <div className="text-vx-muted mb-0.5">Delegated out</div>
            <div
              className="font-semibold text-vx-amber num"
              title={delegatedOutFmt.full}
              aria-label={`Delegated out: ${delegatedOutFmt.full}`}
            >
              −{delegatedOutFmt.display}
            </div>
          </div>
        </div>
      )}

      {/* 0-power guidance */}
      {!canVote && (
        <div className="bg-vx-surface/40 rounded-lg border border-vx-border p-3 text-xs text-vx-muted space-y-1">
          <p className="font-semibold text-vx-text">No voting power for this proposal</p>
          <p>
            Your governance token balance was zero at the snapshot taken on{" "}
            <strong>{snapshotDate}</strong>. To participate in future proposals,
            acquire governance tokens and ensure you hold them before a proposal
            is created, or ask a token-holder to delegate their vote to you.
          </p>
        </div>
      )}
    </div>
  );
}
