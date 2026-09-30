import { beforeEach, describe, expect, it } from "vitest";
import {
  getSupportRequests,
  isAlreadySupported,
  JUSTIFICATION_MAX_LENGTH,
  resetSupportRequests,
  submitSupportRequest,
  upvoteSupportRequest,
} from "./supportRequestStore";

const ALICE = "GALICE";
const BOB = "GBOB";
const WHY = "Lots of users hold it already.";

describe("supportRequestStore", () => {
  beforeEach(() => {
    resetSupportRequests();
  });

  it("detects chains and tokens that are already supported, ignoring case and punctuation", () => {
    expect(isAlreadySupported("chain", "ethereum")).toBe(true);
    expect(isAlreadySupported("chain", " Arbitrum ")).toBe(true);
    expect(isAlreadySupported("chain", "ETH")).toBe(true);
    expect(isAlreadySupported("token", "usdc")).toBe(true);
    expect(isAlreadySupported("token", "yXLM")).toBe(true);
    expect(isAlreadySupported("chain", "Solana")).toBe(false);
    expect(isAlreadySupported("token", "DAI")).toBe(false);
  });

  it("rejects a request for something already supported", () => {
    expect(submitSupportRequest(ALICE, { kind: "chain", name: "Base", justification: WHY })).toEqual({
      ok: false,
      error: "already-supported",
    });
  });

  it("rejects a near-duplicate of an existing request and points to it", () => {
    const result = submitSupportRequest(ALICE, { kind: "chain", name: "bnb-chain", justification: WHY });
    expect(result).toEqual({ ok: false, error: "duplicate", existingId: "req-1" });
  });

  it("enforces name and justification limits", () => {
    expect(submitSupportRequest(ALICE, { kind: "chain", name: "S", justification: WHY })).toMatchObject({
      error: "name-length",
    });
    expect(submitSupportRequest(ALICE, { kind: "chain", name: "Solana", justification: "short" })).toMatchObject({
      error: "justification-length",
    });
    expect(
      submitSupportRequest(ALICE, {
        kind: "chain",
        name: "Solana",
        justification: "x".repeat(JUSTIFICATION_MAX_LENGTH + 1),
      }),
    ).toMatchObject({ error: "justification-length" });
  });

  it("strips invisible/bidi characters from submitted text", () => {
    const result = submitSupportRequest(ALICE, {
      kind: "chain",
      name: "Sol​ana",
      justification: `‮${WHY}`,
    });
    expect(result).toMatchObject({ ok: true, request: { name: "Solana", justification: WHY } });
  });

  it("counts the submitter's upvote and allows one upvote per wallet", () => {
    const created = submitSupportRequest(ALICE, { kind: "token", name: "PYUSD", justification: WHY });
    if (!created.ok) throw new Error("submit failed");
    expect(created.request.upvoters).toEqual([ALICE]);

    expect(upvoteSupportRequest(created.request.id, ALICE)).toEqual({ ok: false, error: "already-upvoted" });
    expect(upvoteSupportRequest(created.request.id, BOB)).toMatchObject({ ok: true });
    expect(upvoteSupportRequest(created.request.id, BOB)).toEqual({ ok: false, error: "already-upvoted" });
    expect(upvoteSupportRequest("missing", BOB)).toEqual({ ok: false, error: "not-found" });
  });

  it("sorts requests by upvote count", () => {
    expect(getSupportRequests().map((r) => r.id)).toEqual(["req-1", "req-2"]);
    upvoteSupportRequest("req-2", ALICE);
    upvoteSupportRequest("req-2", BOB);
    expect(getSupportRequests().map((r) => r.id)).toEqual(["req-2", "req-1"]);
  });
});
