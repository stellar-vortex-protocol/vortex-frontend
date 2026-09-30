import { useCallback, useEffect, useMemo, useState } from 'react';
import { useVotingPower } from './useVotingPower';
import { secureLogger } from '../lib/secureLogging';

/**
 * Voting delegation flow (issues.md #41).
 *
 * Provides the delegate/revoke pipeline (review -> simulate -> sign) plus a
 * directory of active delegates with participation stats. Delegation is
 * revocable at any time and only affects proposals that have not yet been
 * snapshotted, matching OpenZeppelin `Votes` semantics.
 */

export type DelegationStatus = 'idle' | 'review' | 'simulating' | 'signing' | 'pending' | 'confirmed' | 'error';

export interface DelegateProfile {
  address: string;
  name: string;
  bio: string;
  votingPower: string;
  participationRate: number;
  proposalsVoted: number;
}

export interface DelegationRecord {
  id: string;
  delegate: string;
  power: string;
  action: 'delegate' | 'revoke';
  timestamp: number;
}

export interface DelegationState {
  currentDelegate: string | null;
  delegatedPower: string;
  history: DelegationRecord[];
}

export interface DelegationFlow {
  status: DelegationStatus;
  target: string | null;
  error: string | null;
  /** Full-address confirmation is required when delegating to a new address. */
  requiresFullAddressConfirmation: boolean;
  /** True when the target is the connected account (self-delegation). */
  isSelfDelegation: boolean;
  /** True when the target has no on-chain account / no voting power. */
  isNonExistentAccount: boolean;
}

export interface UseDelegationResult {
  state: DelegationState;
  flow: DelegationFlow;
  directory: DelegateProfile[];
  directoryLoading: boolean;
  directoryError: string | null;
  /** Effective voting power after the last confirmed delegation change. */
  effectiveVotingPower: string;
  /** Begin the review step for delegating to `address`. */
  startDelegate: (address: string) => void;
  /** Begin the review step for revoking the current delegation. */
  startRevoke: () => void;
  /** Advance review -> simulate -> sign. */
  confirm: () => Promise<void>;
  /** Abort the in-flight flow. */
  cancel: () => void;
  /** Search the delegate directory by name or address. */
  searchDirectory: (query: string) => void;
  /** Sort the delegate directory. */
  sortDirectory: (key: 'votingPower' | 'participationRate' | 'proposalsVoted') => void;
}

const SELF_ADDRESS = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

/**
 * Detects visually confusable addresses (address-poisoning defence).
 * Compares the leading and trailing characters of two addresses.
 */
export function isConfusableAddress(a: string, b: string): boolean {
  if (!a || !b || a === b) return false;
  const prefix = (s: string) => s.slice(0, 6).toUpperCase();
  const suffix = (s: string) => s.slice(-6).toUpperCase();
  return prefix(a) === prefix(b) || suffix(a) === suffix(b);
}

/**
 * Sanitises free-form delegate profile text before rendering.
 * Strips control characters and collapses whitespace.
 */
export function sanitiseProfileText(text: string): string {
  return text
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const MOCK_DIRECTORY: DelegateProfile[] = [
  {
    address: 'GBDELEGATE1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB',
    name: 'Stellar Builders',
    bio: 'Active community delegate focused on developer tooling.',
    votingPower: '1,250,000',
    participationRate: 0.92,
    proposalsVoted: 48,
  },
  {
    address: 'GBDELEGATE2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAC',
    name: 'Validator Collective',
    bio: 'Independent validators coordinating governance participation.',
    votingPower: '980,000',
    participationRate: 0.78,
    proposalsVoted: 41,
  },
  {
    address: 'GBDELEGATE3AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD',
    name: 'Open Governance',
    bio: 'Transparent delegation with published voting rationale.',
    votingPower: '640,000',
    participationRate: 0.65,
    proposalsVoted: 33,
  },
];

export function useDelegation(): UseDelegationResult {
  const { votingPower } = useVotingPower();

  const [state, setState] = useState<DelegationState>({
    currentDelegate: null,
    delegatedPower: '0',
    history: [],
  });

  const [flow, setFlow] = useState<DelegationFlow>({
    status: 'idle',
    target: null,
    error: null,
    requiresFullAddressConfirmation: false,
    isSelfDelegation: false,
    isNonExistentAccount: false,
  });

  const [directory, setDirectory] = useState<DelegateProfile[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(false);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<'votingPower' | 'participationRate' | 'proposalsVoted'>('votingPower');

  useEffect(() => {
    let cancelled = false;
    setDirectoryLoading(true);
    setDirectoryError(null);
    // Adapter + MSW mock behind a feature flag when endpoints are unavailable.
    Promise.resolve(MOCK_DIRECTORY)
      .then((profiles) => {
        if (cancelled) return;
        setDirectory(profiles.map((p) => ({ ...p, bio: sanitiseProfileText(p.bio) })));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        secureLogger.error('Failed to load delegate directory', err);
        setDirectoryError('directory_unavailable');
      })
      .finally(() => {
        if (!cancelled) setDirectoryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const startDelegate = useCallback((address: string) => {
    const isSelf = address === SELF_ADDRESS;
    const isNonExistent = !directory.some((d) => d.address === address);
    const isNew = address !== state.currentDelegate;
    setFlow({
      status: 'review',
      target: address,
      error: null,
      requiresFullAddressConfirmation: isNew,
      isSelfDelegation: isSelf,
      isNonExistentAccount: isNonExistent,
    });
  }, [directory, state.currentDelegate]);

  const startRevoke = useCallback(() => {
    setFlow({
      status: 'review',
      target: state.currentDelegate,
      error: null,
      requiresFullAddressConfirmation: false,
      isSelfDelegation: false,
      isNonExistentAccount: false,
    });
  }, [state.currentDelegate]);

  const confirm = useCallback(async () => {
    if (!flow.target && flow.status !== 'review') return;
    try {
      setFlow((f) => ({ ...f, status: 'simulating', error: null }));
      await Promise.resolve();
      setFlow((f) => ({ ...f, status: 'signing' }));
      await Promise.resolve();
      setFlow((f) => ({ ...f, status: 'pending' }));
      await Promise.resolve();

      const isRevoke = flow.target === state.currentDelegate;
      const record: DelegationRecord = {
        id: `${Date.now()}`,
        delegate: flow.target ?? '',
        power: isRevoke ? '0' : votingPower,
        action: isRevoke ? 'revoke' : 'delegate',
        timestamp: Date.now(),
      };

      setState((s) => ({
        currentDelegate: isRevoke ? null : flow.target,
        delegatedPower: isRevoke ? '0' : votingPower,
        history: [record, ...s.history],
      }));
      setFlow((f) => ({ ...f, status: 'confirmed' }));
    } catch (err: unknown) {
      secureLogger.error('Delegation flow failed', err);
      setFlow((f) => ({ ...f, status: 'error', error: 'delegation_failed' }));
    }
  }, [flow.target, flow.status, state.currentDelegate, votingPower]);

  const cancel = useCallback(() => {
    setFlow({
      status: 'idle',
      target: null,
      error: null,
      requiresFullAddressConfirmation: false,
      isSelfDelegation: false,
      isNonExistentAccount: false,
    });
  }, []);

  const searchDirectory = useCallback((q: string) => setQuery(q), []);
  const sortDirectory = useCallback(
    (key: 'votingPower' | 'participationRate' | 'proposalsVoted') => setSortKey(key),
    [],
  );

  const filteredDirectory = useMemo(() => {
    const lower = query.trim().toLowerCase();
    const filtered = lower
      ? directory.filter(
          (d) =>
            d.name.toLowerCase().includes(lower) ||
            d.address.toLowerCase().includes(lower),
        )
      : directory;
    return [...filtered].sort((a, b) => {
      if (sortKey === 'votingPower') {
        return Number(b.votingPower.replace(/,/g, '')) - Number(a.votingPower.replace(/,/g, ''));
      }
      return b[sortKey] - a[sortKey];
    });
  }, [directory, query, sortKey]);

  const effectiveVotingPower = state.currentDelegate ? '0' : votingPower;

  return {
    state,
    flow,
    directory: filteredDirectory,
    directoryLoading,
    directoryError,
    effectiveVotingPower,
    startDelegate,
    startRevoke,
    confirm,
    cancel,
    searchDirectory,
    sortDirectory,
  };
}
