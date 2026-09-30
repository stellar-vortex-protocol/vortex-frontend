"use client";

import { useEffect } from "react";
import { useGlobalErrorCapture } from "@/hooks/useGlobalErrorCapture";
import { reportVital } from "@/lib/telemetry";

/**
 * GlobalErrorCapture
 *
 * A renderless client component that mounts the global error and
 * unhandledrejection listeners for the lifetime of the application, and
 * wires up privacy-preserving Core Web Vitals reporting.
 *
 * Place it once, high in the tree (e.g. inside RootLayout), so that it is
 * always mounted regardless of which route is active.
 */
export function GlobalErrorCapture(): null {
  useGlobalErrorCapture();

  useEffect(() => {
    // reportVital() is a no-op unless the user has explicitly opted in and
    // Do Not Track / GPC is not asserted. It never blocks navigation.
    reportVital();
  }, []);

  return null;
}
