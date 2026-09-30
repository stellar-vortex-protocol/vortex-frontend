import { useEffect, useMemo, useRef } from "react";
import useSWRInfinite from "swr/infinite";
import { apiFetch } from "@/lib/api";
import { intentsPageSchema, type IntentsPage } from "@/lib/schemas";
import type { FeedItem, IntentStatus } from "@/lib/types";

export const PAGE_SIZE = 50;

export type IntentsPageFilters = {
  status?: IntentStatus | "all";
  chain?: string;
};
export type IntentsPageSort = "newest" | "oldest" | "largest";

/**
 * Builds the SWR Infinite key for page `pageIndex`. Returns null once the
 * previous page reported no further cursor, which stops loading.
 *
 * API contract: `GET /intents?limit=&cursor=&status=&chain=&sort=` →
 * `{ items, nextCursor }`. The legacy unpaginated array response is accepted
 * by `intentsPageSchema` as a single, final page (compatibility shim).
 */
export function getIntentsPageKey(
  filters: IntentsPageFilters,
  sort: IntentsPageSort,
  limit = PAGE_SIZE,
) {
  return (pageIndex: number, previous: IntentsPage | null): string | null => {
    if (previous && !previous.nextCursor) return null;
    const qs = new URLSearchParams({ limit: String(limit) });
    if (filters.status && filters.status !== "all") qs.set("status", filters.status);
    if (filters.chain && filters.chain !== "all") qs.set("chain", filters.chain);
    if (sort !== "newest") qs.set("sort", sort);
    if (pageIndex > 0 && previous?.nextCursor) qs.set("cursor", previous.nextCursor);
    return `/intents?${qs.toString()}`;
  };
}

export function useIntentsPage({
  filters = {},
  sort = "newest",
}: { filters?: IntentsPageFilters; sort?: IntentsPageSort } = {}) {
  const filterKey = `${filters.status ?? "all"}|${filters.chain ?? "all"}|${sort}`;

  // Changing filters aborts any in-flight page loads for the previous filters.
  const controllerRef = useRef(new AbortController());
  useEffect(() => {
    const controller = new AbortController();
    controllerRef.current = controller;
    return () => controller.abort();
  }, [filterKey]);

  const getKey = useMemo(
    () => getIntentsPageKey(filters, sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filterKey captures filters/sort by value
    [filterKey],
  );

  const { data, error, isLoading, isValidating, size, setSize, mutate } = useSWRInfinite<IntentsPage>(
    getKey,
    (path: string) =>
      apiFetch<IntentsPage>(path, undefined, {
        validator: intentsPageSchema,
        signal: controllerRef.current.signal,
        retry: false,
      }),
    { revalidateFirstPage: false, dedupingInterval: 8_000 },
  );

  const pages = useMemo(() => data ?? [], [data]);
  // Dedup by id: a cursor can shift when new intents are inserted server-side.
  const intents = useMemo(() => {
    const seen = new Set<string>();
    const out: FeedItem[] = [];
    for (const page of pages) {
      for (const item of page.items) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        out.push(item);
      }
    }
    return out;
  }, [pages]);

  const last = pages[pages.length - 1];
  const hasMore = Boolean(last?.nextCursor);
  const isLoadingMore = isValidating && size > pages.length;

  return {
    pages,
    intents,
    error,
    isLoading,
    isLoadingMore,
    hasMore,
    // After a failed page load, loadMore re-requests it; loaded pages are kept.
    loadMore: () => {
      if (error) void mutate();
      else if (hasMore && !isLoadingMore) void setSize(pages.length + 1);
    },
    retry: () => void mutate(),
  };
}
