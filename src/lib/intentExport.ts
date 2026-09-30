import { sanitizeDisplayText } from "@/lib/textSafety";
import type { IntentDetail } from "@/lib/types";

/** Clipboard exports for the intent detail page (#443). */

// Signed/unsigned transaction envelopes must never end up in a support paste.
const REDACTED_KEY_RE = /xdr|signature|secret/i;

/** Deep copy with XDR/signature-like keys removed and strings made display-safe. */
export function redactForExport(value: unknown): unknown {
  if (typeof value === "string") return sanitizeDisplayText(value);
  if (Array.isArray(value)) return value.map(redactForExport);
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !REDACTED_KEY_RE.test(key))
        .map(([key, v]) => [key, redactForExport(v)]),
    );
  }
  return value;
}

export function intentToJson(intent: IntentDetail): string {
  return JSON.stringify(redactForExport(intent), null, 2);
}

/** Human-readable, redacted summary for pasting into a support thread. */
export function buildIntentSummary(intent: IntentDetail): string {
  const safe = redactForExport(intent) as IntentDetail;
  const lines: Array<[string, string | undefined]> = [
    ["Intent", safe.id],
    ["Status", safe.status],
    ["Swap", `${safe.srcAmount} ${safe.srcToken} (${safe.srcChain}) -> ${safe.dstAmount} ${safe.dstToken}`],
    ["Minimum out", `${safe.minOut} ${safe.dstToken}`],
    ["Solver", safe.solver],
    ["Destination", safe.dstAddress],
    ["Created", safe.createdAt],
    ["Accepted", safe.acceptedAt],
    ["Submitted", safe.submittedAt],
    ["Filled", safe.filledAt],
    ["Failed", safe.failedAt],
    ["Deadline", safe.deadline],
    ["Settlement tx", safe.txHash],
  ];
  return lines
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}
