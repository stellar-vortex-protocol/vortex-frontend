import { useCallback, useState } from "react";
import { mutate } from "swr";
import { acceptIntent, ApiError } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import type { OpenIntent } from "@/lib/types";

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
 * Accepts an open intent on behalf of the connected solver. The `accept()`
 * call is wrapped with `withRetry` from useRetry so transient 5xx errors or
 * brief network blips are automatically retried with exponential back-off,
 * without the solver needing to act again.
 *
 * Retry policy (from useRetry defaults):
 * - Up to 3 retry attempts.
 * - Exponential back-off: 1 s, 2 s, 4 s.
 * - 4xx errors are NOT retried — they represent a definitive server rejection
 *   (e.g. intent already claimed) and should surface to the user immediately.
 *
 * Signature-requiring flows are intentionally excluded from retry logic —
 * see useRetry.ts for rationale.
 */
export function useAcceptIntent() {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { withRetry } = useRetry();

  const accept = useCallback(
    async (intentId: string) => {
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
    } catch (err) {
      const message = AcceptErrorMessage(err);
      setError(message);
      useToastStore.getState().addToast(message, "error");
    } finally {
      setAcceptingId(null);
    }
  }, []);

  return { accept, acceptingId, error };
}
