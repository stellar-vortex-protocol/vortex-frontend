import { useCallback, useState } from "react";
import { walletAdapter } from "@/lib/wallet";
import { createIntent, submitIntent } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { decodeXdr, validateSwapXdr, XdrMismatchError } from "@/lib/xdrReview";
import type { QuoteRequest } from "@/lib/types";

export type SwapSubmissionStatus =
  | "idle"
  | "connecting"
  | "building"
  | "reviewing"
  | "awaiting-signature"
  | "submitting"
  | "success"
  | "error";

const PENDING_STATUSES: SwapSubmissionStatus[] = [
  "connecting",
  "building",
  "reviewing",
  "awaiting-signature",
  "submitting",
];

export function useSwapSubmission() {
  const [status, setStatus] = useState<SwapSubmissionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);

  const submit = useCallback(async (params: QuoteRequest) => {
    if (PENDING_STATUSES.includes(status)) {
      return;
    }

    setError(null);
    setIntentId(null);

    try {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        setStatus("connecting");
        await wallet.connect();
        wallet = useWalletStore.getState();
        if (!wallet.isConnected || !wallet.address) {
          throw new Error(wallet.error ?? "Connect a wallet to submit a swap.");
        }
      }

      setStatus("building");
      const { intentId: newIntentId, unsignedXdr } = await createIntent({
        ...params,
        dstAddress: wallet.address,
      });
      setIntentId(newIntentId);

      // ── #244: XDR review step ──────────────────────────────────────────────
      // Decode the XDR the relay returned before handing it to Freighter.
      // A decode failure or a mismatch against the user's submitted params is
      // a hard stop — we never fall back to signing an unvalidated XDR.
      setStatus("reviewing");
      const decoded = decodeXdr(unsignedXdr, wallet.network);
      validateSwapXdr(decoded, {
        srcAmount: params.srcAmount,
        dstAddress: wallet.address,
      });
      // ──────────────────────────────────────────────────────────────────────

      setStatus("awaiting-signature");
      const signedXdr = await walletAdapter.signTransaction(unsignedXdr, {
        network: wallet.network ?? undefined,
      });

      setStatus("submitting");
      await submitIntent(newIntentId, signedXdr);

      setStatus("success");
      useToastStore.getState().addToast("Swap submitted successfully.", "success");
    } catch (err) {
      const message =
        err instanceof XdrMismatchError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to submit swap.";
      setStatus("error");
      setError(message);
      useToastStore.getState().addToast(message, "error");
    }
  }, [status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setIntentId(null);
  }, []);

  return { status, error, intentId, submit, reset };
}
