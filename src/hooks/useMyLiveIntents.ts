import { useEffect, useRef } from "react";
import { useMyIntents } from "./useMyIntents";
import { useLiveIntentView } from "./useLiveIntentView";
import { useIntentStore, selectMine } from "@/store/intents";

export function useMyLiveIntents(address: string | null) {
  const { intents: restIntents, isLoading, error, mutate } = useMyIntents(address);
  const { isLive, isCatchingUp } = useLiveIntentView(
    "mine",
    { items: restIntents, mutate },
    address !== null,
  );
  const intents = useIntentStore(selectMine(address));

  // Optimistic entries belong to the account that submitted them; drop them
  // when the wallet switches accounts (not on first mount).
  const prevAddressRef = useRef(address);
  useEffect(() => {
    if (prevAddressRef.current !== address) useIntentStore.getState().clearOptimistic();
    prevAddressRef.current = address;
  }, [address]);

  return { intents, isLoading, error, mutate, isLive, isCatchingUp };
}
