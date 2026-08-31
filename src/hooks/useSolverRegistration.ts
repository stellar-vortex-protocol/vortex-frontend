import { useCallback, useRef, useState } from "react";
import { mutate } from "swr";
import freighterApi from "@stellar/freighter-api";
import { registerSolver, submitSolverRegistration } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";

export type SolverRegistrationStatus =
  | "idle"
  | "connecting"
  | "building"
  | "awaiting-signature"
  | "submitting"
  | "success"
  | "error";

function RegistrationErrorMessage(err: unknown): string {
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

  const register = useCallback(async (address: string, bondUsd: number) => {
    setError(null);
    setErrorStep(null);

    try {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        advance("connecting");
        await wallet.connect();
        wallet = useWalletStore.getState();
        if (!wallet.isConnected || !wallet.address) {
          throw new Error(wallet.error ?? "Connect a wallet to register as a solver.");
        }
      }

      advance("building");
      const { registrationId, unsignedXdr } = await registerSolver({ address, bondUsd });

      advance("awaiting-signature");
      const signedXdr = await freighterApi.signTransaction(unsignedXdr, {
        network: wallet.network ?? undefined,
      });

      advance("submitting");
      await submitSolverRegistration(registrationId, signedXdr);
      await mutate("/solvers");

      advance("success");
      useToastStore.getState().addToast("Registered as a solver.", "success");
    } catch (err) {
      const message = RegistrationErrorMessage(err);
      setErrorStep(stepRef.current);
      advance("error");
      setError(message);
      useToastStore.getState().addToast(message, "error");
    }
  }, [advance]);

  const reset = useCallback(() => {
    stepRef.current = "idle";
    setStatus("idle");
    setError(null);
    setErrorStep(null);
  }, []);

  return { status, error, errorStep, register, reset };
}
