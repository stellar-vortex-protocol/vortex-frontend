"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useWalletStore } from "@/store/wallet";
import {
  getGovernanceProposalById,
  getProposalComments,
  addProposalComment,
  type ProposalComment,
} from "@/lib/governanceStore";
import { validateCommentText } from "@/lib/textSafety";
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
  const proposal = getGovernanceProposalById(proposalId);
  const { isConnected, address: userAddress } = useWalletStore();

  const [comments, setComments] = useState<ProposalComment[]>(() =>
    proposal ? getProposalComments(proposal.id) : []
  );
  const [commentText, setCommentText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<Record<string, boolean>>({});
  const postTimestampsRef = useRef<number[]>([]);

  useEffect(() => {
    setHiddenIds(loadHiddenIds());
  }, []);

  useEffect(() => {
    if (!proposal) return;
    const all = getProposalComments(proposal.id);
    setComments(all.slice(-PAGE_SIZE));
    setHasMore(all.length > PAGE_SIZE);
  }, [proposal]);

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

  const handleLoadOlder = useCallback(() => {
    if (!proposal) return;
    const all = getProposalComments(proposal.id);
    const currentCount = comments.length;
    const nextCount = Math.min(all.length, currentCount + PAGE_SIZE);
    setComments(all.slice(-nextCount));
    setHasMore(nextCount < all.length);
  }, [proposal, comments.length]);

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
    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: ProposalComment = {
      id: optimisticId,
      proposalId: proposal.id,
      author: userAddress,
      text: commentText,
      createdAt: Date.now(),
    };
    setComments((prev) => [...prev, optimistic]);
    const draft = commentText;
    setCommentText("");

    try {
      const signed = await signCommentMessage({
        proposalId: proposal.id,
        text: draft,
        author: userAddress,
      });
      const created = addProposalComment(proposal.id, userAddress, draft, signed);
      setComments((prev) => prev.map((c) => (c.id === optimisticId ? created : c)));
      postTimestampsRef.current = [...postTimestampsRef.current, Date.now()];
      setStatusMsg(getMessage("solve.governance.commentPosted"));
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
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

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={`Proposal ${proposal.id}`} />

      <main id="main-content" className="max-w-5xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        <div className="mb-6">
          <Link href="/governance" className="text-xs text-vx-sage hover:underline font-semibold mb-3 inline-block">
            ← Back to Proposals
          </Link>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-xs text-vx-sage font-bold">{proposal.id}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-vx-surface text-vx-muted border border-vx-border">
              {proposal.category}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-vx-sage-bg text-vx-sage border border-vx-sage/30">
              {proposal.status}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-vx-text mb-3">{proposal.title}</h1>
          <p className="text-xs text-vx-muted">
            Proposed by <span className="font-mono text-vx-text">{truncateAddress(proposal.proposer)}</span> · Expires in {timeRemaining(proposal.deadline)}
          </p>
        </div>

        {/* Proposal Details Card */}
        <div className="card p-5 sm:p-6 mb-8 space-y-4">
          <h2 className="text-sm font-semibold text-vx-text">Proposal Description</h2>
          <p className="text-xs sm:text-sm text-vx-muted leading-relaxed whitespace-pre-line">
            {proposal.description}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 pt-4 border-t border-vx-line">
            <div className="bg-vx-surface/40 p-3 rounded-lg border border-vx-border">
              <div className="text-xs text-vx-muted">Votes For</div>
              <div className="text-lg font-bold text-vx-sage">{proposal.votesFor.toLocaleString()}</div>
            </div>
            <div className="bg-vx-surface/40 p-3 rounded-lg border border-vx-border">
              <div className="text-xs text-vx-muted">Votes Against</div>
              <div className="text-lg font-bold text-vx-amber">{proposal.votesAgainst.toLocaleString()}</div>
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
                    {isPosting
                      ? getMessage("solve.governance.signingComment")
                      : getMessage("solve.governance.postComment")}
                  </button>
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
        </section>
      </main>
    </div>
  );
}
