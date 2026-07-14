import { useCallback, useState } from "react";
import { mutate } from "swr";
import freighterApi from "@stellar/freighter-api";
import { registerSolver, submitSolverRegistration } from "@/lib/api";
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

export function useSolverRegistration() {
  const [status, setStatus] = useState<SolverRegistrationStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (address: string, bondUsd: number) => {
    setError(null);

    try {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        setStatus("connecting");
        await wallet.connect();
        wallet = useWalletStore.getState();
        if (!wallet.isConnected || !wallet.address) {
          throw new Error(wallet.error ?? "Connect a wallet to register as a solver.");
        }
      }

      setStatus("building");
      const { registrationId, unsignedXdr } = await registerSolver({ address, bondUsd });

      setStatus("awaiting-signature");
      const signedXdr = await freighterApi.signTransaction(unsignedXdr, {
        network: wallet.network ?? undefined,
      });

      setStatus("submitting");
      await submitSolverRegistration(registrationId, signedXdr);
      await mutate("/solvers");

      setStatus("success");
      useToastStore.getState().addToast("Registered as a solver.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to register as a solver.";
      setStatus("error");
      setError(message);
      useToastStore.getState().addToast(message, "error");
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
  }, []);

  return { status, error, register, reset };
}
