import type { FeedItem } from "@/lib/types";
import type { ExportRequest, ExportResponse } from "./protocol";
import { handleExportMessage } from "./runner";
import type { ExportOptions } from "./serialize";

export type ExportJob = { promise: Promise<Blob | null>; cancel: () => void };

type WorkerLike = {
  postMessage: (msg: ExportRequest) => void;
  terminate: () => void;
  onmessage: ((e: MessageEvent<ExportResponse>) => void) | null;
  onerror?: ((e: ErrorEvent) => void) | null;
  onmessageerror?: ((e: MessageEvent) => void) | null;
};

function createWorker(): WorkerLike | null {
  try {
    return new Worker(new URL("./export.worker.ts", import.meta.url), { type: "module" }) as unknown as WorkerLike;
  } catch {
    // Workers unavailable (old Safari, blocked by CSP) - fall back in-thread.
    return null;
  }
}

/**
 * Runs an export in a Web Worker, resolving with a Blob built from string
 * parts (never one giant string), or `null` if cancelled.
 */
export function startExport(
  items: FeedItem[],
  options: ExportOptions,
  onProgress: (done: number, total: number) => void,
  workerFactory: () => WorkerLike | null = createWorker,
): ExportJob {
  const jobId = crypto.randomUUID();
  const worker = workerFactory();
  const cancelledLocal = new Set<string>();
  let settle: (blob: Blob | null) => void = () => undefined;
  let fail: (err: Error) => void = () => undefined;

  const promise = new Promise<Blob | null>((resolve, reject) => {
    settle = resolve;
    fail = reject;
  });

  const type = options.format === "csv" ? "text/csv;charset=utf-8" : "application/json";
  let settled = false;
  const onMessage = (msg: ExportResponse) => {
    if (msg.jobId !== jobId || settled) return;
    if (msg.type === "progress") onProgress(msg.done, msg.total);
    else if (msg.type === "complete") {
      settled = true;
      settle(new Blob(msg.parts, { type }));
    } else if (msg.type === "cancelled") {
      settled = true;
      settle(null);
    } else {
      settled = true;
      fail(new Error(msg.message));
    }
    if (msg.type !== "progress") worker?.terminate();
  };

  // A worker-level failure (uncaught throw, failed import, OOM) never posts a
  // protocol message, so reject here rather than leaving the promise pending
  // or resolving partial output as success.
  const onWorkerError = (event: ErrorEvent | MessageEvent) => {
    if (settled) return;
    settled = true;
    const message = "message" in event && typeof event.message === "string" && event.message ? event.message : "Export worker failed";
    fail(new Error(message));
    worker?.terminate();
  };

  if (worker) {
    worker.onmessage = (e) => onMessage(e.data);
    worker.onerror = onWorkerError;
    worker.onmessageerror = onWorkerError;
    worker.postMessage({ type: "start", jobId, items, options });
  } else {
    void handleExportMessage({ type: "start", jobId, items, options }, cancelledLocal, onMessage).catch((e: unknown) => {
      if (settled) return;
      settled = true;
      fail(e instanceof Error ? e : new Error("Export failed"));
    });
  }

  return {
    promise,
    cancel: () => {
      if (settled) return;
      settled = true;
      if (worker) {
        worker.terminate();
        settle(null);
      } else {
        cancelledLocal.add(jobId);
      }
    },
  };
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoke after the click has been dispatched so Safari can start the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
