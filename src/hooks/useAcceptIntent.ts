import { useCallback } from "react";
import { mutate } from "swr";
import { acceptIntent, ApiError } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { useTransactionFlow } from "@/lib/flow";
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
 * Accepts an open intent on behalf of the connected solver, built on the
 * shared transaction-flow machine (connecting → submitting). The open-intents
 * list is updated optimistically and rolled back on error. Only one accept can
 * be in flight at a time; cancellation (unmount, wallet switch) aborts the
 * request. Failures are never auto-retried — see useRetry.ts for rationale.
 */
export function useAcceptIntent() {
  const flow = useTransactionFlow<string, void>({
    getErrorMessage: AcceptErrorMessage,
    run: async (intentId, { step }) => {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        wallet = await step("connecting", async () => {
          await useWalletStore.getState().connect();
          const next = useWalletStore.getState();
          if (!next.isConnected || !next.address) {
            throw new Error(next.error ?? "Connect a wallet to accept an intent.");
          }
          return next;
        });
      }
      const solverAddress = wallet.address as string;

      await step("submitting", (signal) =>
        mutate<OpenIntent[]>(
          "/intents/open",
          async (current) => {
            await acceptIntent(intentId, solverAddress, signal);
            return (current ?? []).filter((intent) => intent.id !== intentId);
          },
          {
            optimisticData: (current) => (current ?? []).filter((intent) => intent.id !== intentId),
            rollbackOnError: true,
            populateCache: true,
            revalidate: false,
          },
        ),
      );
    },
    onSuccess: () => {
      useToastStore
        .getState()
        .addToast("Intent accepted — you have exclusive fill rights.", "success");
    },
    onError: (message) => {
      useToastStore.getState().addToast(message, "error");
    },
  });

  const { start } = flow;
  const accept = useCallback(
    async (intentId: string) => {
      await start(intentId);
    },
    [start],
  );

  return {
    accept,
    acceptingId: flow.activeParams,
    error: flow.error,
    errorKind: flow.errorKind,
    status: flow.status,
    cancel: flow.cancel,
  };
}
