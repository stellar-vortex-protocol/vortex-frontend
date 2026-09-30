import type { ExportRequest, ExportResponse } from "./protocol";
import { serializeParts } from "./serialize";

const yieldToLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Worker-side message handler, kept free of worker globals so it can be unit
 * tested directly and reused as the main-thread fallback. Yields between
 * chunks so cancel messages are processed mid-export.
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
  const parts: string[] = [];
  try {
    for (const { part, done } of serializeParts(items, options)) {
      if (cancelled.has(jobId)) {
        cancelled.delete(jobId);
        post({ type: "cancelled", jobId });
        return;
      }
      parts.push(part);
      post({ type: "progress", jobId, done, total: items.length });
      await yieldToLoop();
    }
    post({ type: "complete", jobId, parts });
  } catch (e) {
    post({ type: "error", jobId, message: e instanceof Error ? e.message : "Export failed" });
  }
}
