import { useCallback, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { walletAdapter } from "@/lib/wallet";
import { decodeXdr, XdrMismatchError } from "@/lib/xdrReview";
import { getBondAdapter } from "@/lib/bond/adapter";
import { applyBondOperation } from "@/lib/bond/state";
import type { BondAdapter, BondOperationKind, BondState } from "@/lib/bond/types";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";
import { swrRetryConfig } from "@/hooks/useRetry";

export type BondFlowStatus = "idle" | "building" | "reviewing" | "awaiting-signature" | "submitting" | "success" | "error";

/**
 * Solver bond state plus top-up / withdrawal-request actions. Each action
 * runs build → review (decode XDR) → sign → submit, applying the expected
 * result optimistically and reconciling with the server's response.
 */
export function useBondManagement(address: string | null, adapter: BondAdapter = getBondAdapter()) {
  const key = address ? ["solver-bond", address] : null;
  const { data, error, isLoading, mutate } = useSWR<BondState>(
    key,
    () => adapter.getBond(address as string),
    // Poll so concurrent tabs and partial fills (locked amount changes) reconcile.
    { refreshInterval: 30_000, ...swrRetryConfig },
  );
  const [status, setStatus] = useState<BondFlowStatus>("idle");
  const [flowError, setFlowError] = useState<string | null>(null);
  const busy = useRef(false);

  const run = useCallback(
    async (kind: BondOperationKind, amount: string) => {
      if (!address || !data || busy.current) return false;
      busy.current = true;
      setFlowError(null);
      try {
        const wallet = useWalletStore.getState();
        if (wallet.address !== address) throw new Error("Connected wallet does not match this solver address.");
        if (wallet.networkMismatch) throw new Error("Switch Freighter to the expected network first.");

        setStatus("building");
        const { operationId, unsignedXdr } = await adapter.build(address, kind, amount);

        let signedXdr = "";
        if (adapter.requiresSignature) {
          setStatus("reviewing");
          const decoded = decodeXdr(unsignedXdr, wallet.network);
          if (decoded.operationCount === 0) {
            throw new XdrMismatchError("Bond transaction contains no operations — refusing to sign.");
          }
          setStatus("awaiting-signature");
          signedXdr = await walletAdapter.signTransaction(unsignedXdr, { network: wallet.network ?? undefined });
        }

        setStatus("submitting");
        await mutate(adapter.submit(address, operationId, signedXdr), {
          optimisticData: (current) => (current ? applyBondOperation(current, kind, amount) : data),
          rollbackOnError: true,
          populateCache: true,
          revalidate: true,
        });
        setStatus("success");
        useToastStore
          .getState()
          .addToast(kind === "top-up" ? "Bond topped up." : "Withdrawal requested.", "success");
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Bond operation failed.";
        setFlowError(message);
        setStatus("error");
        useToastStore.getState().addToast(message, "error");
        return false;
      } finally {
        busy.current = false;
      }
    },
    [adapter, address, data, mutate],
  );

  return useMemo(
    () => ({
      bond: data ?? null,
      isLoading,
      loadError: error as Error | undefined,
      status,
      error: flowError,
      topUp: (amount: string) => run("top-up", amount),
      requestWithdrawal: (amount: string) => run("withdrawal", amount),
    }),
    [data, error, flowError, isLoading, run, status],
  );
}
