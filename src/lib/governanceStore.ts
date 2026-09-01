import { sanitizeText } from "./textSafety";

export type GovernanceProposal = {
  id: string;
  title: string;
  description: string;
  proposer: string;
  category: string;
  status: "active" | "passed" | "rejected";
  votesFor: number;
  votesAgainst: number;
  createdAt: string;
  deadline: string;
};

export type ProposalComment = {
  id: string;
  proposalId: string;
  author: string;
  text: string;
  createdAt: string;
};

/**
 * PENDING_BACKEND_ENDPOINTS:
 * This mock store is a temporary in-memory placeholder for future real backend API endpoints:
 * - GET  /api/governance/proposals
 * - GET  /api/governance/proposals/:id
 * - GET  /api/governance/proposals/:id/comments
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
    createdAt: "2026-08-25T10:00:00Z",
    deadline: "2026-09-10T10:00:00Z",
  },
  {
    id: "VIP-2",
    title: "Add Direct Soroban Pool Liquidity Routing",
    description: "Enable routing for Soroban DEX pools to improve fill execution speed and reduce price impact for Stellar native cross-chain swaps.",
    proposer: "GBBY3456789012345678901234567890123456789012345678901234",
    category: "Routing & Architecture",
    status: "passed",
    votesFor: 450000,
    votesAgainst: 1200,
    createdAt: "2026-08-15T14:30:00Z",
    deadline: "2026-08-28T14:30:00Z",
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

export function getGovernanceProposals(): GovernanceProposal[] {
  return INITIAL_PROPOSALS;
}

export function getGovernanceProposalById(id: string): GovernanceProposal | undefined {
  return INITIAL_PROPOSALS.find((p) => p.id.toLowerCase() === id.toLowerCase());
}

export function getProposalComments(proposalId: string): ProposalComment[] {
  return commentsStore[proposalId] ? [...commentsStore[proposalId]] : [];
}

export function addProposalComment(
  proposalId: string,
  author: string,
  rawText: string
): ProposalComment {
  const sanitized = sanitizeText(rawText);
  const newComment: ProposalComment = {
    id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    proposalId,
    author,
    text: sanitized,
    createdAt: new Date().toISOString(),
  };

  if (!commentsStore[proposalId]) {
    commentsStore[proposalId] = [];
  }
  commentsStore[proposalId].push(newComment);
  return newComment;
}
