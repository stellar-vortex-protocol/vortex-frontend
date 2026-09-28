import { en } from "@/lib/i18n/messages/en";
import type { MessageKey } from "@/lib/i18n";
import type { FlowErrorKind } from "./machine";

// Duck-typed on `name`/`status` rather than `instanceof` so this module does
// not import `@/lib/api` (keeps effects injectable and hook tests mockable).
function hasStatus(err: unknown): err is Error & { status: number } {
  return err instanceof Error && typeof (err as { status?: unknown }).status === "number";
}

export function isAbortError(err: unknown): boolean {
  // DOMException is not an Error subclass in every runtime, so check the name.
  return typeof err === "object" && err !== null && (err as { name?: unknown }).name === "AbortError";
}

/**
 * Shared error classification for every transaction flow. The raw message is
 * always kept alongside the kind by the caller so no backend detail is lost.
 */
export function classifyFlowError(err: unknown): FlowErrorKind {
  if (!(err instanceof Error)) return "generic";
  if (err.name === "TimeoutError") return "network";
  if (err.name === "XdrMismatchError" || err.name === "ValidationError") return "validation";

  const body = err.message.toLowerCase();

  if (hasStatus(err)) {
    if (err.status === 409 || body.includes("no solver") || body.includes("no_solver")) {
      return "no-solver";
    }
    if (
      (err.status === 400 || err.status === 422) &&
      (body.includes("balance") || body.includes("insufficient") || body.includes("funds"))
    ) {
      return "balance";
    }
    return "generic";
  }

  if (
    body.includes("denied") ||
    body.includes("rejected") ||
    body.includes("declined") ||
    body.includes("cancelled") ||
    body.includes("canceled")
  ) {
    return "user-rejected";
  }
  if (body.includes("network") || body.includes("timeout") || body.includes("failed to fetch")) {
    return "network";
  }
  return "generic";
}

/** i18n keys for one-line actionable guidance; `generic` has none. */
export const FLOW_ERROR_GUIDANCE_KEY: Record<FlowErrorKind, MessageKey | null> = {
  network: "flow.error.network",
  "user-rejected": "flow.error.userRejected",
  balance: "flow.error.balance",
  "no-solver": "flow.error.noSolver",
  validation: "flow.error.validation",
  generic: null,
};

/** English guidance strings, for call sites that are not yet translated. */
export const FLOW_ERROR_GUIDANCE: Record<FlowErrorKind, string> = Object.fromEntries(
  Object.entries(FLOW_ERROR_GUIDANCE_KEY).map(([kind, key]) => [kind, key ? en[key] : ""]),
) as Record<FlowErrorKind, string>;
