"use client";

import { useGlobalErrorCapture } from "@/hooks/useGlobalErrorCapture";

/**
 * GlobalErrorCapture
 *
 * A renderless client component that mounts the global error and
 * unhandledrejection listeners for the lifetime of the application.
 *
 * Place it once, high in the tree (e.g. inside RootLayout), so that it is
 * always mounted regardless of which route is active.
 */
export function GlobalErrorCapture(): null {
  useGlobalErrorCapture();
  return null;
}
