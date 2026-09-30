/// <reference lib="webworker" />
import type { ExportRequest, ExportResponse } from "./protocol";
import { handleExportMessage } from "./runner";

const ctx = self as unknown as DedicatedWorkerGlobalScope;
const cancelled = new Set<string>();

ctx.onmessage = (event: MessageEvent<ExportRequest>) => {
  void handleExportMessage(event.data, cancelled, (msg: ExportResponse) => ctx.postMessage(msg));
};
