"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/CopyButton";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { Nav } from "@/components/Nav";
import { SkeletonDetailCard } from "@/components/Skeleton";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useIntent } from "@/hooks/useIntent";
import { timeAgo } from "@/lib/time";
import { truncateAddress } from "@/lib/stellarAddress";

const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

// This screen shows 6-and-6 truncation for full-width identifiers.
const truncate = (value: string) => truncateAddress(value, { prefix: 6, suffix: 6 });

function deadlineLabel(deadline: string) {
  const msRemaining = new Date(deadline).getTime() - Date.now();
  if (msRemaining <= 0) return "Expired";
  const minutes = Math.floor(msRemaining / 60_000);
  const seconds = Math.floor((msRemaining % 60_000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s remaining` : `${seconds}s remaining`;
}

export default function IntentDetailPage({ params }: { params: { id: string } }) {
  const { intent, isLoading, error } = useIntent(params.id);
  const { copy } = useCopyToClipboard();
  const [txHashCopied, setTxHashCopied] = useState(false);

  const isExpired = useMemo(() => {
    if (!intent || intent.status !== "pending" || !intent.deadline) return false;
    return new Date(intent.deadline).getTime() <= Date.now();
  }, [intent]);
  const isSettled = intent?.status === "filled";

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={`Intent ${params.id.slice(0, 8)}`} />

      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/explore" className="text-xs text-vx-sage hover:underline print:hidden">
            ← Back to explorer
          </Link>
          {intent && (
            <button
              type="button"
              onClick={() => window.print()}
              className="print:hidden text-xs px-3 py-1.5 rounded-lg border border-vx-border text-vx-muted
                         hover:text-vx-text hover:border-vx-sage/40 transition-colors"
            >
              Print / Save as PDF
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="card p-8 space-y-3">
            <div className="h-6 w-2/3 bg-vx-surface rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-vx-surface rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-sm text-vx-muted">
            Couldn&apos;t find that intent. It may not exist, or the relay is unreachable.
          </div>
        ) : !intent ? (
          <div className="card p-8 text-center text-sm text-vx-muted">
            No details found for this intent.
          </div>
        ) : (
          <div id="intent-record" className="card p-6 space-y-6 print:border print:border-black/20 print:shadow-none">
            {/* Print-only header - the on-screen Nav/Footer are stripped when printing. */}
            <div className="hidden print:block border-b border-black/20 pb-3">
              <div className="text-sm font-semibold">Vortex - swap intent record</div>
              <div className="text-xs text-black/60">
                Intent {params.id} · generated {new Date().toLocaleString()}
              </div>
            </div>

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-2">Intent</div>
                <h1 className="text-2xl font-bold text-vx-text num">
                  {intent.srcAmount} {intent.srcToken} → {intent.dstAmount} {intent.dstToken}
                </h1>
              </div>
              <IntentStatusBadge status={intent.status} />
            </div>

            {!isSettled && (
              <p
                role="note"
                className="text-xs rounded-lg border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-amber-300
                           print:border-black/40 print:bg-transparent print:text-black"
              >
                This intent is <strong>{intent.status}</strong> and not yet settled - this is not a
                completed-swap record.
              </p>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["Source chain", intent.srcChain],
                ["Solver", sanitizeDisplayText(intent.solver)],
                ["Minimum out", `${intent.minOut} ${intent.dstToken}`],
                ["Submitted", `${new Date(intent.createdAt).toLocaleString()} (${timeAgo(intent.createdAt)})`],
                ["Deadline", deadlineLabel(intent.deadline)],
                ["Destination address", truncateAddress(intent.dstAddress)],
              ].map(([k, v]) => (
                <div key={k} className="bg-vx-surface/40 rounded-lg p-3">
                  <div className="eyebrow mb-1">{k}</div>
                  <div className="text-sm text-vx-text num capitalize">{v}</div>
                </div>
              ))}
            </div>

            {intent.txHash && (
              <div className="pt-2 border-t border-vx-line">
                <div className="eyebrow mb-1">Settlement transaction</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-vx-muted num">{truncate(intent.txHash)}</span>
                  <button
                    onClick={async () => {
                      const txHash = intent.txHash;
                      if (!txHash) return;
                      const didCopy = await copy(txHash);
                      setTxHashCopied(didCopy);
                      if (didCopy) {
                        window.setTimeout(() => setTxHashCopied(false), 1200);
                      }
                    }}
                    className="text-xs text-vx-sage hover:underline"
                  >
                    {txHashCopied ? "Copied" : "Copy"}
                  </button>
                  <a
                    href={`https://stellar.expert/explorer/${NETWORK}/tx/${intent.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-vx-sage hover:underline print:hidden"
                  >
                    View on stellar.expert →
                  </a>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
