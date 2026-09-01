/**
 * useGlobalErrorCapture
 *
 * Attaches window-level listeners for two browser error channels that React
 * does NOT intercept automatically:
 *
 * - "error"              — synchronous errors thrown in event handlers,
 *                          setTimeout/setInterval callbacks, and any context
 *                          outside React's render cycle.
 * - "unhandledrejection" — Promises that are rejected without a .catch() or
 *                          try/catch — common in fire-and-forget async calls.
 *
 * Both are forwarded to the shared toast store as "error" notifications and
 * also logged via console.error so they still appear in DevTools.
 *
 * The hook is intentionally side-effect-only (no return value) and is safe
 * to call at the top of the component tree (e.g. RootLayout's client shell).
 */
"use client";

import { useEffect } from "react";
import { useToastStore } from "@/store/toast";

/** Maximum characters shown in the toast for an error message. */
const MAX_MSG_LENGTH = 120;

function truncate(msg: string): string {
  return msg.length <= MAX_MSG_LENGTH ? msg : `${msg.slice(0, MAX_MSG_LENGTH)}…`;
}

function extractMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.toString();
  if (typeof err === "string" && err.trim()) return err;
  return "An unexpected error occurred.";
}

export function useGlobalErrorCapture(): void {
  useEffect(() => {
    const handleError = (event: ErrorEvent): void => {
      const message = extractMessage(event.error ?? event.message);
      console.error("[GlobalErrorCapture] Uncaught error:", event.error ?? event.message);
      useToastStore.getState().addToast(truncate(message), "error");
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
      const message = extractMessage(event.reason);
      console.error("[GlobalErrorCapture] Unhandled rejection:", event.reason);
      useToastStore.getState().addToast(truncate(message), "error");
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);
}
