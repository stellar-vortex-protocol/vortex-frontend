import { describe, expect, it } from "vitest";
import type { FeedItem } from "@/lib/types";
import {
  EXPORT_COLUMNS,
  EXPORT_SCHEMA_VERSION,
  UTF8_BOM,
  applyFilenameTemplate,
  filterByDateRange,
  serializeParts,
  type ExportOptions,
} from "./serialize";
import { handleExportMessage } from "./runner";
import type { ExportResponse } from "./protocol";

const item = (over: Partial<FeedItem> = {}): FeedItem => ({
  id: "i1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "100",
  dstToken: "XLM",
  solver: "alpha",
  status: "filled",
  createdAt: "2026-01-02T10:00:00.000Z",
  ...over,
});

const meta = { network: "testnet", generatedAt: "2026-01-03T00:00:00.000Z" };
const join = (items: FeedItem[], opts: ExportOptions, chunk?: number) =>
  [...serializeParts(items, opts, chunk)].map((p) => p.part).join("");

describe("CSV serialisation", () => {
  const opts: ExportOptions = { format: "csv", columns: EXPORT_COLUMNS, meta };

  it("prefixes a BOM and header row", () => {
    expect(join([], opts)).toBe(`${UTF8_BOM}${EXPORT_COLUMNS.join(",")}\n`);
  });

  it("neutralises formula injection and quotes delimiters", () => {
    const out = join([item({ solver: "=HYPERLINK(\"x\")", srcToken: "a,b" })], { ...opts, columns: ["srcToken", "solver"] });
    expect(out).toContain('"a,b","\'=HYPERLINK(""x"")"');
  });

  it("produces identical output regardless of chunk size", () => {
    const items = Array.from({ length: 7 }, (_, i) => item({ id: `i${i}` }));
    expect(join(items, opts, 2)).toBe(join(items, opts, 100));
  });
});

describe("JSON serialisation", () => {
  const opts: ExportOptions = { format: "json", columns: ["id", "status"], meta };

  it("emits valid JSON with schema version and metadata", () => {
    const items = Array.from({ length: 5 }, (_, i) => item({ id: `i${i}` }));
    const parsed = JSON.parse(join(items, opts, 2));
    expect(parsed.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(parsed.network).toBe("testnet");
    expect(parsed.generatedAt).toBe(meta.generatedAt);
    expect(parsed.intents).toHaveLength(5);
    expect(parsed.intents[0]).toEqual({ id: "i0", status: "filled" });
  });

  it("handles an empty list", () => {
    expect(JSON.parse(join([], opts)).intents).toEqual([]);
  });
});

describe("helpers", () => {
  it("filters by inclusive UTC date range", () => {
    const items = [item({ createdAt: "2026-01-01T23:00:00Z" }), item({ createdAt: "2026-01-05T00:00:00Z" })];
    expect(filterByDateRange(items, "2026-01-01", "2026-01-01")).toHaveLength(1);
    expect(filterByDateRange(items)).toHaveLength(2);
  });

  it("applies filename templates safely", () => {
    const now = new Date("2026-02-03T00:00:00Z");
    expect(applyFilenameTemplate("x-{date}-{network}", "csv", now, "testnet")).toBe("x-2026-02-03-testnet.csv");
    expect(applyFilenameTemplate("../evil name", "json", now, "t")).toBe("..-evil-name.json");
    expect(applyFilenameTemplate("", "json", now, "t")).toBe("vortex-intents-2026-02-03.json");
  });
});

describe("worker protocol runner", () => {
  const opts: ExportOptions = { format: "csv", columns: ["id"], meta };

  it("reports progress then completes", async () => {
    const msgs: ExportResponse[] = [];
    await handleExportMessage({ type: "start", jobId: "j", items: [item()], options: opts }, new Set(), (m) => msgs.push(m));
    expect(msgs.some((m) => m.type === "progress")).toBe(true);
    const last = msgs.at(-1);
    expect(last?.type).toBe("complete");
    if (last?.type === "complete") expect(last.parts.join("")).toContain("i1");
  });

  it("stops when cancelled", async () => {
    const cancelled = new Set<string>();
    const msgs: ExportResponse[] = [];
    const run = handleExportMessage({ type: "start", jobId: "j", items: [item()], options: opts }, cancelled, (m) => msgs.push(m));
    await handleExportMessage({ type: "cancel", jobId: "j" }, cancelled, (m) => msgs.push(m));
    await run;
    expect(msgs.at(-1)?.type).toBe("cancelled");
  });
});
