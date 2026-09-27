import { useCallback, useState } from "react";
import { mutate } from "swr";
import { acceptIntent, ApiError } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import type { OpenIntent } from "@/lib/types";

/** Result of an accept attempt, used by the open-intents board row state. */
export type AcceptOutcome = "accepted" | "taken" | "expired" | "error";

export function classifyAcceptError(err: unknown): Exclude<AcceptOutcome, "accepted"> {
  if (err instanceof ApiError) {
    if (err.status === 409) return "taken";
    if (err.status === 410) return "expired";
  }
  if (err instanceof Error && /expired|deadline/i.test(err.message)) return "expired";
  return "error";
}

function AcceptErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) {
    return "Someone else accepted this intent first.";
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Failed to accept intent.";
}

/**
 * useAcceptIntent
 *
 * Accepts an open intent on behalf of the connected solver, optimistically
 * removing it from the `/intents/open` SWR cache (rolled back on failure).
 * Resolves with an `AcceptOutcome` so callers can distinguish a lost race
 * (409 → "taken") or a passed deadline (410 → "expired") from other errors.
 *
 * 4xx errors are not retried — they are a definitive server rejection
 * (e.g. intent already claimed) and must surface immediately.
 */
export function useAcceptIntent() {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(async (intentId: string): Promise<AcceptOutcome> => {
    setError(null);
    setAcceptingId(intentId);

    try {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        await wallet.connect();
        wallet = useWalletStore.getState();
        if (!wallet.isConnected || !wallet.address) {
          throw new Error(wallet.error ?? "Connect a wallet to accept an intent.");
        }
      }
      const solverAddress = wallet.address;

      await mutate<OpenIntent[]>(
        "/intents/open",
        async (current) => {
          await acceptIntent(intentId, solverAddress);
          return (current ?? []).filter((intent) => intent.id !== intentId);
        },
        {
          optimisticData: (current) => (current ?? []).filter((intent) => intent.id !== intentId),
          rollbackOnError: true,
          populateCache: true,
          revalidate: false,
        },
      );

      useToastStore.getState().addToast("Intent accepted — you have exclusive fill rights.", "success");
      return "accepted";
    } catch (err) {
      const message = AcceptErrorMessage(err);
      setError(message);
      useToastStore.getState().addToast(message, "error");
      return classifyAcceptError(err);
    } finally {
      setAcceptingId(null);
    }
  }, []);

  return { accept, acceptingId, error };
}
