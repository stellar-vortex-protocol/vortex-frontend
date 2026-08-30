"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { ConnectWalletButton } from "@/components/ConnectWalletButton";
import { useWalletStore } from "@/store/wallet";
import { useMyLiveIntents } from "@/hooks/useMyLiveIntents";
import { useColumnVisibility } from "@/hooks/useColumnVisibility";
import { CHAINS } from "@/lib/marketData";
import { buildIntentsCsv, downloadCsv } from "@/lib/csv";
import { timeAgo } from "@/lib/time";
import type { IntentStatus } from "@/lib/types";

const STATUS_OPTIONS: Array<IntentStatus | "all"> = ["all", "pending", "accepted", "filled", "failed"];
const PAGE_SIZE = 10;

// On-screen row columns. `pair` and `status` and `submitted` are essential for
// scanning the list, so they can't be hidden; `chain` and `solver` are optional.
const MY_INTENTS_COLUMNS = ["pair", "chain", "solver", "status", "submitted"] as const;
type MyIntentsColumn = (typeof MY_INTENTS_COLUMNS)[number];
const ALWAYS_VISIBLE_COLUMNS: MyIntentsColumn[] = ["pair", "status", "submitted"];
const COLUMN_LABELS: Record<MyIntentsColumn, string> = {
  pair: "Swap",
  chain: "Source chain",
  solver: "Solver",
  status: "Status",
  submitted: "Submitted",
};

export default function MyIntentsPage() {
  const address = useWalletStore((s) => s.address);
  const isConnected = useWalletStore((s) => s.isConnected);

  const { intents, isLoading, error, isLive } = useMyLiveIntents(address);
  const { visibility, toggle, isToggleable } = useColumnVisibility<MyIntentsColumn>(
    "vortex-my-intents-columns",
    MY_INTENTS_COLUMNS,
    ALWAYS_VISIBLE_COLUMNS,
  );

  const [statusFilter, setStatusFilter] = useState<IntentStatus | "all">("all");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let result = intents;
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter);
    if (chainFilter !== "all") result = result.filter((i) => i.srcChain === chainFilter);
    return result;
  }, [intents, statusFilter, chainFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, chainFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const handleExportCsv = () => {
    downloadCsv("vortex-my-intents.csv", buildIntentsCsv(filtered));
  };

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="My Intents" />

      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-3">Swap History</div>
            <h1 className="text-3xl font-bold text-vx-text mb-3">My Intents</h1>
            <p className="text-vx-muted text-sm max-w-lg leading-relaxed">
              All swap intents submitted from your connected wallet.
            </p>
          </div>
          {isConnected && (
            <div className="flex items-center gap-1.5 text-[10px] text-vx-muted px-1 pt-1 flex-shrink-0">
              <span aria-hidden="true" className={`state-dot ${isLive ? "bg-vx-sage" : "bg-vx-dim"}`} />
              {isLive ? "Live" : "Polling"}
            </div>
          )}
        </div>

        {!isConnected ? (
          <div className="card p-8 text-center">
            <p className="text-sm text-vx-muted mb-4">
              Connect your wallet to view your swap history.
            </p>
            <ConnectWalletButton />
          </div>
        ) : (
          <>
            {/* Filters */}
            <fieldset className="flex flex-wrap items-center gap-2 mb-6 border-0 p-0">
              <legend className="sr-only">Filter intents</legend>
              <label htmlFor="my-status-filter">
                <span className="sr-only">Filter by status</span>
                <select
                  id="my-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as IntentStatus | "all")}
                  className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </select>
              </label>

              <label htmlFor="my-chain-filter">
                <span className="sr-only">Filter by chain</span>
                <select
                  id="my-chain-filter"
                  value={chainFilter}
                  onChange={(e) => setChainFilter(e.target.value)}
                  className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
                >
                  <option value="all">All chains</option>
                  {CHAINS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>

              <div className="relative ml-auto">
                <button
                  type="button"
                  onClick={() => setShowColumnMenu((open) => !open)}
                  aria-haspopup="true"
                  aria-expanded={showColumnMenu}
                  className="px-3 py-2 rounded-lg border border-vx-border text-xs font-semibold text-vx-muted hover:text-vx-text hover:border-vx-sage/40 transition-colors"
                >
                  Columns
                </button>
                {showColumnMenu && (
                  <div
                    role="group"
                    aria-label="Visible columns"
                    className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-vx-border bg-vx-card p-2 shadow-xl"
                  >
                    {MY_INTENTS_COLUMNS.filter((c) => c !== "pair").map((column) => (
                      <label
                        key={column}
                        className="flex items-center gap-2 px-1.5 py-1 text-xs text-vx-text"
                      >
                        <input
                          type="checkbox"
                          checked={visibility[column]}
                          disabled={!isToggleable(column)}
                          onChange={() => toggle(column)}
                        />
                        {COLUMN_LABELS[column]}
                        {!isToggleable(column) && (
                          <span className="ml-auto text-[10px] text-vx-muted">always</span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={filtered.length === 0}
                className="px-3 py-2 rounded-lg border border-vx-border text-xs font-semibold text-vx-muted hover:text-vx-text hover:border-vx-sage/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-vx-border disabled:hover:text-vx-muted"
              >
                Export CSV
              </button>

              <span className="text-xs text-vx-muted" aria-live="polite" aria-atomic="true">
                {filtered.length} intent{filtered.length === 1 ? "" : "s"}
              </span>
            </fieldset>

            {/* List */}
            {isLoading ? (
              <div role="status" className="space-y-2 text-sm text-vx-muted">
                Loading your intents...
                <div aria-hidden="true" className="space-y-2 pt-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="h-14 bg-vx-surface/40 rounded-lg border border-vx-line animate-pulse" />
                  ))}
                </div>
              </div>
            ) : error ? (
              <div role="alert" className="card p-8 text-center text-sm text-vx-muted">
                Couldn&apos;t load intents right now. Try again shortly.
              </div>
            ) : intents.length === 0 ? (
              <div role="status" className="card p-8 text-center text-sm text-vx-muted">
                <p className="mb-4">You haven&apos;t submitted any swaps yet.</p>
                <Link
                  href="/"
                  className="inline-block px-4 py-2 rounded-lg border border-vx-sage/40 text-vx-text text-sm hover:border-vx-sage/70 transition-colors focus:outline-none focus:ring-2 focus:ring-vx-sage focus:ring-offset-2 focus:ring-offset-vx-ink rounded"
                >
                  Make your first swap
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <div role="status" className="card p-8 text-center text-sm text-vx-muted">
                No intents match your filters.
              </div>
            ) : (
              <div data-address={address} data-testid="intents-list" className="space-y-2" role="list">
                {filtered.map((item) => (
                  <Link
                    key={item.id}
                    href={`/explore/${item.id}`}
                    className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 bg-vx-surface/40 rounded-lg border border-vx-line hover:border-vx-sage/40 active:bg-vx-surface/60 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-vx-text truncate">
                        {item.srcAmount} {item.srcToken} → {item.dstToken}
                      </div>
                      {(visibility.chain || visibility.solver) && (
                        <div className="text-xs text-vx-muted capitalize">
                          {visibility.chain && item.srcChain}
                          {visibility.chain && visibility.solver && " · "}
                          {visibility.solver && `via ${item.solver}`}
                        </div>
                      )}
                      <div className="text-[11px] text-vx-muted mt-0.5">
                        submitted {timeAgo(item.createdAt)}
                      </div>
                    </div>
                    <div className="self-start sm:self-center">
                      <IntentStatusBadge status={item.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
