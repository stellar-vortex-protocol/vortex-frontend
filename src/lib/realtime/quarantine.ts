import { validateFeedItemFrame, type FrameRejection } from "@/lib/schemas";
import { secureLogger, truncateString } from "@/lib/secureLogging";
import type { FeedItem } from "@/lib/types";

export type QuarantinedFrame = { at: number; reason: FrameRejection; preview: string };

const QUARANTINE_SIZE = 20;
const WARN_INTERVAL_MS = 30_000;

let invalidCount = 0;
let lastWarnAt = 0;
const recent: QuarantinedFrame[] = [];

/**
 * `parse` option for useWebSocket: returns a validated FeedItem or null.
 * Rejected frames are counted and the last N kept (truncated preview) for
 * dev-only diagnostics; `unknown-type` frames are ignored silently. Warnings
 * go to the developer console only (rate-limited), never to end users.
 */
export function parseFeedItemFrame(raw: unknown): FeedItem | null {
  const result = validateFeedItemFrame(raw);
  if (result.ok) return result.item;
  if (result.reason === "unknown-type") return null;

  invalidCount += 1;
  recent.push({
    at: Date.now(),
    reason: result.reason,
    preview: typeof raw === "string" ? truncateString(raw, 120) : "",
  });
  if (recent.length > QUARANTINE_SIZE) recent.shift();

  const now = Date.now();
  if (process.env.NODE_ENV !== "production" && now - lastWarnAt > WARN_INTERVAL_MS) {
    lastWarnAt = now;
    secureLogger.warn("Quarantined invalid WebSocket frame", { reason: result.reason, invalidCount });
  }
  return null;
}

export function getQuarantineDiagnostics() {
  return { invalidCount, recent: [...recent] };
}

export function resetQuarantine() {
  invalidCount = 0;
  lastWarnAt = 0;
  recent.length = 0;
}
