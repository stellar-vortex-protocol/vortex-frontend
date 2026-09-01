import dynamic from "next/dynamic";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { EmptyState } from "@/components/EmptyState";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { downloadCsv, buildIntentsCsv } from "@/lib/csv";
import { timeAgo } from "@/lib/time";
import { CHAINS } from "@/lib/marketData";
import type { IntentStatus } from "@/lib/types";

const STATUS_OPTIONS: Array<IntentStatus | "all"> = ["all", "pending", "accepted", "filled", "failed"];
const SORT_OPTIONS = ["newest", "oldest", "largest"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 180;

export default function ExplorePage() {
  const { intents, isLoading, error } = useLiveIntents();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<IntentStatus | "all">("all");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);

  const updateUrl = useCallback((key: string, value: string, defaultValue: string) => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (value === defaultValue) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", next);
  }, []);

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setStatusFilter(e.target.value as IntentStatus | "all"),
    [],
  );

  const handleChainChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setChainFilter(e.target.value),
    [],
  );

  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => setSort(e.target.value as SortOption),
    [],
  );

  const filtered = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    let result = intents;

    if (query) {
      result = result.filter((item) => {
        const haystack = [
          item.id,
          item.srcToken,
          item.dstToken,
          item.srcChain,
          item.solver,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((item) => item.status === statusFilter);
    }

    if (chainFilter !== "all") {
      result = result.filter((item) => item.srcChain === chainFilter);
    }

    result = [...result].sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return Number.parseFloat(b.srcAmount) - Number.parseFloat(a.srcAmount);
    });

    return result;
  }, [chainFilter, debouncedSearch, intents, sort, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, chainFilter, sort, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Explore" />

      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-3">Intent Explorer</div>
            <h1 className="text-3xl font-bold text-vx-text mb-3">Browse all intents</h1>
            <p className="text-vx-muted text-sm max-w-lg leading-relaxed">
              Every swap intent submitted to Vortex, from open auctions to completed fills.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-vx-muted px-1 pt-1 flex-shrink-0">
            <span aria-hidden="true" className={`state-dot ${isLive ? "bg-vx-sage" : "bg-vx-dim"}`} />
            {isLive ? "Live" : "Polling"}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <label htmlFor="intent-search" className="sr-only">Search intents</label>
          <input
            id="intent-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by id, token, chain or solver"
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:border-vx-sage/50 transition-colors"
          />

          <label htmlFor="status-filter" className="sr-only">Filter by status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusChange}
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? "All statuses" : status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>

          <label htmlFor="chain-filter" className="sr-only">Filter by chain</label>
          <select
            id="chain-filter"
            value={chainFilter}
            onChange={handleChainChange}
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
          >
            <option value="all">All chains</option>
            {CHAINS.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>

          <label htmlFor="sort-order" className="sr-only">Sort order</label>
          <select
            id="sort-order"
            value={sort}
            onChange={handleSortChange}
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="largest">Largest amount</option>
          </select>

          <span className="text-xs text-vx-muted ml-auto">
            {filtered.length} intent{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Results */}
        {isLoading && intents.length === 0 ? (
          <div className="space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-vx-surface/40 rounded-lg border border-vx-line animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <EmptyState title="Couldn't load intents" message="Try again shortly." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No intents found" message="No intents match your filters." />
        ) : (
          <>
            <div role="row" className="flex items-center gap-4 px-4 pb-2 text-[10px] uppercase tracking-wide text-vx-dim">
              <div role="columnheader" aria-sort={sort === "largest" ? "descending" : "none"} className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setSort("largest")}
                  className="flex items-center gap-1 text-left hover:text-vx-text transition-colors"
                >
                  Amount
                  {sort === "largest" && <span aria-hidden="true">↓</span>}
                </button>
              </div>
              <div
                role="columnheader"
                aria-sort={sort === "newest" ? "descending" : sort === "oldest" ? "ascending" : "none"}
                className="w-16 flex-shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setSort(sort === "newest" ? "oldest" : "newest")}
                  className="flex items-center justify-end gap-1 w-full text-right hover:text-vx-text transition-colors"
                >
                  Time
                  {sort === "newest" && <span aria-hidden="true">↓</span>}
                  {sort === "oldest" && <span aria-hidden="true">↑</span>}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              {paginated.map((item) => (
                <Link
                  key={item.id}
                  href={`/explore/${item.id}`}
                  className="flex items-center gap-4 p-4 bg-vx-surface/40 rounded-lg border border-vx-line
                             hover:border-vx-border transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-vx-text truncate">
                      {item.srcAmount} {item.srcToken} → {item.dstToken}
                    </div>
                    <div className="text-xs text-vx-muted capitalize">
                      {item.srcChain} · via {item.solver}
                    </div>
                  </div>
                  <IntentStatusBadge status={item.status} />
                  <div className="w-16 flex-shrink-0 text-right text-xs text-vx-muted">
                    {timeAgo(item.createdAt)}
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-vx-muted">
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  disabled={page === 1}
                  className="rounded-lg border border-vx-border px-3 py-1.5 disabled:opacity-50"
                >
                  Previous
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  disabled={page === totalPages}
                  className="rounded-lg border border-vx-border px-3 py-1.5 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}


