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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { signCommentMessage, verifySignedComment } from "@/lib/wallet/signMessage";

const MAX_COMMENT_LENGTH = 2000;
const MIN_COMMENT_LENGTH = 1;
const PAGE_SIZE = 20;
const RATE_LIMIT_WINDOW_MS = 10_000;
const RATE_LIMIT_HOURLY = 10;
const HIDDEN_COMMENTS_KEY = "vx.governance.hiddenComments";

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function loadHiddenIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HIDDEN_COMMENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function persistHiddenIds(ids: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HIDDEN_COMMENTS_KEY, JSON.stringify(ids));
  } catch {
    /* storage unavailable — hide-local is best-effort */
  }
}

/**
 * Safe Markdown subset renderer: only inline code, bold, italics and
 * http(s) links are honoured. Everything else is rendered as plain text so
 * phishing markup and raw HTML cannot leak into the thread.
 */
function renderSafeMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const pattern = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(\[[^\]]+\]\((https?:\/\/[^\s)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      nodes.push(
        <code key={key++} className="px-1 py-0.5 rounded bg-vx-surface text-vx-text font-mono text-[11px]">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    } else {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
      if (linkMatch) {
        nodes.push(
          <a
            key={key++}
            href={linkMatch[2]}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-vx-sage hover:underline break-all"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
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

  const [commentText, setCommentText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<Record<string, boolean>>({});
  const postTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    setHiddenIds(loadHiddenIds());
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const results: Record<string, boolean> = {};
      for (const comment of comments) {
        if (comment.signature && comment.message) {
          results[comment.id] = await verifySignedComment(comment);
        }
      }
      if (!cancelled) setVerifiedIds(results);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [comments]);

  const visibleComments = useMemo(
    () => comments.filter((c) => !hiddenIds.includes(c.id)),
    [comments, hiddenIds]
  );

  const handleHide = useCallback((id: string) => {
    setHiddenIds((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      persistHiddenIds(next);
      return next;
    });
  }, []);

  const handleReport = useCallback((id: string) => {
    setStatusMsg(getMessage("solve.governance.commentReported"));
    handleHide(id);
  }, [handleHide]);

  const handleCopyAuthor = useCallback(async (addr: string) => {
    try {
      await navigator.clipboard.writeText(addr);
      setStatusMsg(getMessage("solve.governance.authorCopied"));
    } catch {
      setStatusMsg(null);
    }
  }, []);

  const checkRateLimit = useCallback((): string | null => {
    const now = Date.now();
    const recent = postTimestampsRef.current.filter((t) => now - t < 60 * 60 * 1000);
    postTimestampsRef.current = recent;
    const last = recent[recent.length - 1];
    if (last !== undefined && now - last < RATE_LIMIT_WINDOW_MS) {
      const wait = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000);
      return getMessage("solve.governance.rateLimitCooldown", { seconds: wait });
    }
    if (recent.length >= RATE_LIMIT_HOURLY) {
      return getMessage("solve.governance.rateLimitHourly");
    }
    return null;
  }, []);

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);

    if (!proposal) return;

    if (!isConnected || !userAddress) {
      setErrorMsg(getMessage("solve.governance.connectToComment"));
      return;
    }

    const validation = validateCommentText(commentText, MAX_COMMENT_LENGTH);
    if (!validation.valid || commentText.trim().length < MIN_COMMENT_LENGTH) {
      setErrorMsg(validation.error || getMessage("solve.governance.emptyCommentError"));
      return;
    }

    const rateError = checkRateLimit();
    if (rateError) {
      setErrorMsg(rateError);
      return;
    }

    setIsPosting(true);
    const draft = commentText;
    setCommentText("");

    try {
      await postComment(draft);
      postTimestampsRef.current = [...postTimestampsRef.current, Date.now()];
      setStatusMsg(getMessage("solve.governance.commentPosted"));
    } catch (err) {
      setCommentText(draft);
      const message = err instanceof Error ? err.message : "";
      if (message.includes("429")) {
        setErrorMsg(getMessage("solve.governance.rateLimitServer"));
      } else {
        setErrorMsg(getMessage("solve.governance.signatureFailed"));
      }
    } finally {
      setIsPosting(false);
    }
  };

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

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 pt-4 border-t border-vx-line">
            <div className="bg-vx-surface/40 p-3 rounded-lg border border-vx-border">
              <div className="text-xs text-vx-muted">Votes For</div>
              <div className="text-lg font-bold text-vx-sage num">{proposal.votesFor.toLocaleString()}</div>
            </div>
            <div className="bg-vx-surface/40 p-3 rounded-lg border border-vx-border">
              <div className="text-xs text-vx-muted">Votes Against</div>
              <div className="text-lg font-bold text-vx-amber num">{proposal.votesAgainst.toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* ── Community Discussion / Comment Thread Section ── */}
        <section aria-labelledby="discussion-heading" className="card p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3 mb-6 pb-3 border-b border-vx-line">
            <div className="flex items-center gap-2">
              <h2 id="discussion-heading" className="text-base font-semibold text-vx-text">
                Community Discussion
              </h2>
              <span className="chip bg-vx-surface text-vx-muted text-xs">
                {visibleComments.length} {visibleComments.length === 1 ? "comment" : "comments"}
              </span>
            </div>
            <span className="text-[10px] text-vx-dim">Wallet-gated deliberation</span>
          </div>

          {/* Comment Form or Connect Prompt */}
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
                  <button
                    type="submit"
                    disabled={isPosting}
                    className="px-4 py-2 bg-vx-sage-bg text-vx-sage hover:bg-vx-sage/20 border border-vx-sage/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isPosting
                      ? getMessage("solve.governance.signingComment")
                      : getMessage("solve.governance.postComment")}
                  </button>
                </div>
                <span className="text-[10px] text-vx-dim">Wallet-gated deliberation</span>
              </div>

                {errorMsg && (
                  <p role="alert" className="text-xs text-red-400 font-medium">
                    {errorMsg}
                  </p>
                )}
                {statusMsg && (
                  <p role="status" className="text-xs text-vx-sage font-medium">
                    {statusMsg}
                  </p>
                )}
              </form>
            )}
          </div>

          {/* Comment List */}
          <div className="space-y-4">
            {hasMore && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={handleLoadOlder}
                  className="px-3 py-1.5 text-xs font-semibold text-vx-sage border border-vx-sage/30 rounded-lg hover:bg-vx-sage/10 transition-colors"
                >
                  {getMessage("solve.governance.loadOlderComments")}
                </button>
              </div>
            )}
            {visibleComments.length === 0 ? (
              <p className="text-xs text-vx-muted italic text-center py-6">
                No comments posted yet. Be the first to share your thoughts!
              </p>
            ) : (
              visibleComments.map((comment) => (
                <article
                  key={comment.id}
                  className="p-4 rounded-xl bg-vx-surface/40 border border-vx-border space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-vx-text">
                        {truncateAddress(comment.author)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void handleCopyAuthor(comment.author)}
                        aria-label={getMessage("solve.governance.copyAuthor")}
                        className="text-[10px] text-vx-dim hover:text-vx-sage transition-colors"
                      >
                        {getMessage("solve.governance.copyAuthor")}
                      </button>
                      {verifiedIds[comment.id] && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-vx-sage-bg text-vx-sage border border-vx-sage/30">
                          {getMessage("solve.governance.verifiedAuthor")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <time className="text-[10px] text-vx-dim" dateTime={new Date(comment.createdAt).toISOString()}>
                        {new Date(comment.createdAt).toLocaleString()}
                      </time>
                      <button
                        type="button"
                        onClick={() => handleReport(comment.id)}
                        className="text-[10px] text-vx-dim hover:text-vx-amber transition-colors"
                      >
                        {getMessage("solve.governance.reportComment")}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHide(comment.id)}
                        className="text-[10px] text-vx-dim hover:text-vx-text transition-colors"
                      >
                        {getMessage("solve.governance.hideComment")}
                      </button>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-vx-muted leading-relaxed whitespace-pre-line break-words">
                    {renderSafeMarkdown(comment.text)}
                  </p>
                </article>
              ))
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
