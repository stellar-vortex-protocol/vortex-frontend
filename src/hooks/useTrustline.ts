"use client";

import { useCallback, useEffect, useState } from "react";
import type { Token } from "@/lib/types";
import { checkTrustline, type TrustlineLookup } from "@/lib/chain/trustline";

export type TrustlineStatus = TrustlineLookup["status"] | "unknown";

export function useTrustline(address: string | null, asset: Token | null) {
  const [state, setState] = useState<TrustlineStatus>("unknown");
  const [balance, setBalance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    if (!address || !asset) { setState("present"); setBalance(null); setError(null); return; }
    setChecking(true);
    const result = await checkTrustline(address, asset);
    setState(result.status);
    setBalance(result.status === "present" ? result.balance : null);
    setError(result.status === "error" ? result.message : null);
    setChecking(false);
  }, [address, asset]);
  useEffect(() => { void check(); }, [check]);
  // Keep polling while the trustline is missing (waiting for it) or present (tracking the live balance).
  // A failed lookup is not polled: the UI offers an explicit retry instead.
  useEffect(() => { if (state === "unknown" || state === "error") return; const timer = window.setInterval(check, 4_000); return () => window.clearInterval(timer); }, [check, state]);
  return { state, balance, error, checking, refresh: check };
}
