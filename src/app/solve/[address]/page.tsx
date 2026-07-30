"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { SkeletonCard } from "@/components/Skeleton";
import { useSolver } from "@/hooks/useSolver";
import { useIntentFeed } from "@/hooks/useIntentFeed";
import { timeAgo } from "@/lib/time";
import { DEFAULT_CHAIN_COLOR, getChainMeta } from "@/lib/marketData";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

function truncateAddress(address: string) {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

const usdCompact = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

export default function SolverDetailPage({ params }: { params: { address: string } }) {
  const isValidAddress = isValidStellarPublicKey(params.address);
  const { solver, isLoading, error } = useSolver(isValidAddress ? params.address : null);
  const { items: fillHistory, isLoading: historyLoading, error: historyError } = useIntentFeed();

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label={`Solver ${params.address.slice(0, 8)}`} />

      <main id="main-content" className="max-w-3xl mx-auto px-3 sm:px-5 py-8 sm:py-12">
        <Link
          href="/solve"
          className="text-xs text-vx-sage hover:underline mb-6 inline-block focus:outline-none focus:ring-2 focus:ring-vx-sage focus:ring-offset-2 focus:ring-offset-vx-ink rounded"
        >
          ← Back to solvers
        </Link>

        {!isValidAddress ? (
          <div role="alert" className="card p-6 sm:p-8 text-center text-sm text-vx-muted">
            Invalid solver address format.
          </div>
        ) : isLoading ? (
          <div className="card p-6 sm:p-8 space-y-3">
            <div className="h-6 w-2/3 bg-vx-surface rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-vx-surface rounded animate-pulse" />
          </div>
        ) : error ? (
          <div role="alert" className="card p-6 sm:p-8 text-center text-sm text-vx-muted">
            Couldn&apos;t load solver details right now. Try again shortly.
          </div>
        ) : !solver ? (
          <div role="alert" className="card p-6 sm:p-8 text-center text-sm text-vx-muted">
            No solver found at that address.
          </div>
        ) : (
          <>
            {/* Header card */}
            <div className="card p-4 sm:p-6 space-y-4 sm:space-y-6 mb-6">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div>
                  <div className="eyebrow mb-1 sm:mb-2 text-xs">Solver</div>
                  <h1 className="text-lg sm:text-2xl font-bold text-vx-text break-words">
                    {solver.name}
                  </h1>
                </div>
                <div 
                  className={`flex-shrink-0 px-2 sm:px-3 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                    solver.status === "active"
                      ? "bg-vx-sage-bg text-vx-sage border-vx-sage/30"
                      : "bg-vx-surface text-vx-muted border-vx-border"
                  }`}
                  aria-label={`Solver status: ${solver.status}`}
                >
                  {solver.status === "active" ? "Active" : "Inactive"}
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs sm:text-sm text-vx-muted font-mono break-all">
                <span>Address: {params.address}</span>
                <CopyButton value={params.address} label="Copy solver address" />
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {[
                  { label: "Fills", value: solver.fills },
                  { label: "Failed", value: solver.failed },
                  { label: "Success Rate", value: `${solver.successRatePct}%` },
                  { label: "Total Volume", value: usdCompact.format(solver.volumeUsd) },
                  { label: "Avg Fill Time", value: `${solver.avgFillTimeSeconds}s` },
                  { label: "Bond", value: usdCompact.format(solver.bondUsd) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-vx-surface/40 rounded-lg p-3">
                    <div className="eyebrow text-[10px] sm:text-xs mb-1">{label}</div>
                    <div className="num text-xs sm:text-sm font-semibold text-vx-text">{value}</div>
                  </div>
                ))}
              </div>

              {/* Chain coverage */}
              <div className="pt-3 sm:pt-4 border-t border-vx-border">
                <h2 className="eyebrow text-xs mb-2">Supported Chains</h2>
                <div className="flex flex-wrap gap-2">
                  {solver.chains.length > 0 ? (
                    solver.chains.map(chainId => {
                      const chainMeta = getChainMeta(chainId);
                      const chainName = chainMeta?.name ?? chainId;
                      const chainColor = chainMeta?.color ?? DEFAULT_CHAIN_COLOR;
                      return (
                        <span 
                          key={chainId} 
                          className="text-xs px-2 py-1 rounded text-white border font-medium"
                          style={{ 
                            backgroundColor: chainColor,
                            borderColor: chainColor,
                          }}
                        >
                          {chainName}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-vx-muted">No chains supported yet</span>
                  )}
                </div>
              </div>
            </div>

            {/* Fill history section */}
            <div className="card overflow-hidden">
              <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-b border-vx-border bg-vx-surface/30">
                <h2 className="text-sm font-semibold text-vx-text">Recent Fills by Solver</h2>
              </div>

              {historyLoading && fillHistory.length === 0 ? (
                <div className="p-4 sm:p-5">
                  <SkeletonCard rows={3} rowHeight="h-16" />
                </div>
              ) : historyError ? (
                <div role="alert" className="p-6 sm:p-8 text-center text-sm text-vx-muted">
                  Couldn&apos;t load fill history right now.
                </div>
              ) : fillHistory.filter(item => item.solver === solver.address).length === 0 ? (
                <div className="p-6 sm:p-8 text-center text-sm text-vx-muted">
                  No fills from this solver in the history.
                </div>
              ) : (
                <div className="divide-y divide-vx-line">
                  {fillHistory
                    .filter(item => item.solver === solver.address)
                    .slice(0, 10)
                    .map(fill => {
                      const chain = getChainMeta(fill.srcChain);
                      const chainColor = chain?.color ?? DEFAULT_CHAIN_COLOR;

                      return (
                        <div
                          key={fill.id}
                          className="px-4 sm:px-5 py-4 hover:bg-vx-surface/30 transition-colors"
                        >
                          <div className="flex flex-col gap-2">
                            <div className="flex items-start justify-between gap-2 min-w-0">
                              <div className="min-w-0 flex-1">
                                <div className="num text-xs text-vx-muted mb-1 truncate">
                                  ID: {fill.id}
                                </div>
                                <div className="text-xs sm:text-sm font-medium text-vx-text capitalize">
                                  {fill.srcAmount} {fill.srcToken} → {fill.dstToken}
                                </div>
                              </div>
                              <IntentStatusBadge status={fill.status} />
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-vx-muted">
                              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full" style={{ background: chainColor }} />
                              {chain?.name ?? fill.srcChain} · {timeAgo(fill.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
