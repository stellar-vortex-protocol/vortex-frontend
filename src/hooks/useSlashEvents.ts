import { useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import { fetchSlashEvents, normalizeEvents, type SlashEventPage } from "@/lib/slashEvents";

// Penalties are rare and not yet pushed over the WebSocket, so "live" updates
// come from a 30 s revalidation of the loaded pages.
export function useSlashEvents(address?: string | null) {
  const solver = address ?? null;
  const { data, error, isLoading, size, setSize, isValidating } = useSWRInfinite<SlashEventPage>(
    (index, prev: SlashEventPage | null) => {
      if (prev && !prev.nextCursor) return null;
      return ["slash-events", solver, index === 0 ? null : prev?.nextCursor ?? null] as const;
    },
    ([, s, cursor]: readonly [string, string | null, string | null]) => fetchSlashEvents(s, cursor),
    { refreshInterval: 30_000, revalidateAll: true },
  );

  const events = useMemo(() => normalizeEvents((data ?? []).flatMap((p) => p.events)), [data]);
  const hasMore = Boolean(data && data[data.length - 1]?.nextCursor);

  return {
    events,
    error,
    isLoading,
    isLoadingMore: isValidating && size > (data?.length ?? 0),
    hasMore,
    loadMore: () => setSize(size + 1),
  };
}
