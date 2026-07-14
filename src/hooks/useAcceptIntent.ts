import { useCallback, useState } from "react";
import { mutate } from "swr";
import { acceptIntent } from "@/lib/api";
import { useWalletStore } from "@/store/wallet";
import { useToastStore } from "@/store/toast";

export function useAcceptIntent() {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = useCallback(async (intentId: string) => {
    setError(null);
    setAcceptingId(intentId);

    try {
      let wallet = useWalletStore.getState();
      if (!wallet.isConnected || !wallet.address) {
        await wallet.connect();
        wallet = useWalletStore.getState();
        if (!wallet.isConnected || !wallet.address) {
          throw new Error(wallet.error ?? "Connect a wallet to accept an intent.");
        }
      }

      await acceptIntent(intentId, wallet.address);
      await mutate("/intents/open");
      useToastStore.getState().addToast("Intent accepted — you have exclusive fill rights.", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to accept intent.";
      setError(message);
      useToastStore.getState().addToast(message, "error");
    } finally {
      setAcceptingId(null);
    }
  }, []);

  return { accept, acceptingId, error };
}
