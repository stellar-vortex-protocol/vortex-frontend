"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { IntentListSkeleton } from "@/components/Skeleton";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { timeAgo } from "@/lib/time";
import { CHAINS } from "@/lib/marketData";
import type { FeedItem, IntentStatus } from "@/lib/types";

const STATUS_OPTIONS: Array<IntentStatus | "all"> = ["all", "pending", "accepted", "filled", "failed"];
const SORT_OPTIONS = ["newest", "oldest", "largest"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];

const PAGE_SIZE = 10;

function isExpiredPending(item: FeedItem): boolean {
  if (item.status !== "pending" || !item.deadline) return false;
  return new Date(item.deadline).getTime() <= Date.now();
}

export default function ExplorePage() {
  const { intents, isLoading, error, isLive } = useLiveIntents();
  const [statusFilter, setStatusFilter] = useState<IntentStatus | "all">("all");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [page, setPage] = useState(1);

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as IntentStatus | "all";
      setStatusFilter(value);
      updateUrl("status", value, "all");
    },
    [updateUrl],
  );
  const handleChainChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setChainFilter(e.target.value);
      updateUrl("chain", e.target.value, "all");
    },
    [updateUrl],
  );
  const handleSortChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as SortOption;
      setSort(value);
      updateUrl("sort", value, "newest");
    },
    [updateUrl],
  );

  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const filtered = useMemo(() => {
    let result = intents;

    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (chainFilter !== "all") {
      result = result.filter((i) => i.srcChain === chainFilter);
    }

    result = [...result].sort((a, b) => {
      if (sort === "newest") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === "oldest") return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return parseFloat(b.srcAmount) - parseFloat(a.srcAmount);
    });

    return result;
  }, [intents, debouncedSearch, statusFilter, chainFilter, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, chainFilter, sort]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const handleExportCsv = () => {
    downloadCsv("vortex-intents.csv", buildIntentsCsv(filtered));
  };

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Explore" />
      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-8">
          <div className="h-3 w-24 bg-vx-surface/40 rounded animate-pulse mb-3" />
          <div className="h-8 w-52 bg-vx-surface/40 rounded animate-pulse mb-3" />
          <div className="h-4 w-80 bg-vx-surface/40 rounded animate-pulse" />
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-6">
          <label htmlFor="intent-search" className="sr-only">Search intents</label>
          <input
            id="intent-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by id, token, chain or solver"
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text
                       placeholder-vx-dim/60 focus:outline-none focus:border-vx-sage/50 transition-colors"
          />

          <label htmlFor="status-filter" className="sr-only">Filter by status</label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusChange}
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "All statuses" : s.charAt(0).toUpperCase() + s.slice(1)}
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
            {CHAINS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
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

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="ml-auto px-3 py-2 rounded-lg border border-vx-border text-xs font-semibold text-vx-muted hover:text-vx-text hover:border-vx-sage/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-vx-border disabled:hover:text-vx-muted"
          >
            Export CSV
          </button>

          <span className="text-xs text-vx-muted">
            {filtered.length} intent{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {isLoading && intents.length === 0 ? (
          <IntentListSkeleton count={4} />
        ) : error ? (
          <EmptyState title="Couldn't load intents" message="Try again shortly." />
        ) : filtered.length === 0 ? (
          <EmptyState title="No intents found" message="No intents match your filters." />
        ) : (
          <div className="space-y-2">
            <div role="row" className="flex items-center gap-4 px-4 pb-2 text-[10px] uppercase tracking-wide text-vx-dim">
              <div role="columnheader" aria-sort={sort === "largest" ? "descending" : "none"} className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={() => setSort("largest")}
                  className="flex items-center gap-1 text-left hover:text-vx-text active:text-vx-sage transition-colors"
                >
                  Amount
                  {sort === "largest" && <span aria-hidden="true">↓</span>}
                </button>
              </div>
              <div className="w-20 flex-shrink-0">Status</div>
              <div
                role="columnheader"
                aria-sort={sort === "newest" ? "descending" : sort === "oldest" ? "ascending" : "none"}
                className="w-16 flex-shrink-0"
              >
                <button
                  type="button"
                  onClick={() => setSort(sort === "newest" ? "oldest" : "newest")}
                  className="flex items-center justify-end gap-1 w-full text-right hover:text-vx-text active:text-vx-sage transition-colors"
                >
                  Time
                  {sort === "newest" && <span aria-hidden="true">↓</span>}
                  {sort === "oldest" && <span aria-hidden="true">↑</span>}
                </button>
              </div>
            </div>

            {paginated.map((item) => (
              <Link
                key={item.id}
                href={`/explore/${item.id}`}
                className="flex items-center gap-4 p-4 bg-vx-surface/40 rounded-lg border border-vx-line hover:border-vx-sage/40 active:bg-vx-surface/60 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-vx-text truncate">
                    {item.srcAmount} {item.srcToken} → {item.dstToken}
                  </div>
                  <div className="text-xs text-vx-muted capitalize">
                    {item.srcChain} · via {item.solver}
                  </div>
                </div>
                <div className="w-20 flex-shrink-0">
                  <IntentStatusBadge status={item.status} />
                </div>
                <div className="w-16 flex-shrink-0 text-right text-xs text-vx-muted">
                  {timeAgo(item.createdAt)}
                </div>
              </Link>
            ))}

            {pageCount > 1 && (
              <div className="flex items-center justify-between pt-4 text-xs text-vx-muted">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page === 1}
                  className="px-3 py-2 rounded-lg border border-vx-border hover:text-vx-text hover:border-vx-sage/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-vx-border disabled:hover:text-vx-muted"
                >
                  Previous
                </button>
                <span>Page {page} of {pageCount}</span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                  disabled={page === pageCount}
                  className="px-3 py-2 rounded-lg border border-vx-border hover:text-vx-text hover:border-vx-sage/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-vx-border disabled:hover:text-vx-muted"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>Merge
  ),
  ssr: false,
});

export default function ExplorePage() {
  return <ExplorePageClient />;
}
