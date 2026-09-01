import useSWR from "swr";
import { fetcher } from "@/lib/api";
import { swrRetryConfig } from "@/hooks/useRetry";
import type { OpenIntent } from "@/lib/types";

// Open intents are NOT covered by a WebSocket subscription (the WS feed is
// for filled/updated intents, not the open-auction queue), so we keep a
// polling interval here. 5 s matches the deadline granularity visible in the
// UI — solvers see a refreshed queue every 5 s.
//
// dedupingInterval is set to match refreshInterval (5 s). Previously the
// default 2 s dedupe window was shorter than the 5 s poll, which meant a
// rapid focus-in could fire a duplicate request inside the same poll cycle.
// Setting it to 5 s ensures at most one network request per poll interval
// regardless of tab-switching behaviour.
//
// revalidateOnFocus is disabled because the solve page is typically kept open
// in a single tab by a solver watching the queue; focus events would trigger
// unnecessary requests on top of the existing poll.
export function useOpenIntents() {
  const { data, error, isLoading } = useSWR<OpenIntent[]>("/intents/open", fetcher, {
    refreshInterval: 5_000,
    dedupingInterval: 5_000,
    revalidateOnFocus: false,
    ...swrRetryConfig,
  });

  return { intents: data ?? [], isLoading, error };
}
