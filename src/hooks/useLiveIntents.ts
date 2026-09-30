import { useIntents } from "./useIntents";
import { useLiveIntentView } from "./useLiveIntentView";
import { useIntentStore, selectExplore } from "@/store/intents";

const MAX_ITEMS = 200;

// Like useIntentFeed, but sized for the full explore browse view rather
// than the homepage's small preview list.
export function useLiveIntents() {
  const { intents: restIntents, isLoading, error, mutate } = useIntents();
  const { isLive, isCatchingUp } = useLiveIntentView("explore", { items: restIntents, mutate });
  const intents = useIntentStore(selectExplore(MAX_ITEMS));

  return { intents, isLoading, error, isLive, isCatchingUp };
}
