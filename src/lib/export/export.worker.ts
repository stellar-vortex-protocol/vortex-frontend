/// <reference lib="webworker" />
import type { ExportRequest, ExportResponse } from "./protocol";
import { handleExportMessage } from "./runner";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<string>();

ctx.onmessage = (event: MessageEvent<ExportRequest>) => {
  void handleExportMessage(event.data, cancelled, (msg: ExportResponse) => {
    ctx.postMessage(msg);
    // Terminal messages are posted before the worker shuts down, so a failure
    // can never leave the main thread waiting on a promise that never settles.
    if (msg.type !== "progress") ctx.close();
  });
};
