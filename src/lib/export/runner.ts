import type { ExportRequest, ExportResponse } from "./protocol";
import { serializeParts } from "./serialize";

const yieldToLoop = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Minimal worker surface the runner needs; kept structural so tests can stub it. */
export type ExportWorkerLike = {
  postMessage: (msg: ExportRequest) => void;
  terminate: () => void;
  onmessage: ((e: MessageEvent<ExportResponse>) => void) | null;
};

export type ExportWorkerFactory = () => ExportWorkerLike | null;

function createExportWorker(): ExportWorkerLike | null {
  try {
    return new Worker(new URL("./export.worker.ts", import.meta.url), { type: "module" }) as unknown as ExportWorkerLike;
  } catch {
    // Workers unavailable (old Safari, blocked by CSP) - fall back in-thread.
    return null;
  }
}

let worker: ExportWorkerLike | null = null;
let workerCreated = false;

/**
 * Returns the shared export worker, constructing it on first use only. The
 * worker is created once and reused for subsequent exports.
 */
export function getExportWorker(factory: ExportWorkerFactory = createExportWorker): ExportWorkerLike | null {
  if (!workerCreated) {
    workerCreated = true;
    worker = factory();
  }
  return worker;
}

/** Test-only hook to reset the lazily created worker. */
export function resetExportWorker(): void {
  worker?.terminate();
  worker = null;
  workerCreated = false;
}

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

export type ExportJob = { promise: Promise<Blob | null>; cancel: () => void };

/**
 * Runs an export in a Web Worker, resolving with a Blob built from string
 * parts (never one giant string), or `null` if cancelled. The worker is
 * created lazily on the first export request and reused afterwards.
 */
export function startExport(
  items: FeedItem[],
  options: ExportOptions,
  onProgress: (done: number, total: number) => void,
  workerFactory: ExportWorkerFactory = createExportWorker,
): ExportJob {
  const jobId = crypto.randomUUID();
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
  };

  // Created before the first chunk is posted, and only on the first export.
  const worker = getExportWorker(workerFactory);

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
