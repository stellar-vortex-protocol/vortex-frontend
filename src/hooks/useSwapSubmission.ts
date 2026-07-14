import { useCallback, useState } from "react";
import freighterApi from "@stellar/freighter-api";
import { createIntent, submitIntent } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import type { QuoteRequest } from "@/lib/types";

export type SwapSubmissionStatus =
  | "idle"
  | "connecting"
  | "building"
  | "awaiting-signature"
  | "submitting"
  | "success"
  | "error";

export function useSwapSubmission() {
  const [status, setStatus] = useState<SwapSubmissionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);

  const submit = useCallback(async (params: QuoteRequest) => {
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

      setStatus("awaiting-signature");
      const signedXdr = await freighterApi.signTransaction(unsignedXdr, {
        network: wallet.network ?? undefined,
      });

      setStatus("submitting");
      await submitIntent(newIntentId, signedXdr);

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to submit swap.");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setIntentId(null);
  }, []);

  return { status, error, intentId, submit, reset };
}
