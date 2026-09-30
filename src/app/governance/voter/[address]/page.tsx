import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StrKey } from '@stellar/stellar-sdk';
import { governanceStore } from '@/lib/governanceStore';
import { sanitizeText } from '@/lib/textSafety';

const WINDOWS = [30, 90, 365] as const;
const PAGE_SIZE = 20;

type WindowDays = (typeof WINDOWS)[number];

interface VoterPageProps {
  params: { address: string };
  searchParams?: { window?: string; page?: string };
}

function isValidAddress(address: string): boolean {
  try {
    return StrKey.isValidEd25519PublicKey(address);
  } catch {
    return false;
  }
}

function parseWindow(value: string | undefined): WindowDays {
  const parsed = Number(value);
  return (WINDOWS as readonly number[]).includes(parsed) ? (parsed as WindowDays) : 90;
}

function parsePage(value: string | undefined): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function formatDate(value: string | number | Date | undefined): string {
  if (value === undefined || value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toISOString().slice(0, 10);
}

export function generateMetadata({ params }: VoterPageProps): Metadata {
  const short = `${params.address.slice(0, 6)}…${params.address.slice(-4)}`;
  return {
    title: `Voter history · ${short}`,
    description: `Governance voting history and participation rate for ${short}.`,
    alternates: { canonical: `/governance/voter/${params.address}` },
  };
}

export default async function VoterHistoryPage({ params, searchParams }: VoterPageProps) {
  const { address } = params;
  if (!isValidAddress(address)) {
    notFound();
  }

  const windowDays = parseWindow(searchParams?.window);
  const page = parsePage(searchParams?.page);

  const history = await governanceStore.getVoterHistory(address, {
    windowDays,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  if (!history) {
    notFound();
  }

  const { votes, totalVotes, participationRate, delegatedTo } = history;
  const totalPages = Math.max(1, Math.ceil(totalVotes / PAGE_SIZE));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted-foreground">
        <Link href="/governance" className="hover:underline focus-visible:outline focus-visible:outline-2">
          Governance
        </Link>
        <span aria-hidden="true"> / </span>
        <span>Voter history</span>
      </nav>

      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Voter history</h1>
        <p className="mt-1 break-all font-mono text-sm text-muted-foreground">{address}</p>
      </header>

      <section aria-label="Participation stats" className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Votes cast</p>
          <p className="text-2xl font-semibold">{totalVotes}</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Participation rate</p>
          <p className="text-2xl font-semibold">{(participationRate * 100).toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">Delegated to</p>
          <p className="truncate font-mono text-sm">{delegatedTo ?? '—'}</p>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Participation window">
        {WINDOWS.map((days) => (
          <Link
            key={days}
            href={`/governance/voter/${address}?window=${days}`}
            aria-current={days === windowDays ? 'true' : undefined}
            className={`rounded-md border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2 ${
              days === windowDays ? 'border-primary bg-primary/10' : 'border-border'
            }`}
          >
            {days}d
          </Link>
        ))}
      </div>

      {votes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          No votes recorded in this window.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {votes.map((vote) => (
            <li key={vote.proposalId} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div className="min-w-0">
                <Link
                  href={`/governance/${vote.proposalId}`}
                  className="font-medium hover:underline focus-visible:outline focus-visible:outline-2"
                >
                  {sanitizeText(vote.title)}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {vote.choice} · weight {vote.weight} · {formatDate(vote.timestamp)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between">
          <Link
            href={`/governance/voter/${address}?window=${windowDays}&page=${Math.max(1, page - 1)}`}
            aria-disabled={page <= 1}
            className="rounded-md border border-border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2"
          >
            Previous
          </Link>
          <span className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/governance/voter/${address}?window=${windowDays}&page=${Math.min(totalPages, page + 1)}`}
            aria-disabled={page >= totalPages}
            className="rounded-md border border-border px-3 py-1 text-sm focus-visible:outline focus-visible:outline-2"
          >
            Next
          </Link>
        </nav>
      )}
    </main>
  );
}
