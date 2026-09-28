import { useCallback, useRef, useState } from "react";
import { mutate } from "swr";
import { walletAdapter } from "@/lib/wallet";
import { registerSolver, submitSolverRegistration } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { verifySignedXdrMatches } from "@/lib/xdrReview";
import { assertExpectedNetwork, useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { useCooldown } from "@/hooks/useCooldown";
import { decodeXdr, validateRegistrationXdr, XdrMismatchError } from "@/lib/xdrReview";

export type SolverRegistrationStatus =
  | "idle"
  | "connecting"
  | "building"
  | "reviewing"
  | "awaiting-signature"
  | "submitting"
  | "success"
  | "error";

function RegistrationErrorMessage(err: unknown): string {
  if (err instanceof XdrMismatchError) {
    return err.message;
  }
  if (err instanceof ApiError) {
    if (err.status === 409) {
      return "This address is already registered as a solver.";
    }
    if (err.status === 400) {
      const body = err.message.toLowerCase();
      if (body.includes("bond") || body.includes("insufficient")) {
        return "Insufficient bond amount. The bond must meet the minimum required.";
      }
    }
    if (err.status === 422) {
      const body = err.message.toLowerCase();
      if (body.includes("bond") || body.includes("insufficient")) {
        return "Insufficient bond amount. The bond must meet the minimum required.";
      }
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Failed to register as a solver.";
}

export function useSolverRegistration() {
  const [status, setStatus] = useState<SolverRegistrationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [errorStep, setErrorStep] = useState<SolverRegistrationStatus | null>(null);
  const stepRef = useRef<SolverRegistrationStatus>("idle");

  const advance = useCallback((next: SolverRegistrationStatus) => {
    stepRef.current = next;
    setStatus(next);
  }, []);

  const cooldown = useCooldown();

  const register = useCallback(async (address: string, bondUsd: number) => {
    // #249: throttle rapid retries after a failure (popup / relay spam).
    if (cooldown.isCoolingDown()) {
      useToastStore.getState().addToast("Please wait a moment before trying again.", "info");
      return;
    }
    setError(null);
    setErrorStep(null);

    try {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        advance("connecting");
        await wallet.connect();
        wallet = useWalletStore.getState();
        if (!wallet.isConnected || !wallet.address) {
          throw new Error(
            wallet.error ?? "Connect a wallet to register as a solver.",
          );
        }
      }

      advance("building");
      const { registrationId, unsignedXdr } = await registerSolver({ address, bondUsd });

      // ── #244: XDR review step ──────────────────────────────────────────────
      // Decode and validate the bond-deposit XDR before presenting it to
      // Freighter.  A decode failure or address mismatch is a hard stop.
      setStatus("reviewing");
      const decoded = decodeXdr(unsignedXdr, wallet.network);
      validateRegistrationXdr(decoded, { bondUsd, solverAddress: address });
      // ──────────────────────────────────────────────────────────────────────

      // #248: re-validate the network right before signing, independent of
      // the UI guard, and pass the validated name explicitly to Freighter.
      const network = assertExpectedNetwork(useWalletStore.getState().network);

      setStatus("awaiting-signature");
      const signedXdr = await walletAdapter.signTransaction(unsignedXdr, {
        network,
      });

      // Defense-in-depth: verify signed XDR matches unsigned (Issue #308)
      const xdrVerification = verifySignedXdrMatches(unsignedXdr, signedXdr);
      if (!xdrVerification.valid) {
        throw new Error(xdrVerification.error ?? "Transaction verification failed. The signed transaction does not match what was reviewed.");
      }

      setStatus("submitting");
      await submitSolverRegistration(registrationId, signedXdr);
      await mutate("/solvers");

      cooldown.reset();
      advance("success");
      useToastStore.getState().addToast("Registered as a solver.", "success");
    } catch (err) {
      cooldown.start();
      const message = RegistrationErrorMessage(err);
      setErrorStep(stepRef.current);
      advance("error");
      setError(message);
      useToastStore.getState().addToast(message, "error");
    }
  }, [advance, cooldown.isCoolingDown, cooldown.start, cooldown.reset]);

  const reset = useCallback(() => {
    stepRef.current = "idle";
    setStatus("idle");
    setError(null);
    setErrorStep(null);
  }, []);

  return {
    status,
    error,
    errorStep,
    register,
    reset,
    cooldownSeconds: cooldown.remainingSeconds,
  };
}
