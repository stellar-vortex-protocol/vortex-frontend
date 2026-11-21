import { sanitizeText } from "./textSafety";
import type { ChartSeries } from "../components/charts";

export type GovernanceProposalStatus =
  | "active"
  | "passed"
  | "rejected"
  | "queued"
  | "executed"
  | "expired";

/**
 * A proposal that changes one numeric protocol parameter. Only parameters with
 * an entry in `PARAMETER_IMPACT_REGISTRY` (see `src/lib/governanceImpact.ts`)
 * get an automated impact preview.
 */
export type ParameterChange = {
  parameter: "minSolverBondUsd" | (string & {});
  currentValue: number;
  proposedValue: number;
};

export type GovernanceProposal = {
  id: string;
  title: string;
  description: string;
  proposer: string;
  category: string;
  status: GovernanceProposalStatus;
  votesFor: number;
  votesAgainst: number;
  /** Votes that neither approve nor reject; counted toward quorum when configured. */
  votesAbstain?: number;
  /** Total voting power eligible to participate; used for quorum math. */
  totalSupply?: number;
  /** Minimum participation (as a fraction of totalSupply) required for quorum. */
  quorumFraction?: number;
  /** Minimum approval share (as a fraction of for+against) required to pass. */
  approvalThreshold?: number;
  /** Whether abstain votes count toward quorum (Governor-configurable). */
  abstainCountsTowardQuorum?: boolean;
  createdAt: string;
  deadline: string;
  /** When the proposal entered the timelock queue. */
  queuedAt?: string;
  /** When the timelock ends and execution becomes possible. */
  timelockEndsAt?: string;
  /** When the proposal was executed on-chain. */
  executedAt?: string;
  /** When the proposal expired without execution. */
  expiredAt?: string;
  parameterChange?: ParameterChange;
};

/**
 * Comment length bounds: single source of truth for the UI and the hooks.
 * Signing, hashing and verification (and the canonical message spec) live in
 * `src/lib/wallet/signMessage.ts`.
 */
export const COMMENT_MIN_LENGTH = 1;
export const COMMENT_MAX_LENGTH = 500;

export type CommentSignature = {
  /** Base64 signature produced by SEP-53 message signing (or the signMessage shim). */
  signature: string;
  /** Unix seconds covered by the signature. */
  timestamp: number;
  /** sha256 hex of the NFC-normalised comment text. */
  textHash: string;
  /** How the signature was produced. */
  scheme: "sep53" | "signMessage-shim";
};

export type ProposalComment = {
  id: string;
  proposalId: string;
  author: string;
  text: string;
  createdAt: string;
  signature?: CommentSignature;
  /** Set only after client-side verification succeeds. */
  verified?: boolean;
  /**
   * Id of the top-level comment this comment replies to. Absent for top-level
   * comments. Nesting is limited to one level: a reply cannot be a parent.
   * The signed message does not cover `parentId`.
   */
  parentId?: string;
};

export type CommentPage = {
  comments: ProposalComment[];
  /** Cursor to pass back for the next (older) page, or null when exhausted. */
  nextCursor: string | null;
};

/**
 * PENDING_BACKEND_ENDPOINTS:
 * This mock store is a temporary in-memory placeholder for future real backend API endpoints:
 * - GET  /api/governance/proposals
 * - GET  /api/governance/proposals/:id
 * - GET  /api/governance/proposals/:id/comments?cursor=&limit=
 * - POST /api/governance/proposals/:id/comments
 */

const INITIAL_PROPOSALS: GovernanceProposal[] = [
  {
    id: "VIP-1",
    title: "Adjust Minimum Solver Bond Requirement from 50 to 100 USDC",
    description: "Proposal to increase the solver registration bond to strengthen economic security against unfulfilled intents and improve market stability.",
    proposer: "GAAX8890123456789012345678901234567890123456789012345678",
    category: "Protocol Parameters",
    status: "active",
    votesFor: 125000,
    votesAgainst: 42000,
    votesAbstain: 8000,
    totalSupply: 400000,
    quorumFraction: 0.4,
    approvalThreshold: 0.66,
    abstainCountsTowardQuorum: true,
    createdAt: "2026-08-25T10:00:00Z",
    deadline: "2026-09-10T10:00:00Z",
    parameterChange: { parameter: "minSolverBondUsd", currentValue: 50, proposedValue: 100 },
  },
  {
    id: "VIP-2",
    title: "Add Direct Soroban Pool Liquidity Routing",
    description: "Enable routing for Soroban DEX pools to improve fill execution speed and reduce price impact for Stellar native cross-chain swaps.",
    proposer: "GBBY3456789012345678901234567890123456789012345678901234",
    category: "Routing & Architecture",
    status: "queued",
    votesFor: 450000,
    votesAgainst: 1200,
    votesAbstain: 3000,
    totalSupply: 600000,
    quorumFraction: 0.4,
    approvalThreshold: 0.66,
    abstainCountsTowardQuorum: true,
    createdAt: "2026-08-15T14:30:00Z",
    deadline: "2026-08-28T14:30:00Z",
    queuedAt: "2026-08-28T15:00:00Z",
    timelockEndsAt: "2026-09-04T15:00:00Z",
  },
  {
    id: "VIP-3",
    title: "Implement Automated Solver Uptime Penalties",
    description: "Introduce automatic bond slashing for solvers missing more than 3 consecutive fill windows without taking inactive status.",
    proposer: "GCCZ1122334455667788990011223344556677889900112233445566",
    category: "Solver Network",
    status: "active",
    votesFor: 89000,
    votesAgainst: 64000,
    votesAbstain: 2000,
    totalSupply: 400000,
    quorumFraction: 0.4,
    approvalThreshold: 0.66,
    abstainCountsTowardQuorum: true,
    createdAt: "2026-08-28T09:00:00Z",
    deadline: "2026-09-12T09:00:00Z",
  },
];

const INITIAL_COMMENTS: Record<string, ProposalComment[]> = {
  "VIP-1": [
    {
      id: "c-101",
      proposalId: "VIP-1",
      author: "GCZZ88912345678901234567890123456789012345678901234567890",
      text: "Increasing the bond to 100 USDC helps filter out low-reliability solvers while keeping entry barrier reasonable.",
      createdAt: "2026-08-26T11:15:00Z",
    },
    {
      id: "c-102",
      proposalId: "VIP-1",
      author: "GDKK9900112233445566778899001122334455667788990011223344",
      text: "Agree with the security rationale, but we should make sure smaller solvers have sufficient lead time to top up their bonds.",
      createdAt: "2026-08-27T09:40:00Z",
    },
  ],
  "VIP-2": [
    {
      id: "c-201",
      proposalId: "VIP-2",
      author: "GAAB1122334455667788990011223344556677889900112233445566",
      text: "Direct Soroban pool routing will significantly cut down average fill times on mainnet transactions.",
      createdAt: "2026-08-16T16:20:00Z",
    },
  ],
  "VIP-3": [
    {
      id: "c-301",
      proposalId: "VIP-3",
      author: "GEEE4455667788990011223344556677889900112233445566778899",
      text: "Uptime penalization is necessary to maintain fast user swap execution guarantees.",
      createdAt: "2026-08-29T14:10:00Z",
    },
  ],
};

let commentsStore: Record<string, ProposalComment[]> = { ...INITIAL_COMMENTS };

export type GovernanceProposalQuery = {
  /** Inclusive lower bound on `createdAt` (ISO 8601). */
  from?: string | undefined;
  /** Inclusive upper bound on `createdAt` (ISO 8601). */
  to?: string | undefined;
};

function parseBound(value?: string): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : ts;
}

/**
 * PENDING_BACKEND_ENDPOINTS: GET /api/governance/proposals?from=&to=.
 * The date range is applied at fetch time so callers never load the full set.
 */
export function getGovernanceProposals(query: GovernanceProposalQuery = {}): GovernanceProposal[] {
  const from = parseBound(query.from);
  const to = parseBound(query.to);
  if (from === null && to === null) return INITIAL_PROPOSALS;
  return INITIAL_PROPOSALS.filter((p) => {
    const created = p.createdAt ? Date.parse(p.createdAt) : null;
    if (from !== null && created !== null && created < from) return false;
    if (to !== null && created !== null && created > to) return false;
    return true;
  });
}

export function getGovernanceProposalById(id: string): GovernanceProposal | undefined {
  return INITIAL_PROPOSALS.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

/** Terminal outcomes shown on the archive timeline, in stacking order. */
export const ARCHIVE_OUTCOMES = ["passed", "rejected", "executed", "expired"] as const;
export type ArchiveOutcome = (typeof ARCHIVE_OUTCOMES)[number];

function isArchiveOutcome(status: GovernanceProposalStatus): status is ArchiveOutcome {
  return (ARCHIVE_OUTCOMES as readonly string[]).includes(status);
}

const monthKey = (date: Date): string => date.toISOString().slice(0, 7);

/**
 * Buckets archived proposals by the UTC month their outcome was decided, with one
 * series per outcome. Executed and expired proposals are dated by `executedAt` and
 * `expiredAt`; passed and rejected proposals are dated by the voting `deadline`,
 * since that is when the result was fixed. Active and queued proposals have no
 * outcome yet and are skipped. Months with no outcomes are kept as zero so the
 * timeline stays continuous. Returns `[]` when no proposal has a dated outcome.
 */
export function bucketProposalsByMonth(proposals: GovernanceProposal[]): ChartSeries[] {
  const byMonth: Record<string, Record<ArchiveOutcome, number>> = {};
  for (const p of proposals) {
    if (!isArchiveOutcome(p.status)) continue;
    const dated =
      p.status === "executed" ? p.executedAt ?? p.deadline : p.status === "expired" ? p.expiredAt ?? p.deadline : p.deadline;
    const ts = Date.parse(dated);
    if (Number.isNaN(ts)) continue;
    const month = monthKey(new Date(ts));
    byMonth[month] ??= { passed: 0, rejected: 0, executed: 0, expired: 0 };
    byMonth[month][p.status] += 1;
  }

  const months = Object.keys(byMonth).sort();
  if (months.length === 0) return [];

  const labels: string[] = [];
  const cursor = new Date(`${months[0]}-01T00:00:00Z`);
  const last = months[months.length - 1];
  while (monthKey(cursor) <= last) {
    labels.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return ARCHIVE_OUTCOMES.map((outcome) => ({
    name: outcome,
    data: labels.map((label) => ({ label, value: byMonth[label]?.[outcome] ?? 0 })),
  }));
}

/**
 * Cursor pagination over the top-level comment thread. Comments are returned
 * newest-first and the cursor is the id of the last comment in the page.
 * Replies are excluded here; fetch them per-parent with `getProposalReplies`.
 */
export function getProposalComments(
  proposalId: string,
  cursor?: string | null,
  limit = 20
): CommentPage {
  const all = commentsStore[proposalId] ? [...commentsStore[proposalId]] : [];
  const ordered = all
    .filter((c) => !c.parentId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const startIndex = cursor ? ordered.findIndex((c) => c.id === cursor) + 1 : 0;
  const slice = ordered.slice(startIndex, startIndex + limit);
  const last = slice[slice.length - 1];
  const hasMore = startIndex + limit < ordered.length;
  return {
    comments: slice,
    nextCursor: hasMore && last ? last.id : null,
  };
}

/**
 * Replies to one top-level comment, oldest-first so the thread reads as a
 * conversation.
 */
export function getProposalReplies(proposalId: string, parentId: string): ProposalComment[] {
  const all = commentsStore[proposalId] ?? [];
  return all
    .filter((c) => c.parentId === parentId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export type AddCommentInput = {
  proposalId: string;
  author: string;
  text: string;
  signature?: CommentSignature;
  verified?: boolean;
  /** Top-level comment to reply to. Must exist on the same proposal and not be a reply. */
  parentId?: string;
};

export function addProposalComment(input: AddCommentInput): ProposalComment {
  const sanitized = sanitizeText(input.text);
  const existing = commentsStore[input.proposalId] ?? [];

  if (input.parentId) {
    const parent = existing.find((c) => c.id === input.parentId);
    if (!parent) {
      throw new Error(`Parent comment not found: ${input.parentId}`);
    }
    if (parent.parentId) {
      throw new Error("Replies can only be posted to top-level comments");
    }
  }

  const newComment: ProposalComment = {
    id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    proposalId: input.proposalId,
    author: input.author,
    text: sanitized,
    createdAt: new Date().toISOString(),
    signature: input.signature,
    verified: input.verified === true,
    parentId: input.parentId,
  };

  if (!commentsStore[input.proposalId]) {
    commentsStore[input.proposalId] = [];
  }
  commentsStore[input.proposalId].push(newComment);
  return newComment;
}

/**
 * Removes a comment. Removing a top-level comment also removes its replies
 * (cascade), so no reply is ever left pointing at a missing parent. Removing a
 * reply removes only that reply.
 */
export function removeProposalComment(proposalId: string, commentId: string): void {
  const list = commentsStore[proposalId];
  if (!list) return;
  commentsStore[proposalId] = list.filter(
    (c) => c.id !== commentId && c.parentId !== commentId
  );
}

export type ArchiveProposal = {
  id: string;
  title: string;
  summary: string;
  category: string;
  status: GovernanceProposalStatus;
  createdAt: string;
  tally: { for: number; against: number; abstain: number };
  executed: boolean;
};

export type VoterVote = {
  proposalId: string;
  title: string;
  choice: "for" | "against" | "abstain";
  weight: string;
  timestamp: string;
};

export type VoterHistoryResult = {
  votes: VoterVote[];
  totalVotes: number;
  participationRate: number;
  delegatedTo: string | null;
};

export type VoterHistoryOptions = { windowDays?: number; limit?: number; offset?: number };

/** Small deterministic string hash (FNV-1a) used to derive stand-in data from an address. */
function seedFromAddress(address: string): number {
  let h = 2166136261;
  for (let i = 0; i < address.length; i++) {
    h ^= address.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * PENDING_BACKEND_ENDPOINTS: GET /api/governance/proposals (archive listing).
 * Maps the seed proposals onto the shape the archive page renders.
 */
export async function listProposals(): Promise<ArchiveProposal[]> {
  return getGovernanceProposals().map((p) => ({
    id: p.id,
    title: p.title,
    summary: p.description,
    category: p.category,
    status: p.status,
    createdAt: p.createdAt,
    tally: { for: p.votesFor, against: p.votesAgainst, abstain: p.votesAbstain ?? 0 },
    executed: p.status === "executed" || Boolean(p.executedAt),
  }));
}

/**
 * PENDING_BACKEND_ENDPOINTS: GET /api/governance/voters/:address/history.
 * No per-voter vote log exists yet, so this derives a minimal deterministic
 * mock keyed by address. The window is anchored to the newest seed proposal
 * so results are stable regardless of the current date.
 */
export async function getVoterHistory(
  address: string,
  { windowDays = 90, limit = 20, offset = 0 }: VoterHistoryOptions = {},
): Promise<VoterHistoryResult> {
  const seed = seedFromAddress(address);
  const proposals = getGovernanceProposals();
  const choices = ["for", "against", "abstain"] as const;
  const newest = Math.max(...proposals.map((p) => Date.parse(p.createdAt)));
  const cutoff = newest - windowDays * 86_400_000;

  const cast = proposals
    .map((p, i) => ({ p, i }))
    .filter(({ i }) => ((seed >>> i) & 1) === 1 || i === seed % proposals.length);
  const votes: VoterVote[] = cast
    .filter(({ p }) => Date.parse(p.createdAt) >= cutoff)
    .map(({ p, i }) => ({
      proposalId: p.id,
      title: p.title,
      choice: choices[(seed + i) % choices.length],
      weight: String(((seed >>> 3) % 9000) + 1000),
      timestamp: p.createdAt,
    }))
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));

  const inWindow = proposals.filter((p) => Date.parse(p.createdAt) >= cutoff).length;
  return {
    votes: votes.slice(offset, offset + limit),
    totalVotes: votes.length,
    participationRate: inWindow === 0 ? 0 : votes.length / inWindow,
    delegatedTo: seed % 4 === 0 ? proposals[0].proposer : null,
  };
}

/** Thin namespace over the store functions, consumed by the archive and voter pages. */
export const governanceStore = {
  listProposals,
  getVoterHistory,
  getProposals: getGovernanceProposals,
  getProposalById: getGovernanceProposalById,
  getProposalComments,
  addProposalComment,
  removeProposalComment,
};
