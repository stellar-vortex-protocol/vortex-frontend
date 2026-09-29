"use client";

/**
 * ProposalDetailClient — issues #469, #470, #471.
 *
 * Migrated from direct governanceStore imports to SWR-backed hooks.
 * Added:
 *   • VotePanel for on-chain voting (For/Against/Abstain) — #470
 *   • VotingPowerPanel showing snapshot weight & delegation breakdown — #471
 *   • Loading skeleton and inline error states — #469
 */

import { useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { VotePanel } from "@/components/VotePanel";
import { VotingPowerPanel } from "@/components/VotingPowerPanel";
import { useWalletStore } from "@/store/wallet";
import { useProposal, useProposalComments } from "@/hooks/useGovernance";
import { useVotingPower } from "@/hooks/useVotingPower";
import { timeRemaining } from "@/lib/time";
import { getMessage } from "@/i18n/messages";

const MAX_COMMENT_LENGTH = 500;

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

export default function ProposalDetailClient({ proposalId }: { proposalId: string }) {
  const { isConnected, address: userAddress } = useWalletStore();

  const { proposal, isLoading, error } = useProposal(proposalId);
  const {
    comments,
    isLoading: commentsLoading,
    postComment,
    postError,
    isPosting,
  } = useProposalComments(proposalId);

  const { power } = useVotingPower(userAddress, proposalId);
  const votingPower = power?.total ?? 0;

  const [commentText, setCommentText] = useState("");

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label="Governance Proposal" />
        <main
          id="main-content"
          className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12 space-y-6"
          aria-busy="true"
        >
          <div className="space-y-3 animate-pulse">
            <div className="h-4 w-16 rounded bg-vx-surface/60" />
            <div className="h-8 w-3/4 rounded bg-vx-surface/60" />
            <div className="h-4 w-48 rounded bg-vx-surface/40" />
          </div>
          <div className="card p-6 space-y-3 animate-pulse">
            <div className="h-4 w-full rounded bg-vx-surface/60" />
            <div className="h-4 w-5/6 rounded bg-vx-surface/50" />
            <div className="h-4 w-4/6 rounded bg-vx-surface/40" />
          </div>
        </main>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label="Governance Proposal" />
        <main className="max-w-5xl mx-auto px-5 py-12 text-center">
          <div className="card p-8 space-y-4">
            <h1 className="text-xl font-bold text-vx-text">Failed to load proposal</h1>
            <p className="text-sm text-vx-muted">{error.message}</p>
            <Link href="/governance" className="text-vx-sage hover:underline text-sm font-semibold">
              ← Return to Governance Proposals
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!proposal) {
    return (
      <div className="min-h-screen">
        <Nav variant="breadcrumb" label="Governance Proposal" />
        <main className="max-w-5xl mx-auto px-5 py-12 text-center">
          <h1 className="text-xl font-bold text-vx-text mb-4">Proposal Not Found</h1>
          <p className="text-vx-muted mb-6">The requested governance proposal does not exist.</p>
          <Link href="/governance" className="text-vx-sage hover:underline text-sm font-semibold">
            ← Return to Governance Proposals
          </Link>
        </main>
      </div>
    );
  }

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) return;
    await postComment(userAddress, commentText);
    setCommentText("");
  };

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={`Proposal ${proposal.id}`} />

      <main id="main-content" className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link href="/governance" className="text-xs text-vx-sage hover:underline font-semibold mb-3 inline-block">
            ← Back to Proposals
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-vx-sage font-bold">{proposal.id}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-vx-surface text-vx-muted border border-vx-border">
              {proposal.category}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium w-fit ${
                proposal.status === "active"
                  ? "bg-vx-sage-bg text-vx-sage border border-vx-sage/30"
                  : proposal.status === "passed"
                  ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                  : "bg-red-500/10 text-red-400 border border-red-500/30"
              }`}
            >
              {proposal.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-3">{proposal.title}</h1>
          <p className="text-xs text-vx-muted">
            Proposed by{" "}
            <span className="font-mono text-vx-text">{truncateAddress(proposal.proposer)}</span>{" "}
            · Expires in {timeRemaining(proposal.deadline)}
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          {/* ── Main column ──────────────────────────────────────────────── */}
          <div className="space-y-6">
            {/* Proposal Details */}
            <div className="card p-5 sm:p-6 space-y-4">
              <h2 className="text-sm font-semibold text-vx-text">Proposal Description</h2>
              <p className="text-xs sm:text-sm text-vx-muted leading-relaxed whitespace-pre-line">
                {proposal.description}
              </p>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-vx-line">
                <div className="bg-vx-surface/40 p-3 rounded-lg border border-vx-border">
                  <div className="text-xs text-vx-muted">Votes For</div>
                  <div className="text-lg font-bold text-vx-sage num">
                    {proposal.votesFor.toLocaleString()}
                  </div>
                </div>
                <div className="bg-vx-surface/40 p-3 rounded-lg border border-vx-border">
                  <div className="text-xs text-vx-muted">Votes Against</div>
                  <div className="text-lg font-bold text-vx-amber num">
                    {proposal.votesAgainst.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Community Discussion */}
            <section aria-labelledby="discussion-heading" className="card p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-vx-line">
                <div className="flex items-center gap-2">
                  <h2 id="discussion-heading" className="text-base font-semibold text-vx-text">
                    Community Discussion
                  </h2>
                  <span className="chip bg-vx-surface text-vx-muted text-xs">
                    {comments.length} {comments.length === 1 ? "comment" : "comments"}
                  </span>
                </div>
                <span className="text-[10px] text-vx-dim">Wallet-gated deliberation</span>
              </div>

              {/* Comment form */}
              <div className="mb-8">
                {!isConnected ? (
                  <div className="p-5 rounded-xl bg-vx-surface/40 border border-vx-border text-center space-y-3">
                    <p className="text-xs sm:text-sm text-vx-muted">
                      {getMessage("solve.governance.connectToComment")}
                    </p>
                    <div className="flex justify-center">
                      <ConnectWalletButton compact={false} />
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePostComment} className="space-y-3">
                    <div>
                      <label htmlFor="comment-input" className="sr-only">
                        Post a comment
                      </label>
                      <textarea
                        id="comment-input"
                        rows={3}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        maxLength={MAX_COMMENT_LENGTH}
                        placeholder={getMessage("solve.governance.commentPlaceholder")}
                        className="w-full bg-vx-surface border border-vx-border rounded-lg p-3 text-xs sm:text-sm text-vx-text placeholder-vx-dim focus:outline-none focus:border-vx-sage/50 transition-colors"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-vx-dim">
                        {getMessage("solve.governance.characterCount", {
                          current: commentText.length,
                          max: MAX_COMMENT_LENGTH,
                        })}
                      </span>
                      <button
                        type="submit"
                        disabled={isPosting}
                        className="px-4 py-2 bg-vx-sage-bg text-vx-sage hover:bg-vx-sage/20 border border-vx-sage/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                      >
                        {isPosting ? "Posting…" : getMessage("solve.governance.postComment")}
                      </button>
                    </div>
                    {postError && (
                      <p role="alert" className="text-xs text-red-400 font-medium">
                        {postError}
                      </p>
                    )}
                  </form>
                )}
              </div>

              {/* Comment list */}
              <div className="space-y-4">
                {commentsLoading && comments.length === 0 ? (
                  <div className="text-xs text-vx-muted italic text-center py-4">
                    Loading comments…
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-xs text-vx-muted italic text-center py-6">
                    No comments posted yet. Be the first to share your thoughts!
                  </p>
                ) : (
                  <div className="divide-y divide-vx-line">
                    {comments.map((comment) => (
                      <div key={comment.id} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold text-vx-sage">
                            {truncateAddress(comment.author)}
                          </span>
                          <span className="text-vx-dim text-[11px]">
                            {new Date(comment.createdAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs sm:text-sm text-vx-text leading-relaxed whitespace-pre-line">
                          {comment.text}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* ── Sidebar: voting ──────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Voting power panel — always show when connected */}
            {isConnected && (
              <VotingPowerPanel address={userAddress} proposalId={proposalId} />
            )}

            {/* Vote panel — only for active proposals */}
            {proposal.status === "active" ? (
              isConnected ? (
                <VotePanel proposal={proposal} votingPower={votingPower} />
              ) : (
                <div className="card p-5 sm:p-6 text-center space-y-3">
                  <p className="text-sm text-vx-muted">Connect your wallet to vote.</p>
                  <div className="flex justify-center">
                    <ConnectWalletButton compact={false} />
                  </div>
                </div>
              )
            ) : (
              <div className="card p-4 text-xs text-vx-muted">
                Voting is closed for this proposal ({proposal.status}).
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
