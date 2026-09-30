import { CSV_HEADERS, escapeCsv } from "@/lib/csv";
import type { FeedItem } from "@/lib/types";

export const EXPORT_SCHEMA_VERSION = 1;
export const EXPORT_CHUNK_SIZE = 500;
/** UTF-8 byte-order mark so Excel detects the encoding of CSV exports. */
export const UTF8_BOM = "﻿";

export type ExportFormat = "csv" | "json";
export type ExportColumn = (typeof CSV_HEADERS)[number];
export const EXPORT_COLUMNS: readonly ExportColumn[] = CSV_HEADERS;

export type ExportMeta = { network: string; generatedAt: string };

export type ExportOptions = {
  format: ExportFormat;
  columns: readonly ExportColumn[];
  meta: ExportMeta;
};

/** Only whitelisted, public FeedItem fields ever leave the app (no XDR/secrets). */
function pick(item: FeedItem, columns: readonly ExportColumn[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const col of columns) out[col] = String(item[col] ?? "");
  return out;
}

export function filterByDateRange(items: readonly FeedItem[], from?: string, to?: string): FeedItem[] {
  const fromMs = from ? Date.parse(`${from}T00:00:00Z`) : -Infinity;
  const toMs = to ? Date.parse(`${to}T23:59:59.999Z`) : Infinity;
  return items.filter((i) => {
    const t = Date.parse(i.createdAt);
    return t >= fromMs && t <= toMs;
  });
}

export function applyFilenameTemplate(template: string, format: ExportFormat, now: Date, network: string): string {
  const date = now.toISOString().slice(0, 10);
  const base = (template.trim() || "vortex-intents-{date}")
    .replace(/\{date\}/g, date)
    .replace(/\{network\}/g, network)
    .replace(/[^\w.-]+/g, "-");
  return `${base}.${format}`;
}

/** Header part(s) emitted before any rows. */
export function serializeHead(opts: ExportOptions): string {
  if (opts.format === "csv") return `${UTF8_BOM}${opts.columns.join(",")}\n`;
  const meta = JSON.stringify({ schemaVersion: EXPORT_SCHEMA_VERSION, ...opts.meta, columns: opts.columns });
  // Open the document; rows are appended into `intents`.
  return `${meta.slice(0, -1)},"intents":[`;
}

/** Serialise one chunk of rows. `first` controls JSON comma placement. */
export function serializeChunk(items: readonly FeedItem[], opts: ExportOptions, first: boolean): string {
  if (opts.format === "csv") {
    return items
      .map((item) => opts.columns.map((c) => escapeCsv(String(item[c] ?? ""))).join(",") + "\n")
      .join("");
  }
  const body = items.map((item) => JSON.stringify(pick(item, opts.columns))).join(",");
  return body && !first ? `,${body}` : body;
}

export function serializeTail(opts: ExportOptions): string {
  return opts.format === "csv" ? "" : "]}";
}

/** Chunked generator: yields string parts so large exports become Blob parts, not one giant string. */
export function* serializeParts(
  items: readonly FeedItem[],
  opts: ExportOptions,
  chunkSize = EXPORT_CHUNK_SIZE,
): Generator<{ part: string; done: number }> {
  yield { part: serializeHead(opts), done: 0 };
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    yield { part: serializeChunk(chunk, opts, i === 0), done: Math.min(i + chunkSize, items.length) };
  }
  yield { part: serializeTail(opts), done: items.length };
}
