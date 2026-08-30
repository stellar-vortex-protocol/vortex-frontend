"use client";

import { useMemo } from "react";
import Link from "next/link";
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
  const isExpired = useMemo(() => {
    if (!intent || intent.status !== "pending" || !intent.deadline) return false;
    return new Date(intent.deadline).getTime() <= Date.now();
  }, [intent]);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={`Intent ${params.id.slice(0, 8)}`} />

      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/explore" className="text-xs text-vx-sage hover:underline mb-6 inline-block">
          ← Back to explorer
        </Link>

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
          <div className="card p-6 space-y-6">
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

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["Source chain", intent.srcChain],
                ["Solver", intent.solver],
                ["Minimum out", `${intent.minOut} ${intent.dstToken}`],
                ["Submitted", timeAgo(intent.createdAt)],
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
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-vx-muted num">{truncateAddress(intent.txHash)}</span>
                  <CopyButton value={intent.txHash} label="Copy transaction hash" />
                  <a
                    href={`https://stellar.expert/explorer/${NETWORK}/tx/${intent.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-vx-sage hover:underline"
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
