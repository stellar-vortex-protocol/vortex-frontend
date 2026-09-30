import type { FeedItem } from "@/lib/types";
import type { ExportRequest, ExportResponse } from "./protocol";
import { handleExportMessage } from "./runner";
import type { ExportOptions } from "./serialize";

export type ExportJob = { promise: Promise<Blob | null>; cancel: () => void };

type WorkerLike = {
  postMessage: (msg: ExportRequest) => void;
  terminate: () => void;
  onmessage: ((e: MessageEvent<ExportResponse>) => void) | null;
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
  const onMessage = (msg: ExportResponse) => {
    if (msg.jobId !== jobId) return;
    if (msg.type === "progress") onProgress(msg.done, msg.total);
    else if (msg.type === "complete") settle(new Blob(msg.parts, { type }));
    else if (msg.type === "cancelled") settle(null);
    else fail(new Error(msg.message));
    if (msg.type !== "progress") worker?.terminate();
  };

  if (worker) {
    worker.onmessage = (e) => onMessage(e.data);
    worker.postMessage({ type: "start", jobId, items, options });
  } else {
    void handleExportMessage({ type: "start", jobId, items, options }, cancelledLocal, onMessage);
  }

  return {
    promise,
    cancel: () => {
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
