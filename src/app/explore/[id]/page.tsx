"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { SkeletonDetailCard } from "@/components/Skeleton";
import { useIntent } from "@/hooks/useIntent";
import { timeAgo } from "@/lib/time";

const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

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
          <SkeletonDetailCard />
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
              <div className="flex flex-col items-end gap-2">
                <IntentStatusBadge status={intent.status} />
                {isExpired && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5">
                    Likely expired
                  </span>
                )}
              </div>
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
                ["Solver", intent.solver],
                ["Minimum out", `${intent.minOut} ${intent.dstToken}`],
                ["Submitted", `${new Date(intent.createdAt).toLocaleString()} (${timeAgo(intent.createdAt)})`],
                ["Deadline", deadlineLabel(intent.deadline)],
              ].map(([k, v]) => (
                <div key={k} className="bg-vx-surface/40 rounded-lg p-3">
                  <div className="eyebrow mb-1">{k}</div>
                  <div className="text-sm text-vx-text num capitalize">{v}</div>
                </div>
              ))}
              <div className="bg-vx-surface/40 rounded-lg p-3">
                <div className="eyebrow mb-1">Destination address</div>
                <div className="flex items-center gap-2 text-sm text-vx-text num">
                  <span className="truncate">{truncateAddress(intent.dstAddress)}</span>
                  <CopyButton value={intent.dstAddress} label="Copy destination address" />
                </div>
              </div>
            </div>

            {intent.txHash && (
              <div className="pt-2 border-t border-vx-line">
                <div className="eyebrow mb-1">Settlement transaction</div>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-vx-muted num">{truncateAddress(intent.txHash)}</span>
                  <button
                    type="button"
                    onClick={() => copy(intent.txHash!, "Transaction hash copied")}
                    className="text-xs text-vx-sage hover:underline print:hidden"
                  >
                    Copy
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
