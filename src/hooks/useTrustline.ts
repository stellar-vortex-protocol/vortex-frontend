"use client";

import { useCallback, useEffect, useState } from "react";
import type { Token } from "@/lib/types";
import { getTrustline, type TrustlineState } from "@/lib/chain/horizon";

export function useTrustline(address: string | null, asset: Token | null) {
  const [state, setState] = useState<TrustlineState>("unknown");
  const [checking, setChecking] = useState(false);
  const check = useCallback(async () => {
    if (!address || !asset || asset.symbol === "XLM" || asset.contract === "native") { setState("exists"); return; }
    setChecking(true); setState(await getTrustline(address, asset)); setChecking(false);
  }, [address, asset]);
  useEffect(() => { void check(); }, [check]);
  useEffect(() => { if (state !== "missing") return; const timer = window.setInterval(check, 4_000); return () => window.clearInterval(timer); }, [check, state]);
  return { state, checking, refresh: check };
}
