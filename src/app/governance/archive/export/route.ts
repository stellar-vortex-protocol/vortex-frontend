import { getGovernanceProposals } from "@/lib/governanceStore";
import { buildArchiveCsv, type ArchiveSearchParams } from "@/lib/governanceArchive";

// `page.tsx` cannot set response headers, so the CSV download lives in a
// sibling route handler that shares the page's filter logic.
export const dynamic = "force-dynamic";

function parseDateParam(value: string | null): number | null | undefined {
  if (value === null || value.trim() === "") return undefined;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

export function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const params: ArchiveSearchParams = {};
  for (const key of ["status", "category", "from", "to", "q", "sort"] as const) {
    const value = sp.get(key);
    if (value !== null) params[key] = value;
  }

  const from = parseDateParam(sp.get("from"));
  const to = parseDateParam(sp.get("to"));
  if (from === null || to === null) {
    return Response.json({ error: "Invalid date range: from and to must be parseable dates." }, { status: 400 });
  }
  if (from !== undefined && to !== undefined && from > to) {
    return Response.json({ error: "Invalid date range: from must not be after to." }, { status: 400 });
  }

  return new Response(buildArchiveCsv(getGovernanceProposals(), params), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="governance-archive.csv"',
      "Cache-Control": "no-store",
    },
  });
}
