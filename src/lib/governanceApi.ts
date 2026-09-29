/**
 * Governance API layer — issue #469.
 *
 * Provides a typed `GovernanceApi` interface with two concrete adapters:
 *   • `HttpGovernanceApi`   — fetches from the live relay backend (production)
 *   • `MockGovernanceApi`   — uses the deterministic in-memory seed data (dev/test)
 *
 * The active adapter is chosen by `config.governanceSource` ("http" | "mock").
 * Production builds default to "http" and throw at construction time if
 * `NEXT_PUBLIC_API_URL` is absent or not a valid https URL.
 *
 * Endpoints:
 *   GET  /api/governance/proposals
 *   GET  /api/governance/proposals/:id
 *   GET  /api/governance/proposals/:id/comments
 *   POST /api/governance/proposals/:id/comments
 */

import { sanitizeText } from "./textSafety";
import { apiFetch } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type ProposalFilters = {
  status?: "active" | "passed" | "rejected" | "all";
};

// ─── Validation helpers ───────────────────────────────────────────────────────

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function isNumber(v: unknown): v is number {
  return typeof v === "number" && !isNaN(v);
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export class GovernanceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GovernanceValidationError";
  }
}

function isGovernanceProposal(v: unknown): v is GovernanceProposal {
  if (!isObject(v)) return false;
  return (
    isString(v["id"]) &&
    isString(v["title"]) &&
    isString(v["description"]) &&
    isString(v["proposer"]) &&
    isString(v["category"]) &&
    isString(v["status"]) &&
    ["active", "passed", "rejected"].includes(v["status"] as string) &&
    isNumber(v["votesFor"]) &&
    isNumber(v["votesAgainst"]) &&
    isString(v["createdAt"]) &&
    isString(v["deadline"])
  );
}

function isProposalComment(v: unknown): v is ProposalComment {
  if (!isObject(v)) return false;
  return (
    isString(v["id"]) &&
    isString(v["proposalId"]) &&
    isString(v["author"]) &&
    isString(v["text"]) &&
    isString(v["createdAt"])
  );
}

function validateProposal(v: unknown): GovernanceProposal {
  if (!isGovernanceProposal(v)) {
    throw new GovernanceValidationError(
      `Invalid GovernanceProposal shape: ${JSON.stringify(v).slice(0, 200)}`
    );
  }
  return v;
}

function validateComment(v: unknown): ProposalComment {
  if (!isProposalComment(v)) {
    throw new GovernanceValidationError(
      `Invalid ProposalComment shape: ${JSON.stringify(v).slice(0, 200)}`
    );
  }
  return v;
}

// ─── Interface ────────────────────────────────────────────────────────────────

export interface GovernanceApi {
  listProposals(filters?: ProposalFilters): Promise<GovernanceProposal[]>;
  getProposal(id: string): Promise<GovernanceProposal | null>;
  listComments(proposalId: string): Promise<ProposalComment[]>;
  postComment(proposalId: string, author: string, text: string): Promise<ProposalComment>;
}

// ─── HTTP adapter ─────────────────────────────────────────────────────────────

export class HttpGovernanceApi implements GovernanceApi {
  async listProposals(filters?: ProposalFilters): Promise<GovernanceProposal[]> {
    const params =
      filters?.status && filters.status !== "all"
        ? `?status=${filters.status}`
        : "";
    const data = await apiFetch<unknown[]>(
      `/api/governance/proposals${params}`
    );
    if (!Array.isArray(data)) {
      throw new GovernanceValidationError("Expected array from /api/governance/proposals");
    }
    return data.map(validateProposal);
  }

  async getProposal(id: string): Promise<GovernanceProposal | null> {
    try {
      const data = await apiFetch<unknown>(`/api/governance/proposals/${encodeURIComponent(id)}`);
      return validateProposal(data);
    } catch (err) {
      // 404 → return null so callers can render "not found" gracefully
      if (
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        (err as { status: number }).status === 404
      ) {
        return null;
      }
      throw err;
    }
  }

  async listComments(proposalId: string): Promise<ProposalComment[]> {
    const data = await apiFetch<unknown[]>(
      `/api/governance/proposals/${encodeURIComponent(proposalId)}/comments`
    );
    if (!Array.isArray(data)) {
      throw new GovernanceValidationError(
        "Expected array from /api/governance/proposals/:id/comments"
      );
    }
    return data.map(validateComment);
  }

  async postComment(
    proposalId: string,
    author: string,
    text: string
  ): Promise<ProposalComment> {
    const sanitized = sanitizeText(text);
    const data = await apiFetch<unknown>(
      `/api/governance/proposals/${encodeURIComponent(proposalId)}/comments`,
      {
        method: "POST",
        body: JSON.stringify({ author, text: sanitized }),
      }
    );
    return validateComment(data);
  }
}

// ─── Mock adapter ─────────────────────────────────────────────────────────────

/** Deterministic seed data — no shared mutable module state between tests. */
const SEED_PROPOSALS: GovernanceProposal[] = [
  {
    id: "VIP-1",
    title: "Adjust Minimum Solver Bond Requirement from 50 to 100 USDC",
    description:
      "Proposal to increase the solver registration bond to strengthen economic security against unfulfilled intents and improve market stability.",
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
    description:
      "Enable routing for Soroban DEX pools to improve fill execution speed and reduce price impact for Stellar native cross-chain swaps.",
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
    description:
      "Introduce automatic bond slashing for solvers missing more than 3 consecutive fill windows without taking inactive status.",
    proposer: "GCCZ1122334455667788990011223344556677889900112233445566",
    category: "Solver Network",
    status: "active",
    votesFor: 89000,
    votesAgainst: 64000,
    createdAt: "2026-08-28T09:00:00Z",
    deadline: "2026-09-12T09:00:00Z",
  },
];

const SEED_COMMENTS: Record<string, ProposalComment[]> = {
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

export class MockGovernanceApi implements GovernanceApi {
  /** Each instance gets its own isolated comment store — no shared state. */
  private readonly commentsStore: Record<string, ProposalComment[]>;

  constructor(seedComments: Record<string, ProposalComment[]> = SEED_COMMENTS) {
    // Deep-clone the seed data so tests remain independent
    this.commentsStore = Object.fromEntries(
      Object.entries(seedComments).map(([key, comments]) => [
        key,
        comments.map((c) => ({ ...c })),
      ])
    );
  }

  async listProposals(filters?: ProposalFilters): Promise<GovernanceProposal[]> {
    if (!filters?.status || filters.status === "all") {
      return [...SEED_PROPOSALS];
    }
    return SEED_PROPOSALS.filter((p) => p.status === filters.status);
  }

  async getProposal(id: string): Promise<GovernanceProposal | null> {
    return (
      SEED_PROPOSALS.find((p) => p.id.toLowerCase() === id.toLowerCase()) ?? null
    );
  }

  async listComments(proposalId: string): Promise<ProposalComment[]> {
    return [...(this.commentsStore[proposalId] ?? [])];
  }

  async postComment(
    proposalId: string,
    author: string,
    text: string
  ): Promise<ProposalComment> {
    const sanitized = sanitizeText(text);
    const comment: ProposalComment = {
      id: `c-mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      proposalId,
      author,
      text: sanitized,
      createdAt: new Date().toISOString(),
    };
    if (!this.commentsStore[proposalId]) {
      this.commentsStore[proposalId] = [];
    }
    this.commentsStore[proposalId]!.push(comment);
    return { ...comment };
  }
}

// ─── Adapter factory ──────────────────────────────────────────────────────────

/** Reads `NEXT_PUBLIC_GOVERNANCE_SOURCE` (or falls back to `NEXT_PUBLIC_API_URL`
 *  presence) to select the adapter.  Production always uses "http". */
export function createGovernanceApi(): GovernanceApi {
  const source =
    (process.env["NEXT_PUBLIC_GOVERNANCE_SOURCE"] as "mock" | "http" | undefined) ??
    (process.env.NODE_ENV === "production" ? "http" : "mock");

  if (source === "http") {
    if (
      process.env.NODE_ENV === "production" &&
      !process.env["NEXT_PUBLIC_API_URL"]
    ) {
      throw new Error(
        "NEXT_PUBLIC_API_URL must be set when NEXT_PUBLIC_GOVERNANCE_SOURCE=http (production)"
      );
    }
    return new HttpGovernanceApi();
  }

  return new MockGovernanceApi();
}
