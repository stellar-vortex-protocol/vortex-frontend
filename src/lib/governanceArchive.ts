import { buildCsv } from "./csv";
import type { GovernanceProposal } from "./governanceStore";

/**
 * Shared filtering/sorting for the governance archive. Both the HTML page and
 * the CSV export route call `filterArchiveProposals`, so they cannot drift.
 */

export const ARCHIVE_STATUSES = ["all", "passed", "rejected", "expired", "executed"] as const;
export type ArchiveStatus = (typeof ARCHIVE_STATUSES)[number];

/** CSV export is capped to keep responses bounded; the HTML view paginates. */
export const MAX_CSV_ROWS = 5000;

export const ARCHIVE_CSV_HEADERS = [
  "id",
  "title",
  "category",
  "status",
  "votesFor",
  "votesAgainst",
  "votesAbstain",
  "createdAt",
  "executedAt",
] as const;

export interface ArchiveSearchParams {
  status?: string | undefined;
  category?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  q?: string | undefined;
  sort?: string | undefined;
  page?: string | undefined;
}

export function parseStatus(value?: string): ArchiveStatus {
  return ARCHIVE_STATUSES.includes((value ?? "") as ArchiveStatus) ? (value as ArchiveStatus) : "all";
}

function parseDate(value?: string): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

/** Date bounds for the fetch; unparseable values are ignored (no bound). */
export function archiveDateRange(params: ArchiveSearchParams): { from?: string; to?: string } {
  const range: { from?: string; to?: string } = {};
  if (parseDate(params.from) !== null) range.from = params.from;
  if (parseDate(params.to) !== null) range.to = params.to;
  return range;
}

export function filterArchiveProposals(
  all: readonly GovernanceProposal[],
  params: ArchiveSearchParams,
): GovernanceProposal[] {
  const status = parseStatus(params.status);
  const category = params.category?.trim() || "all";
  const query = params.q?.trim().toLowerCase() ?? "";
  const sort = params.sort === "oldest" ? "oldest" : "newest";

  const filtered = all.filter((p) => {
    if (status !== "all" && p.status !== status) return false;
    if (category !== "all" && p.category !== category) return false;
    if (query && !`${p.title} ${p.description ?? ""}`.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
    return sort === "oldest" ? at - bt : bt - at;
  });
  return filtered;
}

/** Injection-safe CSV (via `escapeCsv`) of the proposals matching `params`. */
export function buildArchiveCsv(all: readonly GovernanceProposal[], params: ArchiveSearchParams): string {
  const rows = filterArchiveProposals(all, params)
    .slice(0, MAX_CSV_ROWS)
    .map((p) => [
      p.id,
      p.title,
      p.category,
      p.status,
      p.votesFor,
      p.votesAgainst,
      p.votesAbstain ?? 0,
      p.createdAt ?? "",
      p.executedAt ?? "",
    ]);
  return buildCsv(ARCHIVE_CSV_HEADERS, rows);
}
