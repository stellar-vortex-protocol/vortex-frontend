import type { FeedItem } from "./types";

export const CSV_HEADERS = ["id", "srcChain", "srcToken", "srcAmount", "dstToken", "solver", "status", "createdAt"] as const;

/**
 * Characters that spreadsheet apps (Excel, Google Sheets, LibreOffice Calc)
 * interpret as formula starters when they appear as the first character of a
 * cell value.  Prefixing the value with a single apostrophe is the standard
 * OWASP-recommended mitigation for CSV injection (CWE-1236).
 *
 * We also neutralise tab (U+0009) and carriage-return (U+000D) characters
 * because some parsers use them as field/record delimiters that can shift
 * column alignment in ways that defeat formula-injection awareness checks.
 *
 * Tradeoff: a leading apostrophe causes Excel to treat the field as a text
 * string and display the apostrophe in the formula bar (though not in the
 * cell itself).  Numeric fields that happen to start with "-" (e.g. a future
 * negative-amount column) would lose their numeric type in Excel — they would
 * sort/display as text rather than numbers.  This is an accepted tradeoff:
 * all current exported fields in `CSV_HEADERS` are already strings (IDs,
 * symbols, amounts as strings, status, ISO timestamps), so no numeric
 * semantics are lost in practice.  If a genuinely numeric column is ever
 * added, the caller should pre-format it to ensure it does not start with a
 * formula-trigger character, or the column should be explicitly excluded from
 * sanitisation via a separate code path.
 */
const FORMULA_TRIGGER_RE = /^[=+\-@\t\r]/;

export function escapeCsv(value: string): string {
  // Neutralise formula injection: prefix triggering characters with an
  // apostrophe so the cell is treated as literal text by spreadsheet apps.
  const neutralised = FORMULA_TRIGGER_RE.test(value) ? `'${value}` : value;

  // Standard CSV quoting: wrap in double-quotes if the value contains a
  // double-quote, comma, or newline character; escape internal double-quotes
  // by doubling them.
  return /[",\n\r]/.test(neutralised)
    ? `"${neutralised.replace(/"/g, '""')}"`
    : neutralised;
}

export function buildIntentsCsv(intents: FeedItem[], columns: readonly string[] = CSV_HEADERS) {
  const headers = columns.length > 0 ? columns : CSV_HEADERS;
  const rows = intents.map((intent) =>
    headers.map((key) => escapeCsv(String(intent[key as keyof FeedItem] ?? ""))).join(",")
  );

  return [headers.join(","), ...rows].join("\n");
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
