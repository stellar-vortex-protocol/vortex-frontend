import { useCallback, useState } from "react";
import { walletAdapter } from "@/lib/wallet";
import { createIntent, submitIntent } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { decodeXdr, validateSwapXdr, verifySignedXdrMatches } from "@/lib/xdrReview";
import {
  classifyFlowError,
  FLOW_ERROR_GUIDANCE,
  useTransactionFlow,
  type FlowErrorKind,
  type FlowStatus,
} from "@/lib/flow";
import type { QuoteRequest } from "@/lib/types";

// Status, error classification and cancellation live in the shared
// transaction-flow machine (#416); these aliases keep the public API stable.
export type SwapSubmissionStatus = FlowStatus;
export type SwapErrorKind = FlowErrorKind;
export const classifySwapError = classifyFlowError;
export const SWAP_ERROR_GUIDANCE = FLOW_ERROR_GUIDANCE;

export function useSwapSubmission() {
  const [intentId, setIntentId] = useState<string | null>(null);

  const flow = useTransactionFlow<QuoteRequest, void>({
    fallbackMessage: "Failed to submit swap.",
    run: async (params, { step }) => {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        wallet = await step("connecting", async () => {
          await useWalletStore.getState().connect();
          const next = useWalletStore.getState();
          if (!next.isConnected || !next.address) {
            throw new Error(next.error ?? "Connect a wallet to submit a swap.");
          }
          return next;
        });
      }
      const dstAddress = wallet.address as string;

      const { intentId: newIntentId, unsignedXdr } = await step("building", (signal) =>
        createIntent({ ...params, dstAddress }, signal),
      );
      setIntentId(newIntentId);

      // #244: decode and validate the relay's XDR before handing it to
      // Freighter. A mismatch is a hard stop — never sign an unvalidated XDR.
      await step("reviewing", () => {
        const decoded = decodeXdr(unsignedXdr, wallet.network);
        validateSwapXdr(decoded, { srcAmount: params.srcAmount, dstAddress });
      });

      const signedXdr = await step("awaiting-signature", () =>
        walletAdapter.signTransaction(unsignedXdr, { network: wallet.network ?? undefined }),
      );

      // Defense-in-depth: verify signed XDR matches unsigned (Issue #308)
      const xdrVerification = verifySignedXdrMatches(unsignedXdr, signedXdr);
      if (!xdrVerification.valid) {
        throw new Error(
          xdrVerification.error ??
            "Transaction verification failed. The signed transaction does not match what was reviewed.",
        );
      }

      await step("submitting", (signal) => submitIntent(newIntentId, signedXdr, signal));
    },
    onSuccess: () => {
      useToastStore.getState().addToast("Swap submitted successfully.", "success");
    },
    onError: (message) => {
      useToastStore.getState().addToast(message, "error");
    },
  });

  const { start, reset: resetFlow } = flow;

  const submit = useCallback(
    async (params: QuoteRequest) => {
      if (flow.isPending) return;
      setIntentId(null);
      await start(params);
    },
    [flow.isPending, start],
  );

  const reset = useCallback(() => {
    resetFlow();
    setIntentId(null);
  }, [resetFlow]);

  return {
    status: flow.status,
    error: flow.error,
    errorKind: flow.errorKind,
    intentId,
    submit,
    reset,
    cancel: flow.cancel,
  };
}
