import { useCallback, useState } from "react";
import { mutate } from "swr";
import { acceptIntent } from "@/lib/api";
import { useRetry } from "@/hooks/useRetry";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";

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

        const solverAddress = wallet.address;
        // Wrap the accept call with retry so transient failures are handled
        // automatically without requiring a manual retry from the solver.
        await withRetry(() => acceptIntent(intentId, solverAddress));

        await mutate("/intents/open");
        useToastStore
          .getState()
          .addToast("Intent accepted — you have exclusive fill rights.", "success");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to accept intent.";
        setError(message);
        useToastStore.getState().addToast(message, "error");
      } finally {
        setAcceptingId(null);
      }
    },
    [withRetry],
  );

  return { accept, acceptingId, error };
}
