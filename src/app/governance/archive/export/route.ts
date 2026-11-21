import { getGovernanceProposals } from "@/lib/governanceStore";
import { buildArchiveCsv, type ArchiveSearchParams } from "@/lib/governanceArchive";
import { DEFAULT_LOCALE, translate } from "@/lib/i18n";

// `page.tsx` cannot set response headers, so the CSV download lives in a
// sibling route handler that shares the page's filter logic.
export const dynamic = "force-dynamic";

function parseQueryDate(value: string | null): number | null | undefined {
  if (value === null || value.trim() === "") return undefined;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function badRequest(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const from = parseQueryDate(sp.get("from"));
  const to = parseQueryDate(sp.get("to"));
  if (from === null || to === null) {
    return badRequest(translate(DEFAULT_LOCALE, "governance.archive.export.invalidDate"));
  }
  if (from !== undefined && to !== undefined && from > to) {
    return badRequest(translate(DEFAULT_LOCALE, "governance.archive.export.invertedRange"));
  }
  const params: ArchiveSearchParams = {};
  for (const key of ["status", "category", "from", "to", "q", "sort"] as const) {
    const value = sp.get(key);
    if (value !== null) params[key] = value;
  }
  return new Response(buildArchiveCsv(getGovernanceProposals(), params), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="governance-archive.csv"',
      "Cache-Control": "no-store",
    },
  });
}
