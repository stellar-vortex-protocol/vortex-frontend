'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVotingPower } from '@/hooks/useVotingPower';
import { useDelegation } from '@/hooks/useDelegation';
import { sanitizeText } from '@/lib/textSafety';
import { isSameStellarAddress, isValidStellarAddress } from '@/lib/stellarAddress';
import { secureLogger } from '@/lib/secureLogging';

interface DelegateProfile {
  address: string;
  name: string;
  bio: string;
  votingPower: number;
  participationRate: number;
  proposalsVoted: number;
}

type SortKey = 'votingPower' | 'participationRate' | 'proposalsVoted';
type FlowStage = 'idle' | 'review' | 'simulate' | 'sign' | 'pending' | 'done';

const MOCK_DELEGATES: DelegateProfile[] = [
  {
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    name: 'Aurora Governance',
    bio: 'Active voter focused on protocol upgrades and treasury stewardship.',
    votingPower: 1250000,
    participationRate: 0.94,
    proposalsVoted: 87,
  },
  {
    address: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
    name: 'Nova Collective',
    bio: 'Community-run delegate prioritising developer tooling and grants.',
    votingPower: 860000,
    participationRate: 0.81,
    proposalsVoted: 64,
  },
  {
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF',
    name: 'Meridian Labs',
    bio: 'Security-first delegate reviewing every proposal before voting.',
    votingPower: 540000,
    participationRate: 0.72,
    proposalsVoted: 51,
  },
];

function formatPower(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function DelegatesPage() {
  const { votingPower, refresh: refreshVotingPower } = useVotingPower();
  const {
    currentDelegate,
    delegatedPower,
    history,
    delegate,
    revoke,
    isPending,
  } = useDelegation();

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('votingPower');
  const [selected, setSelected] = useState<DelegateProfile | null>(null);
  const [manualAddress, setManualAddress] = useState('');
  const [confirmedAddress, setConfirmedAddress] = useState('');
  const [stage, setStage] = useState<FlowStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = term
      ? MOCK_DELEGATES.filter(
          (d) =>
            d.name.toLowerCase().includes(term) ||
            d.address.toLowerCase().includes(term),
        )
      : MOCK_DELEGATES;
    return [...list].sort((a, b) => b[sortKey] - a[sortKey]);
  }, [search, sortKey]);

  const targetAddress = selected?.address ?? manualAddress.trim();
  const isNewAddress = !MOCK_DELEGATES.some((d) => isSameStellarAddress(d.address, targetAddress));
  const isSelfDelegation = isSameStellarAddress(targetAddress, currentDelegate ?? '');
  const addressValid = isValidStellarAddress(targetAddress);

  const resetFlow = useCallback(() => {
    setStage('idle');
    setError(null);
    setConfirmedAddress('');
  }, []);

  useEffect(() => {
    if (stage === 'done') {
      void refreshVotingPower();
    }
  }, [stage, refreshVotingPower]);

  const handleReview = () => {
    setError(null);
    if (!addressValid) {
      setError('Enter a valid Stellar address.');
      return;
    }
    if (isSelfDelegation) {
      setError('You cannot delegate to your current delegate.');
      return;
    }
    if (isNewAddress && confirmedAddress.trim() !== targetAddress) {
      setError('Confirm the full address before continuing.');
      return;
    }
    setStage('review');
  };

  const handleSimulate = () => setStage('simulate');

  const handleSign = async () => {
    setStage('sign');
    try {
      await delegate(targetAddress);
      setStage('done');
    } catch (err) {
      secureLogger.error('delegation failed', err);
      setError('Delegation failed. Please try again.');
      setStage('idle');
    }
  };

  const handleRevoke = async () => {
    setError(null);
    try {
      await revoke();
      setStage('done');
    } catch (err) {
      secureLogger.error('revoke failed', err);
      setError('Revoke failed. Please try again.');
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold">Voting delegation</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Delegate your voting power to a trusted address. Delegation is revocable at any time and
        applies to future proposals only.
      </p>

      <section aria-labelledby="delegation-panel" className="mt-8 rounded-lg border p-4">
        <h2 id="delegation-panel" className="text-lg font-medium">
          Your delegation
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Current delegate</dt>
            <dd className="font-mono text-sm break-all">{currentDelegate ?? 'None'}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Power delegated</dt>
            <dd className="text-sm">{formatPower(delegatedPower)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-muted-foreground">Effective voting power</dt>
            <dd className="text-sm">{formatPower(votingPower)}</dd>
          </div>
        </dl>

        {currentDelegate && (
          <button
            type="button"
            onClick={handleRevoke}
            disabled={isPending}
            className="mt-4 rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
          >
            {isPending ? 'Revoking…' : 'Revoke delegation'}
          </button>
        )}

        {history.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium">History</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {history.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4">
                  <span className="font-mono break-all">{entry.delegate ?? 'Revoked'}</span>
                  <span className="text-muted-foreground">{entry.timestamp}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section aria-labelledby="delegate-directory" className="mt-8">
        <h2 id="delegate-directory" className="text-lg font-medium">
          Delegate directory
        </h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Search delegates</span>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or address"
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
          </label>
          <label>
            <span className="sr-only">Sort delegates</span>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="votingPower">Voting power</option>
              <option value="participationRate">Participation rate</option>
              <option value="proposalsVoted">Proposals voted</option>
            </select>
          </label>
        </div>

        <ul className="mt-4 space-y-3">
          {filtered.map((d) => (
            <li key={d.address} className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{sanitizeText(d.name)}</p>
                  <p className="font-mono text-xs break-all text-muted-foreground">{d.address}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(d);
                    setManualAddress('');
                    resetFlow();
                  }}
                  className="rounded-md border px-3 py-1.5 text-sm focus-visible:outline focus-visible:outline-2"
                >
                  Delegate
                </button>
              </div>
              <p className="mt-2 text-sm">{sanitizeText(d.bio)}</p>
              <dl className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <div>
                  <dt className="inline">Power: </dt>
                  <dd className="inline">{formatPower(d.votingPower)}</dd>
                </div>
                <div>
                  <dt className="inline">Participation: </dt>
                  <dd className="inline">{formatPercent(d.participationRate)}</dd>
                </div>
                <div>
                  <dt className="inline">Proposals voted: </dt>
                  <dd className="inline">{d.proposalsVoted}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="delegate-form" className="mt-8 rounded-lg border p-4">
        <h2 id="delegate-form" className="text-lg font-medium">
          Delegate to an address
        </h2>
        <label className="mt-3 block">
          <span className="text-sm">Address</span>
          <input
            type="text"
            value={selected ? selected.address : manualAddress}
            onChange={(e) => {
              setSelected(null);
              setManualAddress(e.target.value);
              resetFlow();
            }}
            className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
        </label>

        {isNewAddress && targetAddress && (
          <label className="mt-3 block">
            <span className="text-sm">
              Confirm the full address (address-poisoning defence)
            </span>
            <input
              type="text"
              value={confirmedAddress}
              onChange={(e) => setConfirmedAddress(e.target.value)}
              className="mt-1 w-full rounded-md border px-3 py-2 font-mono text-sm"
            />
          </label>
        )}

        {error && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {stage === 'idle' && (
          <button
            type="button"
            onClick={handleReview}
            className="mt-4 rounded-md border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2"
          >
            Review delegation
          </button>
        )}

        {stage === 'review' && (
          <div className="mt-4 rounded-md border p-3 text-sm">
            <p>
              You are delegating your voting power to{' '}
              <span className="font-mono break-all">{targetAddress}</span>. Delegation is revocable
              and applies to future proposals only.
            </p>
            <button
              type="button"
              onClick={handleSimulate}
              className="mt-3 rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2"
            >
              Simulate
            </button>
          </div>
        )}

        {stage === 'simulate' && (
          <div className="mt-4 rounded-md border p-3 text-sm">
            <p>Simulation succeeded. No state changes were made.</p>
            <button
              type="button"
              onClick={handleSign}
              className="mt-3 rounded-md border px-3 py-2 focus-visible:outline focus-visible:outline-2"
            >
              Sign &amp; delegate
            </button>
          </div>
        )}

        {(stage === 'sign' || stage === 'pending') && (
          <p className="mt-4 text-sm" role="status">
            Waiting for signature…
          </p>
        )}

        {stage === 'done' && (
          <p className="mt-4 text-sm" role="status">
            Delegation updated. Effective voting power refreshed.
          </p>
        )}
      </section>
    </main>
  );
}
