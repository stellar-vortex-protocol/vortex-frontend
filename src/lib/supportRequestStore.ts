import { CHAINS, DST_TOKENS, SRC_TOKENS } from "./marketData";
import { sanitizeDisplayText } from "./textSafety";

/**
 * Community chain/token support requests with one upvote per wallet.
 *
 * PENDING_BACKEND_ENDPOINTS:
 * Like `governanceStore.ts` (#38), this is a temporary in-memory mock store
 * standing in for future backend endpoints. Data resets on reload and isn't
 * shared between users:
 * - GET  /api/support-requests
 * - POST /api/support-requests
 * - POST /api/support-requests/:id/upvote
 *
 * It gathers community signal only: nothing here adds a chain or token to
 * `marketData.ts`.
 */

export type SupportRequestKind = "chain" | "token";

export type SupportRequest = {
  id: string;
  kind: SupportRequestKind;
  name: string;
  justification: string;
  requester: string;
  createdAt: string;
  /** Wallet addresses that upvoted; one entry per wallet. */
  upvoters: string[];
};

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 40;
export const JUSTIFICATION_MIN_LENGTH = 10;
export const JUSTIFICATION_MAX_LENGTH = 280;

export type SubmitError =
  | "name-length"
  | "justification-length"
  | "already-supported"
  | "duplicate";

export type SubmitResult =
  | { ok: true; request: SupportRequest }
  | { ok: false; error: SubmitError; existingId?: string };

export type UpvoteResult =
  | { ok: true; request: SupportRequest }
  | { ok: false; error: "not-found" | "already-upvoted" };

const INITIAL_REQUESTS: SupportRequest[] = [
  {
    id: "req-1",
    kind: "chain",
    name: "BNB Chain",
    justification: "Large stablecoin volume and many users who already bridge to Stellar manually.",
    requester: "GAAX8890123456789012345678901234567890123456789012345678",
    createdAt: "2026-08-20T10:00:00Z",
    upvoters: ["GAAX8890123456789012345678901234567890123456789012345678", "GBBY3456789012345678901234567890123456789012345678901234"],
  },
  {
    id: "req-2",
    kind: "token",
    name: "DAI",
    justification: "A decentralised stablecoin option alongside USDC and USDT on the EVM chains.",
    requester: "GCCZ1122334455667788990011223344556677889900112233445566",
    createdAt: "2026-08-22T15:30:00Z",
    upvoters: ["GCCZ1122334455667788990011223344556677889900112233445566"],
  },
];

let requests: SupportRequest[] = structuredClone(INITIAL_REQUESTS);

/** Restores the seed data. For tests. */
export function resetSupportRequests(): void {
  requests = structuredClone(INITIAL_REQUESTS);
}

/** Case-, space- and punctuation-insensitive comparison key. */
export function normalizeName(name: string): string {
  return sanitizeDisplayText(name).toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Whether a chain or token with this name is already in `marketData.ts`. */
export function isAlreadySupported(kind: SupportRequestKind, name: string): boolean {
  const key = normalizeName(name);
  if (!key) return false;
  if (kind === "chain") {
    return CHAINS.some((c) => [c.id, c.name, c.shortName].some((n) => normalizeName(n) === key));
  }
  const symbols = [
    ...Object.values(SRC_TOKENS).flatMap((tokens) => tokens.map((t) => t.symbol)),
    ...DST_TOKENS.map((t) => t.symbol),
  ];
  return symbols.some((s) => normalizeName(s) === key);
}

/** Requests sorted by upvote count (most first), oldest first on ties. */
export function getSupportRequests(): SupportRequest[] {
  return [...requests].sort(
    (a, b) => b.upvoters.length - a.upvoters.length || a.createdAt.localeCompare(b.createdAt),
  );
}

export function submitSupportRequest(
  requester: string,
  input: { kind: SupportRequestKind; name: string; justification: string },
): SubmitResult {
  const name = sanitizeDisplayText(input.name).trim();
  const justification = sanitizeDisplayText(input.justification).trim();

  if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    return { ok: false, error: "name-length" };
  }
  if (justification.length < JUSTIFICATION_MIN_LENGTH || justification.length > JUSTIFICATION_MAX_LENGTH) {
    return { ok: false, error: "justification-length" };
  }
  if (isAlreadySupported(input.kind, name)) {
    return { ok: false, error: "already-supported" };
  }
  const existing = requests.find(
    (r) => r.kind === input.kind && normalizeName(r.name) === normalizeName(name),
  );
  if (existing) {
    return { ok: false, error: "duplicate", existingId: existing.id };
  }

  const request: SupportRequest = {
    id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    kind: input.kind,
    name,
    justification,
    requester,
    createdAt: new Date().toISOString(),
    // Submitting counts as the requester's own upvote.
    upvoters: [requester],
  };
  requests.push(request);
  return { ok: true, request };
}

export function upvoteSupportRequest(id: string, voter: string): UpvoteResult {
  const request = requests.find((r) => r.id === id);
  if (!request) return { ok: false, error: "not-found" };
  if (request.upvoters.includes(voter)) return { ok: false, error: "already-upvoted" };
  request.upvoters.push(voter);
  return { ok: true, request };
}
