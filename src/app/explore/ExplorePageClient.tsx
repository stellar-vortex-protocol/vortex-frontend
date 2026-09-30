"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { IntentStatusBadge } from "@/components/IntentStatusBadge";
import { IntentListSkeleton, SkeletonCard } from "@/components/Skeleton";
import { VirtualList } from "@/components/VirtualList";
import { ExportDialog } from "@/components/ExportDialog";
import { buildIntentsCsv, downloadCsv } from "@/lib/csv";
import { EmptyState } from "@/components/EmptyState";
import { HighlightedText, IntentSearchBox } from "@/components/IntentSearchBox";
import { SavedViews } from "@/components/SavedViews";
import { useLiveIntents } from "@/hooks/useLiveIntents";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { buildIntentsCsv, downloadCsv } from "@/lib/csv";
import { IntentListSkeleton, SkeletonCard } from "@/components/Skeleton";
import { useTranslation } from "@/lib/i18n/I18nProvider";
import { timeAgo } from "@/lib/time";
import { CHAINS } from "@/lib/marketData";
import { sanitizeDisplayText } from "@/lib/textSafety";
import type { IntentStatus } from "@/lib/types";
import {
  STATUS_OPTIONS,
  matchesSearch,
  parseSearch,
  readChain,
  readQuery,
  readRange,
  readSort,
  readStatus,
  type RangeOption,
  type SortOption,
} from "@/lib/searchQuery";
import type { ViewParams } from "@/store/views";
import { viewParamsToSearch } from "@/store/views";
import { useBufferedFeed, useFeedPause } from "@/hooks/useBufferedFeed";
import { LiveFeedControls } from "@/components/LiveFeedControls";

const ROW_HEIGHT = 96;
const ROW_GAP = 8;
const SEARCH_DEBOUNCE_MS = 300;
const VIEW_KEYS = ["status", "chain", "sort", "range", "q"] as const;

export default function ExplorePageClient() {
  const { t } = useTranslation();
  const { intents: liveIntents, isLoading, error, isLive } = useLiveIntents();
  const pause = useFeedPause("explore");
  const { visible: intents, pending, overflow, flush } = useBufferedFeed(liveIntents, {
    isPaused: pause.isPaused,
  });
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const statusFilter = readStatus(searchParams.get("status"));
  const chainFilter = readChain(searchParams.get("chain"));
  const sort = readSort(searchParams.get("sort"));
  const range = readRange(searchParams.get("range"));
  const urlQuery = readQuery(searchParams.get("q"));
  const parsedSearch = useMemo(() => parseSearch(urlQuery), [urlQuery]);

  const updateQuery = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === "all" || value === "newest" || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    // `replace` (not push) so typing and filter tweaks don't spam history.
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  // The input is local state; the URL `?q=` follows it after a debounce (#441).
  const [search, setSearch] = useState(urlQuery);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  useEffect(() => {
    const next = readQuery(debouncedSearch);
    if (next !== urlQuery) updateQuery({ q: next });
    // Only the debounced input drives URL writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateQuery/urlQuery are read at call time on purpose
  }, [debouncedSearch]);
  // External URL changes (applied view, back/forward) flow back into the input.
  useEffect(() => {
    setSearch((prev) => (readQuery(prev) === urlQuery ? prev : urlQuery));
  }, [urlQuery]);

  const currentViewParams = useMemo(() => {
    const params: ViewParams = {};
    for (const key of VIEW_KEYS) {
      const value = searchParams.get(key);
      if (value) params[key] = value;
    }
    return params;
  }, [searchParams]);
  const applyView = (params: ViewParams) => {
    router.replace(`${pathname}${viewParamsToSearch(params)}`, { scroll: false });
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
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setStatusFilter(readStatus(e.target.value));
  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => setChainFilter(readChain(e.target.value));
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSort(readSort(e.target.value));
  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    updateQuery({ range: readRange(e.target.value) });

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) =>
    setStatusFilter(readStatus(e.target.value));
  const handleChainChange = (e: React.ChangeEvent<HTMLSelectElement>) => setChainFilter(readChain(e.target.value));
  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSort(readSort(e.target.value));

  const isFiltered = statusFilter !== "all" || chainFilter !== "all" || range !== "all" || urlQuery !== "";

  const clearFilters = () => {
    setSearch("");
    updateQuery({ status: "all", chain: "all", range: "all", q: "" });
  };

  const filtered = useMemo(() => {
    let result = intents;

    if (statusFilter !== "all") {
      result = result.filter((i) => i.status === statusFilter);
    }
    if (chainFilter !== "all") {
      result = result.filter((i) => i.srcChain === chainFilter);
    }
    if (range !== "all") {
      const cutoff = Date.now() - Number(range) * 24 * 60 * 60 * 1000;
      result = result.filter((i) => new Date(i.createdAt).getTime() >= cutoff);
    }
    if (urlQuery) {
      result = result.filter((i) => matchesSearch(i, parsedSearch));
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
  }, [intents, urlQuery, parsedSearch, statusFilter, chainFilter, range, sort]);

  // Pagination is superseded by virtualization (#228): the full filtered/sorted
  // list is windowed instead of paginated, so `page` is intentionally not a URL param.
  // Rows are measured (#444) so wrapped content at small widths is never clipped.
  const scrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  useEffect(() => {
    rowVirtualizer.scrollToIndex(0);
  }, [statusFilter, chainFilter, range, urlQuery, sort, rowVirtualizer]);

  const handleExportCsv = () => {
    downloadCsv("vortex-intents.csv", buildIntentsCsv(filtered));
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

        <SavedViews scope="explore" currentParams={currentViewParams} onApply={applyView} />

        {/* Filters and Search */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <IntentSearchBox value={search} onChange={setSearch} />

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

          <label htmlFor="range-filter" className="sr-only">
            {t("explore.range.label")}
          </label>
          <select
            id="range-filter"
            value={range}
            onChange={handleRangeChange}
            className="bg-vx-surface border border-vx-border rounded-lg px-3 py-2 text-sm text-vx-text"
          >
            {(["all", "7", "30", "90"] satisfies RangeOption[]).map((r) => (
              <option key={r} value={r}>
                {r === "all" ? t("explore.range.all") : t("explore.range.days", { days: r })}
              </option>
            ))}
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

          <LiveFeedControls
            userPaused={pause.userPaused}
            onToggle={pause.toggle}
            pending={pending}
            overflow={overflow}
            onFlush={() => {
              flush();
              pause.containerRef.current?.focus();
            }}
          />

          <span className="text-xs text-vx-muted ml-auto" aria-live="polite" aria-atomic="true">
            {filtered.length} intent{filtered.length === 1 ? "" : "s"}
          </span>
        </div>

        {urlQuery && (
          <p role="note" className="text-xs text-vx-muted mb-3">
            {t("explore.search.loadedOnly")}
          </p>
        )}

        {/* Results */}
        <div className="focus:outline-none" {...pause.containerProps}>
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
        </div>
      </main>

      <Footer />
    </div>
  );
}
