"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { useIntent } from "@/hooks/useIntent";
import { getMessage } from "@/lib/i18n";
import { timeAgo } from "@/lib/time";

const NETWORK = process.env.NEXT_PUBLIC_NETWORK ?? "testnet";

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function deadlineLabel(deadline: string) {
  const msRemaining = new Date(deadline).getTime() - Date.now();
  if (msRemaining <= 0) return getMessage("explore.detail.deadline.expired");
  const minutes = Math.floor(msRemaining / 60_000);
  const seconds = Math.floor((msRemaining % 60_000) / 1000);
  return minutes > 0
    ? getMessage("explore.detail.deadline.remaining.minutes", { minutes, seconds })
    : getMessage("explore.detail.deadline.remaining.seconds", { seconds });
}

export default function IntentDetailPage({ params }: { params: { id: string } }) {
  const { intent, isLoading, error } = useIntent(params.id);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={getMessage("explore.detail.nav.label", { id: params.id.slice(0, 8) })} />

      <main id="main-content" className="max-w-3xl mx-auto px-5 py-12">
        <Link href="/explore" className="text-xs text-vx-sage hover:underline mb-6 inline-block">
          {getMessage("explore.detail.back")}
        </Link>

        {isLoading ? (
          <div className="card p-8 space-y-3">
            <div className="h-6 w-2/3 bg-vx-surface rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-vx-surface rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="card p-8 text-center text-sm text-vx-muted">
            {getMessage("explore.detail.errors.load")}
          </div>
        ) : !intent ? (
          <div className="card p-8 text-center text-sm text-vx-muted">
            {getMessage("explore.detail.errors.empty")}
          </div>
        ) : (
          <div className="card p-6 space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="eyebrow mb-2">{getMessage("explore.detail.eyebrow")}</div>
                <h1 className="text-2xl font-bold text-vx-text num">
                  {intent.srcAmount} {intent.srcToken} → {intent.dstAmount} {intent.dstToken}
                </h1>
              </div>
              <IntentStatusBadge status={intent.status} />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {[
                [getMessage("explore.detail.labels.sourceChain"), intent.srcChain],
                [getMessage("explore.detail.labels.solver"), intent.solver],
                [getMessage("explore.detail.labels.minimumOut"), `${intent.minOut} ${intent.dstToken}`],
                [getMessage("explore.detail.labels.submitted"), timeAgo(intent.createdAt)],
                [getMessage("explore.detail.labels.deadline"), deadlineLabel(intent.deadline)],
                [getMessage("explore.detail.labels.destinationAddress"), truncateAddress(intent.dstAddress)],
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
                  {getMessage("explore.detail.txLink")}
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
