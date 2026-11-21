import type { ExportRequest, ExportResponse } from "./protocol";
import { serializeParts } from "./serialize";

const yieldToLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Worker-side message handler, kept free of worker globals so it can be unit
 * tested directly and reused as the main-thread fallback. Yields between
 * chunks so cancel messages are processed mid-export.
 *
 * On failure the buffered parts are discarded and a single terminal `error`
 * message is posted, so callers never receive partial output.
 */
export async function handleExportMessage(
  msg: ExportRequest,
  cancelled: Set<string>,
  post: (response: ExportResponse) => void,
): Promise<void> {
  if (msg.type === "cancel") {
    cancelled.add(msg.jobId);
    return;
  }
  const { jobId, items, options } = msg;
  let parts: string[] = [];
  try {
    for (const { part, done } of serializeParts(items, options)) {
      if (cancelled.has(jobId)) {
        cancelled.delete(jobId);
        parts = [];
        post({ type: "cancelled", jobId });
        return;
      }
      parts.push(part);
      post({ type: "progress", jobId, done, total: items.length });
      await yieldToLoop();
    }
    post({ type: "complete", jobId, parts });
  } catch (e) {
    // Drop everything buffered so a partial export can never be handed back.
    parts = [];
    post({ type: "error", jobId, message: e instanceof Error ? e.message : "Export failed" });
  }
}
