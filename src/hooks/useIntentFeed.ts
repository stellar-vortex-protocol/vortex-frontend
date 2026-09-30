import { useActivityFeed } from "./useActivityFeed";
import { useLiveIntentView } from "./useLiveIntentView";
import { useIntentStore, selectFeed } from "@/store/intents";

const MAX_ITEMS = 8;

// Seeds the feed from the REST snapshot (useActivityFeed) and layers live
// updates from the intents WebSocket on top via the shared intent store.
export function useIntentFeed() {
  const { items: seedItems, isLoading, error, mutate } = useActivityFeed();
  const { isLive, isCatchingUp } = useLiveIntentView("feed", { items: seedItems, mutate });
  const items = useIntentStore(selectFeed(MAX_ITEMS));

  return { items, isLoading, error, isLive, isCatchingUp };
}
