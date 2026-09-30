import { useCallback, useRef, useState } from "react";
import { walletAdapter } from "@/lib/wallet";
import { createIntent, submitIntent } from "@/lib/api";
import { verifySignedXdrMatches } from "@/lib/xdrReview";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { useIntentStore } from "@/store/intents";
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

/** How long an optimistic entry waits for the relay before being flagged. */
export const OPTIMISTIC_CONFIRM_TIMEOUT_MS = 60_000;

export function useSwapSubmission({
  confirmTimeoutMs = OPTIMISTIC_CONFIRM_TIMEOUT_MS,
}: { confirmTimeoutMs?: number } = {}) {
  const [status, setStatus] = useState<SwapSubmissionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<SwapErrorKind | null>(null);
  const [intentId, setIntentId] = useState<string | null>(null);
  const stepRef = useRef<SwapSubmissionStatus>("idle");

  const advance = useCallback((next: SwapSubmissionStatus) => {
    stepRef.current = next;
    setStatus(next);
  }, []);

  const submit = useCallback(async (params: QuoteRequest) => {
    if (PENDING_STATUSES.includes(status)) {
      return;
    }

    setError(null);
    setErrorKind(null);
    setIntentId(null);
    let optimisticId: string | null = null;

    try {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        advance("connecting");
        await wallet.connect();
        wallet = useWalletStore.getState();
        if (!wallet.isConnected || !wallet.address) {
          throw new Error(wallet.error ?? "Connect a wallet to submit a swap.");
        }
      }

      advance("building");
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

      // Defense-in-depth: verify signed XDR matches unsigned (Issue #308)
      const xdrVerification = verifySignedXdrMatches(unsignedXdr, signedXdr);
      if (!xdrVerification.valid) {
        throw new Error(xdrVerification.error ?? "Transaction verification failed. The signed transaction does not match what was reviewed.");
      }

      setStatus("submitting");
      // Optimistic entry keyed by the relay's intentId, replaced in place by
      // the authoritative REST/WS record when it arrives (#435).
      const intents = useIntentStore.getState();
      intents.ingest(
        [
          {
            id: newIntentId,
            srcChain: params.srcChain,
            srcToken: params.srcToken,
            srcAmount: params.srcAmount,
            dstToken: params.dstToken,
            solver: "",
            status: "pending",
            createdAt: new Date().toISOString(),
            optimistic: true,
          },
        ],
        "optimistic",
      );
      optimisticId = newIntentId;
      const submitted = await submitIntent(newIntentId, signedXdr);
      if (submitted?.intentId && submitted.intentId !== newIntentId) {
        // Server assigned a different id: re-key the optimistic entry.
        const entry = useIntentStore.getState().byId[newIntentId];
        intents.remove(newIntentId);
        if (entry) intents.ingest([{ ...entry, id: submitted.intentId }], "optimistic");
        optimisticId = submitted.intentId;
      }
      const confirmId = optimisticId;
      setTimeout(() => useIntentStore.getState().markUnconfirmed(confirmId), confirmTimeoutMs);
      optimisticId = null;

      advance("success");
      useToastStore.getState().addToast("Swap submitted successfully.", "success");
    } catch (err) {
      const message =
        err instanceof XdrMismatchError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to submit swap.";
      if (optimisticId) useIntentStore.getState().remove(optimisticId);
      setStatus("error");
      setError(message);
      setErrorKind(classifySwapError(err));
      useToastStore.getState().addToast(message, "error");
    }
  }, [status, confirmTimeoutMs]);

  const reset = useCallback(() => {
    stepRef.current = "idle";
    setStatus("idle");
    setError(null);
    setErrorKind(null);
    setIntentId(null);
  }, []);

  return { status, error, errorKind, intentId, submit, reset };
}
