import type { FeedItem } from "@/lib/types";
import type { ExportOptions } from "./serialize";

/** Main thread → worker. */
export type ExportRequest =
  | { type: "start"; jobId: string; items: FeedItem[]; options: ExportOptions }
  | { type: "cancel"; jobId: string };

/** Worker → main thread. */
export type ExportResponse =
  | { type: "progress"; jobId: string; done: number; total: number }
  | { type: "complete"; jobId: string; parts: string[] }
  | { type: "cancelled"; jobId: string }
  | { type: "error"; jobId: string; message: string };
