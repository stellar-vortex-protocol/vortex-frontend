"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
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

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={`Intent ${params.id.slice(0, 8)}`} />

      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/explore" className="text-xs text-vx-sage hover:underline mb-6 inline-block">
          ← Back to explorer
        </Link>

        {isLoading ? (
          <div className="card p-8 space-y-3">
            <div className="h-6 w-2/3 bg-vx-surface rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-vx-surface rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-sm text-vx-muted">
            Couldn&apos;t find that intent. It may not exist, or the relay is unreachable.
          </div>
        ) : !intent ? null : (
          <div className="card p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-2">Intent</div>
                <h1 className="text-2xl font-bold text-vx-text num">
                  {intent.srcAmount} {intent.srcToken} → {intent.dstAmount} {intent.dstToken}
                </h1>
              </div>
              <IntentStatusBadge status={intent.status} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                ["Source chain", intent.srcChain],
                ["Solver", intent.solver],
                ["Minimum out", `${intent.minOut} ${intent.dstToken}`],
                ["Submitted", timeAgo(intent.createdAt)],
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
                <a
                  href={`https://stellar.expert/explorer/${NETWORK}/tx/${intent.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-vx-sage hover:underline num"
                >
                  View settlement tx on stellar.expert →
                </a>
              </div>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
