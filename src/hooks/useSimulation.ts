import { useEffect, useState } from "react";
import { simulateTransaction, type SimulationResult } from "@/lib/soroban/rpc";
export function useSimulation(unsignedXdr: string | null) {
  const [data, setData] = useState<SimulationResult | null>(null); const [error, setError] = useState<Error | null>(null); const [loading, setLoading] = useState(false);
  useEffect(() => { if (!unsignedXdr) { setData(null); setError(null); return; } const controller = new AbortController(); setLoading(true); setData(null); void simulateTransaction(unsignedXdr, controller.signal).then(setData).catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason : new Error(String(reason))); }).finally(() => { if (!controller.signal.aborted) setLoading(false); }); return () => controller.abort(); }, [unsignedXdr]);
  return { data, error, loading, canSign: Boolean(data) && !error };
}
