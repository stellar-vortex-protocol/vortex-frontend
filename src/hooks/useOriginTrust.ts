"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { evaluateOrigin, getTrustedOrigins } from "@/lib/config";
import type { TrustLevel } from "@/lib/config";

export interface OriginTrustResult {
  trustLevel: TrustLevel;
  hostname: string;
  isFramed: boolean;
}

/**
 * Evaluates the current origin's trust level on mount and after
 * every navigation (via `usePathname` as a navigation signal).
 *
 * Returns `trusted | untrusted | unknown` and the current hostname
 * so that UI can display it for user comparison with bookmarks.
 */
export function useOriginTrust(): OriginTrustResult {
  const pathname = usePathname();
  const [result, setResult] = useState<OriginTrustResult>({
    trustLevel: "unknown",
    hostname: "",
    isFramed: false,
  });

  useEffect(() => {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol.replace(":", "");
    const trusted = getTrustedOrigins();
    const trustLevel = evaluateOrigin(hostname, protocol, trusted);
    const isFramed =
      typeof window.top !== "undefined" && window.top !== window.self;

    setResult({ trustLevel, hostname, isFramed });
  }, [pathname]);

  return result;
}
