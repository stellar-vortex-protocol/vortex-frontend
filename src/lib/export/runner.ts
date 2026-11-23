import type { ExportRequest, ExportResponse } from "./protocol";
import { serializeParts } from "./serialize";
import { scheduleExportReminder, type ReminderCancel } from "./reminder";

const yieldToLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

const REMINDER_DELAY_MS = 30_000;

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
  const cancelReminder: ReminderCancel = scheduleExportReminder(jobId, REMINDER_DELAY_MS, (id) => {
    post({ type: "progress", jobId: id, done: 0, total: items.length });
  });
  try {
    for (const { part, done } of serializeParts(items, options)) {
      if (cancelled.has(jobId)) {
        cancelled.delete(jobId);
        cancelReminder();
        post({ type: "cancelled", jobId });
        return;
      }
      parts.push(part);
      post({ type: "progress", jobId, done, total: items.length });
      await yieldToLoop();
    }
    cancelReminder();
    post({ type: "complete", jobId, parts });
  } catch (e) {
    cancelReminder();
    post({ type: "error", jobId, message: e instanceof Error ? e.message : "Export failed" });
  }
}
