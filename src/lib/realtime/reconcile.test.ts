import { describe, expect, it } from "vitest";
import { reconcile } from "./reconcile";
import type { FeedItem } from "@/lib/types";

const base: FeedItem = {
  id: "i1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "10",
  dstToken: "USDC",
  solver: "Alpha",
  status: "pending",
  createdAt: "2026-07-14T00:00:00Z",
};

describe("reconcile", () => {
  it("returns incoming when there is no current record", () => {
    expect(reconcile(undefined, base)).toBe(base);
  });

  it("applies forward status transitions", () => {
    expect(reconcile(base, { ...base, status: "filled" }).status).toBe("filled");
  });

  it("rejects status regressions", () => {
    expect(reconcile({ ...base, status: "filled" }, base).status).toBe("filled");
  });

  it("never flips between terminal states", () => {
    expect(reconcile({ ...base, status: "filled" }, { ...base, status: "failed" }).status).toBe("filled");
  });

  it("drops out-of-order frames by version", () => {
    const current = { ...base, status: "accepted" as const, version: 3, solver: "New" };
    expect(reconcile(current, { ...base, version: 2, solver: "Old" })).toBe(current);
  });

  it("falls back to updatedAt when no version is present", () => {
    const current = { ...base, updatedAt: "2026-07-14T00:05:00Z", solver: "New" };
    expect(reconcile(current, { ...base, updatedAt: "2026-07-14T00:01:00Z", solver: "Old" })).toBe(current);
  });

  it("merges fields so richer payloads are kept", () => {
    const detail = { ...base, txHash: "0xabc" };
    expect(reconcile(detail, { ...base, status: "accepted" })).toMatchObject({ txHash: "0xabc", status: "accepted" });
  });
});
