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

// === Error classification (#301)
// Mirrors `useSolverRegistration`'s `RegistrationErrorMessage` - map known
// failure shapes to a category the UI can attach actionable guidance to. The
// raw `error` message is always kept alongside `errorKind` so no backend detail
// is thrown away.
export type SwapErrorKind =
  | "network"
  | "no-solver"
  | "balance"
  | "user-rejected"
  | "generic";

export function classifySwapError(err: unknown): SwapErrorKind {
  if (err instanceof TimeoutError) return "network";

  if (err instanceof ApiError) {
    const body = err.message.toLowerCase();
    if (err.status === 409 || body.includes("no solver") || body.includes("no_solver")) {
      return "no-solver";
    }
    if (
      (err.status === 400 || err.status === 422) &&
      (body.includes("balance") || body.includes("insufficient") || body.includes("funds"))
    ) {
      return "balance";
    }
    return "generic";
  }

  if (err instanceof Error) {
    const body = err.message.toLowerCase();
    if (
      body.includes("denied") ||
      body.includes("rejected") ||
      body.includes("declined") ||
      body.includes("cancelled") ||
      body.includes("canceled")
    ) {
      return "user-rejected";
    }
    if (body.includes("network") || body.includes("timeout") || body.includes("failed to fetch")) {
      return "network";
    }
  }

  return "generic";
}

/**
 * One-line actionable guidance per category. Empty for `generic` - that case
 * shows the raw message plus the expandable troubleshooting list in `SwapCard`.
 */
export const SWAP_ERROR_GUIDANCE: Record<SwapErrorKind, string> = {
  network: "The relay didn't respond in time. Check your connection and try again.",
  "no-solver": "No solver is available to fill this swap right now. Try a different amount or check back shortly.",
  balance: "The source-chain balance looks too low for this swap. Lower the amount or top up, then retry.",
  "user-rejected": "The signature was declined in Freighter. Approve the request to submit the swap.",
  generic: "",
};

export function useSwapSubmission() {
  const [status, setStatus] = useState<SwapSubmissionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<SwapErrorKind | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);

  const submit = useCallback(async (params: QuoteRequest) => {
    if (PENDING_STATUSES.includes(status)) {
      return;
    }

    setError(null);
    setErrorKind(null);
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
      setErrorKind(classifySwapError(err));
      useToastStore.getState().addToast(message, "error");
    }
  }, [status]);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setErrorKind(null);
    setIntentId(null);
  }, []);

  return { status, error, errorKind, intentId, submit, reset };
}
