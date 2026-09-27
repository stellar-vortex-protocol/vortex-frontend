"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { IntentListSkeleton } from "@/components/Skeleton";
import { VirtualList } from "@/components/VirtualList";
import { ExportDialog } from "@/components/ExportDialog";
import { EmptyState } from "@/components/EmptyState";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { timeAgo } from "@/lib/time";
import { CHAINS } from "@/lib/marketData";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { FeedItem, IntentStatus } from "@/lib/types";

const STATUS_OPTIONS: Array<IntentStatus | "all"> = [
  "all",
  "pending",
  "accepted",
  "filled",
  "failed",
];
const SORT_OPTIONS = ["newest", "oldest", "largest"] as const;
type SortOption = (typeof SORT_OPTIONS)[number];
const CHAIN_IDS = new Set(CHAINS.map((c) => c.id));
const ROW_ESTIMATE = 88;
const getIntentKey = (item: FeedItem) => item.id;

function readStatus(value: string | null): IntentStatus | "all" {
  return value && (STATUS_OPTIONS as string[]).includes(value) ? (value as IntentStatus | "all") : "all";
}
function readChain(value: string | null): string {
  return value && CHAIN_IDS.has(value) ? value : "all";
}
function readSort(value: string | null): SortOption {
  return value && (SORT_OPTIONS as readonly string[]).includes(value) ? (value as SortOption) : "newest";
}

export default function ExplorePageClient() {
  const { t } = useTranslation();
  const { intents, isLoading, error, isLive } = useLiveIntents();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusFilter = readStatus(searchParams.get("status"));
  const chainFilter = readChain(searchParams.get("chain"));
  const sort = readSort(searchParams.get("sort"));

  const updateQuery = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === "all" || value === "newest" || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 200);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search from anywhere on the page (unless already typing).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key !== "/" || target?.closest("input, textarea, select, [contenteditable='true']")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setStatusFilter = (value: IntentStatus | "all") => updateQuery({ status: value });
  const setChainFilter = (value: string) => updateQuery({ chain: value });
  const setSort = (value: SortOption) => updateQuery({ sort: value });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(readStatus(e.target.value));
  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => setChainFilter(readChain(e.target.value));
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSort(readSort(e.target.value));

  const isFiltered = statusFilter !== "all" || chainFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setChainFilter("all");
  };

  const filtered = useMemo(() => {
    let result = intents;

    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (chainFilter !== "all") {
      result = result.filter((i) => i.srcChain === chainFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(
        (i) =>
          i.id.toLowerCase().includes(q) ||
          i.srcToken.toLowerCase().includes(q) ||
          i.dstToken.toLowerCase().includes(q) ||
          i.srcChain.toLowerCase().includes(q) ||
          i.solver.toLowerCase().includes(q),
      );
    }

    result = [...result].sort((a, b) => {
      if (sort === "newest")
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      if (sort === "oldest")
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      return parseFloat(b.srcAmount) - parseFloat(a.srcAmount);
    });

    return result;
  }, [intents, debouncedSearch, statusFilter, chainFilter, sort]);

  // Pagination is superseded by virtualization (#228); rows are measured
  // (#444) so wrapped content at small widths is never clipped.
  const resetKey = `${statusFilter}|${chainFilter}|${sort}|${debouncedSearch}`;
  const restoreKey = `explore?${searchParams.toString()}`;

  return (
    <div className="min-h-screen">
      <Nav variant="breadcrumb" label="Explore" />

      <main id="main-content" className="max-w-5xl mx-auto px-5 py-12">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-3">Intent Explorer</div>
            <h1 className="text-3xl font-bold text-vx-text mb-3">
              Browse all intents
            </h1>
            <p className="text-vx-muted text-sm max-w-lg leading-relaxed">
              Every swap intent submitted to Vortex, from open auctions to
              completed fills.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-vx-muted px-1 pt-1 flex-shrink-0">
            <span aria-hidden="true" className={`state-dot ${isLive ? "bg-vx-sage" : "bg-vx-dim"}`} />
            {isLive ? t("activityFeed.status.live") : t("activityFeed.status.polling")}
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <label htmlFor="intent-search" className="sr-only">
            Search intents
          </label>
          <input
            ref={searchRef}
            id="intent-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by id, token, chain or solver"
            aria-keyshortcuts="/"
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text placeholder-vx-dim/60 focus:outline-none focus:border-vx-sage/50 transition-colors"
          />

          <label htmlFor="status-filter" className="sr-only">
            Filter by status
          </label>
          <select
            id="status-filter"
            value={statusFilter}
            onChange={handleStatusChange}
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all"
                  ? "All statuses"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>

          <label htmlFor="chain-filter" className="sr-only">
            Filter by chain
          </label>
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

          <label htmlFor="sort-order" className="sr-only">
            Sort order
          </label>
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

          {isFiltered && (
            <button
              type="button"
              onClick={clearFilters}
              className="px-3 py-2 rounded-lg border border-vx-sage/40 text-xs font-semibold text-vx-sage hover:border-vx-sage/70 transition-colors focus:outline-none focus:ring-2 focus:ring-vx-sage focus:ring-offset-2 focus:ring-offset-vx-ink"
            >
              {t("explore.empty.clearFilters")}
            </button>
          )}

          <ExportDialog items={filtered} filenameBase="vortex-intents" />

          <span className="text-xs text-vx-muted ml-auto" aria-live="polite" aria-atomic="true">
            {filtered.length} intent{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Results */}
        {isLoading && intents.length === 0 ? (
          <IntentListSkeleton count={4} />
        ) : error ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-medium text-vx-text mb-1">{t("explore.error.title")}</p>
            <p className="text-xs text-vx-muted max-w-xs mx-auto">{t("explore.error.message")}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm font-medium text-vx-text mb-1">{t("explore.empty.title")}</p>
            <p className="text-xs text-vx-muted max-w-xs mx-auto mb-4">{t("explore.empty.message")}</p>
            {isFiltered && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-block px-4 py-2 rounded-lg border border-vx-sage/40 text-vx-text text-sm hover:border-vx-sage/70 transition-colors focus:outline-none focus:ring-2 focus:ring-vx-sage focus:ring-offset-2 focus:ring-offset-vx-ink"
              >
                {t("explore.empty.clearFilters")}
              </button>
            )}
          </div>
        ) : (
          <VirtualList
            items={filtered}
            getKey={getIntentKey}
            estimateSize={ROW_ESTIMATE}
            label={t("explore.list.label", { count: String(filtered.length) })}
            restoreKey={restoreKey}
            resetKey={resetKey}
            onActivate={(item) => router.push(`/explore/${item.id}`)}
            renderRow={(item) => (
              <Link
                href={`/explore/${item.id}`}
                tabIndex={-1}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 bg-vx-surface/40 rounded-lg border border-vx-line
                            hover:border-vx-border transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-vx-text break-words">
                    {item.srcAmount} {item.srcToken} → {item.dstToken}
                  </div>
                  <div className="text-xs text-vx-muted capitalize break-words">
                    {item.srcChain} · via {sanitizeDisplayText(item.solver)}
                  </div>
                </div>
                <IntentStatusBadge status={item.status} />
                <span className="text-xs text-vx-muted num flex-shrink-0 w-16 text-right">
                  {timeAgo(item.createdAt)}
                </span>
              </Link>
            )}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
