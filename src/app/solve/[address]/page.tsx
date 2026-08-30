"use client";

import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { CopyButton } from "@/components/CopyButton";
import { SolverHeaderCard } from "@/components/SolverHeaderCard";
import { SolverFillHistory } from "@/components/SolverFillHistory";
import { useSolver } from "@/hooks/useSolver";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";
import { CHAINS } from "@/lib/marketData";
import { formatCurrency, toBCP47 } from "@/lib/format";
import { useLocale } from "@/lib/i18n/I18nProvider";

export default function SolverDetailPage({ params }: { params: { address: string } }) {
  const locale = useLocale();
  const usdCompact = (value: number) =>
    formatCurrency(value, toBCP47(locale), {
      notation: "compact",
      maximumFractionDigits: 1,
    });
  const isValidAddress = isValidStellarPublicKey(params.address);
  const { solver, isLoading, error } = useSolver(isValidAddress ? params.address : null);

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
            <SolverHeaderCard solver={solver} />

            {/* Extended metrics + chain coverage */}
            <div className="card p-4 sm:p-6 space-y-4 sm:space-y-6 mt-6 mb-6">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-vx-muted font-mono break-all">
                <span>Address: {params.address}</span>
                <CopyButton value={params.address} label="Copy solver address" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                {[
                  { label: "Fills", value: solver.fills },
                  { label: "Failed", value: solver.failed },
                  { label: "Success Rate", value: `${solver.successRatePct}%` },
                  { label: "Total Volume", value: usdCompact(solver.volumeUsd) },
                  { label: "Avg Fill Time", value: `${solver.avgFillTimeSeconds}s` },
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
                      const chainMeta = CHAINS.find(c => c.id === chainId);
                      const chainName = chainMeta?.name ?? chainId;
                      const chainColor = chainMeta?.color ?? "#6B7280";
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

              <SolverFillHistory solverAddress={solver.address} />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
