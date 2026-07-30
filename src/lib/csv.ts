import type { FeedItem } from "./types";

const CSV_HEADERS = ["id", "srcChain", "srcToken", "srcAmount", "dstToken", "solver", "status", "createdAt"];

function escapeCsv(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function buildIntentsCsv(intents: FeedItem[]) {
  const rows = intents.map((intent) =>
    CSV_HEADERS.map((key) => escapeCsv(String(intent[key as keyof FeedItem] ?? ""))).join(",")
  );

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
