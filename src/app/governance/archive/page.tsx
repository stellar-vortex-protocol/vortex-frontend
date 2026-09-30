import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { governanceStore } from '@/lib/governanceStore';
import { isValidStellarAddress } from '@/lib/stellarAddress';
import { toCsv } from '@/lib/csv';

const STATUSES = ['all', 'passed', 'rejected', 'expired', 'executed'] as const;
type Status = (typeof STATUSES)[number];

const PAGE_SIZE = 10;

interface ArchiveSearchParams {
  status?: string;
  category?: string;
  from?: string;
  to?: string;
  q?: string;
  sort?: string;
  page?: string;
}

function parseStatus(value?: string): Status {
  return STATUSES.includes((value ?? '') as Status) ? (value as Status) : 'all';
}

function parseDate(value?: string): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

function parsePage(value?: string): number {
  const n = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: ArchiveSearchParams;
}): Promise<Metadata> {
  const status = parseStatus(searchParams.status);
  const title =
    status === 'all'
      ? 'Governance Archive'
      : `Governance Archive — ${status.charAt(0).toUpperCase()}${status.slice(1)}`;
  return {
    title,
    description:
      'Searchable archive of past governance proposals with outcomes, final tallies and execution status.',
    alternates: { canonical: '/governance/archive' },
  };
}

export default async function GovernanceArchivePage({
  searchParams,
}: {
  searchParams: ArchiveSearchParams;
}) {
  const status = parseStatus(searchParams.status);
  const category = searchParams.category?.trim() || 'all';
  const from = parseDate(searchParams.from);
  const to = parseDate(searchParams.to);
  const query = searchParams.q?.trim().toLowerCase() ?? '';
  const sort = searchParams.sort === 'oldest' ? 'oldest' : 'newest';
  const page = parsePage(searchParams.page);

  const all = await governanceStore.listProposals();

  const filtered = all.filter((p) => {
    if (status !== 'all' && p.status !== status) return false;
    if (category !== 'all' && p.category !== category) return false;
    const created = p.createdAt ? Date.parse(p.createdAt) : null;
    if (from !== null && created !== null && created < from) return false;
    if (to !== null && created !== null && created > to) return false;
    if (query && !`${p.title} ${p.summary ?? ''}`.toLowerCase().includes(query)) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const at = a.createdAt ? Date.parse(a.createdAt) : 0;
    const bt = b.createdAt ? Date.parse(b.createdAt) : 0;
    return sort === 'oldest' ? at - bt : bt - at;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const rows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const buildHref = (overrides: Partial<ArchiveSearchParams>): string => {
    const params = new URLSearchParams();
    const merged = { status, category, from: searchParams.from, to: searchParams.to, q: searchParams.q, sort, page: String(currentPage), ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value && value !== 'all' && !(key === 'page' && value === '1')) params.set(key, String(value));
    }
    const qs = params.toString();
    return qs ? `/governance/archive?${qs}` : '/governance/archive';
  };

  const csvHref = `${buildHref({})}${buildHref({}).includes('?') ? '&' : '?'}format=csv`;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Governance Archive</h1>
          <p className="text-sm text-muted-foreground">
            Past proposals with outcomes, final tallies and execution status.
          </p>
        </div>
        <a
          href={csvHref}
          className="rounded border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
        >
          Export CSV
        </a>
      </header>

      <form method="get" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <label className="flex flex-col gap-1 text-sm">
          <span>Search</span>
          <input
            type="search"
            name="q"
            defaultValue={searchParams.q ?? ''}
            className="rounded border px-2 py-1"
            aria-label="Search proposals"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Status</span>
          <select name="status" defaultValue={status} className="rounded border px-2 py-1">
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Category</span>
          <input
            type="text"
            name="category"
            defaultValue={category === 'all' ? '' : category}
            className="rounded border px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>From</span>
          <input type="date" name="from" defaultValue={searchParams.from ?? ''} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>To</span>
          <input type="date" name="to" defaultValue={searchParams.to ?? ''} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Sort</span>
          <select name="sort" defaultValue={sort} className="rounded border px-2 py-1">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        <button type="submit" className="self-end rounded bg-primary px-3 py-2 text-sm text-primary-foreground">
          Apply filters
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No proposals match the selected filters.
        </p>
      ) : (
        <ul className="divide-y rounded border">
          {rows.map((p) => (
            <li key={p.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/governance/${p.id}`} className="font-medium underline-offset-2 hover:underline">
                  {p.title}
                </Link>
                <span className="rounded bg-muted px-2 py-0.5 text-xs uppercase">{p.status}</span>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground sm:grid-cols-4">
                <div>
                  <dt>For</dt>
                  <dd>{p.tally?.for ?? 0}</dd>
                </div>
                <div>
                  <dt>Against</dt>
                  <dd>{p.tally?.against ?? 0}</dd>
                </div>
                <div>
                  <dt>Abstain</dt>
                  <dd>{p.tally?.abstain ?? 0}</dd>
                </div>
                <div>
                  <dt>Execution</dt>
                  <dd>{p.executed ? 'Executed' : 'Not executed'}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-6 flex items-center justify-between text-sm" aria-label="Pagination">
        <Link
          href={buildHref({ page: String(Math.max(1, currentPage - 1)) })}
          aria-disabled={currentPage <= 1}
          className={currentPage <= 1 ? 'pointer-events-none opacity-50' : 'underline'}
        >
          Previous
        </Link>
        <span>
          Page {currentPage} of {totalPages}
        </span>
        <Link
          href={buildHref({ page: String(Math.min(totalPages, currentPage + 1)) })}
          aria-disabled={currentPage >= totalPages}
          className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : 'underline'}
        >
          Next
        </Link>
      </nav>
    </main>
  );
}

export function VoterHistory({ address, votes }: { address: string; votes: Array<{ proposalId: string; choice: string; weight: string; timestamp: string }> }) {
  if (!isValidStellarAddress(address)) notFound();
  const csv = toCsv(votes.map((v) => ({ proposalId: v.proposalId, choice: v.choice, weight: v.weight, timestamp: v.timestamp })));
  return (
    <section>
      <h2 className="text-lg font-semibold">Voter history</h2>
      <a href={`data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`} download={`voter-${address}.csv`} className="text-sm underline">
        Export CSV
      </a>
      {votes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No votes recorded for this address.</p>
      ) : (
        <ul className="mt-4 divide-y rounded border">
          {votes.map((v) => (
            <li key={`${v.proposalId}-${v.timestamp}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
              <Link href={`/governance/${v.proposalId}`} className="underline-offset-2 hover:underline">
                {v.proposalId}
              </Link>
              <span>{v.choice}</span>
              <span>{v.weight}</span>
              <time dateTime={v.timestamp}>{v.timestamp}</time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
