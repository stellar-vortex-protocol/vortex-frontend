"use client";

import { useMemo, type ReactNode } from "react";
import { SWRConfig, type Middleware } from "swr";
import { useConnectivity } from "@/hooks/useConnectivity";
import { baseSWRConfig, logFetch } from "@/lib/swrPolicy";

// Dev-only middleware that counts fetcher invocations per key.
const fetchLogger: Middleware = (next) => (key, fetcher, config) =>
  next(
    key,
    fetcher &&
      ((...args: Parameters<typeof fetcher>) => {
        logFetch(key);
        return fetcher(...args);
      }),
    config,
  );

/**
 * Global SWR policy: retry/backoff, offline pausing and revalidation defaults.
 * Hooks may still override individual options — see docs/data-fetching.md.
 */
export function AppSWRProvider({ children }: { children: ReactNode }) {
  const { connectivity } = useConnectivity();
  const value = useMemo(
    () => ({
      ...baseSWRConfig,
      isPaused: () => connectivity === "offline",
      use: process.env["NODE_ENV"] === "production" ? [] : [fetchLogger],
    }),
    [connectivity],
  );
  return <SWRConfig value={value}>{children}</SWRConfig>;
}
