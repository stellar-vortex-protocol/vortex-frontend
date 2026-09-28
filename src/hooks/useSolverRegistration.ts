import { useCallback } from "react";
import { mutate } from "swr";
import { walletAdapter } from "@/lib/wallet";
import { registerSolver, submitSolverRegistration } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { verifySignedXdrMatches } from "@/lib/xdrReview";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { decodeXdr, validateRegistrationXdr, XdrMismatchError } from "@/lib/xdrReview";
import { classifyFlowError, useTransactionFlow, type FlowErrorKind, type FlowStatus } from "@/lib/flow";

export type SolverRegistrationStatus = FlowStatus;

function RegistrationErrorMessage(err: unknown): string {
  if (err instanceof XdrMismatchError) {
    return err.message;
  }
  if (err instanceof ApiError) {
    if (err.status === 409) {
      return "This address is already registered as a solver.";
    }
    if (err.status === 400 || err.status === 422) {
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

// A 409 here means "already registered", not "no solver available".
function classifyRegistrationError(err: unknown): FlowErrorKind {
  if (err instanceof ApiError && err.status === 409) return "validation";
  return classifyFlowError(err);
}

type RegistrationParams = { address: string; bondUsd: number };

export function useSolverRegistration() {
  const flow = useTransactionFlow<RegistrationParams, void>({
    getErrorMessage: RegistrationErrorMessage,
    classifyError: classifyRegistrationError,
    run: async ({ address, bondUsd }, { step }) => {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        wallet = await step("connecting", async () => {
          await useWalletStore.getState().connect();
          const next = useWalletStore.getState();
          if (!next.isConnected || !next.address) {
            throw new Error(next.error ?? "Connect a wallet to register as a solver.");
          }
          return next;
        });
      }

      const { registrationId, unsignedXdr } = await step("building", (signal) =>
        registerSolver({ address, bondUsd }, signal),
      );

      // #244: decode and validate the bond-deposit XDR before presenting it to
      // Freighter. A decode failure or address mismatch is a hard stop.
      await step("reviewing", () => {
        const decoded = decodeXdr(unsignedXdr, wallet.network);
        validateRegistrationXdr(decoded, { bondUsd, solverAddress: address });
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

      await step("submitting", async (signal) => {
        await submitSolverRegistration(registrationId, signedXdr, signal);
        await mutate("/solvers");
      });
    },
    onSuccess: () => {
      useToastStore.getState().addToast("Registered as a solver.", "success");
    },
    onError: (message) => {
      useToastStore.getState().addToast(message, "error");
    },
  });

  const { start } = flow;
  const register = useCallback(
    async (address: string, bondUsd: number) => {
      await start({ address, bondUsd });
    },
    [start],
  );

  return {
    status: flow.status,
    error: flow.error,
    errorKind: flow.errorKind,
    errorStep: flow.errorStep,
    register,
    reset: flow.reset,
    cancel: flow.cancel,
  };
}
