import { beforeEach, describe, expect, it } from "vitest";
import { getQuarantineDiagnostics, parseFeedItemFrame, resetQuarantine } from "./quarantine";

const valid = {
  id: "i1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "10.5",
  dstToken: "USDC",
  solver: "Al‮pha",
  status: "pending",
  createdAt: "2026-07-14T00:00:00Z",
};

beforeEach(() => resetQuarantine());

describe("parseFeedItemFrame", () => {
  it("accepts a bare FeedItem and sanitizes text fields", () => {
    expect(parseFeedItemFrame(JSON.stringify(valid))).toMatchObject({ id: "i1", solver: "Alpha" });
  });

  it("accepts an intent envelope and strips unknown fields", () => {
    const parsed = parseFeedItemFrame(JSON.stringify({ type: "intent", data: { ...valid, extra: 1 } }));
    expect(parsed).not.toHaveProperty("extra");
  });

  it("ignores unknown message types without quarantining", () => {
    expect(parseFeedItemFrame(JSON.stringify({ type: "ping" }))).toBeNull();
    expect(getQuarantineDiagnostics().invalidCount).toBe(0);
  });

  it.each([
    ["malformed json", "{nope"],
    ["prototype pollution", `{"__proto__":{"x":1},${JSON.stringify(valid).slice(1)}`],
    ["bad status", JSON.stringify({ ...valid, status: "done" })],
    ["numeric amount", JSON.stringify({ ...valid, srcAmount: 10 })],
    ["invalid date", JSON.stringify({ ...valid, createdAt: "yesterday" })],
    ["oversized", JSON.stringify({ ...valid, solver: "a".repeat(70_000) })],
    ["non-string", 42],
  ])("rejects %s and quarantines it", (_label, raw) => {
    expect(parseFeedItemFrame(raw)).toBeNull();
    expect(getQuarantineDiagnostics().invalidCount).toBe(1);
  });

  it("never throws on fuzzed input", () => {
    let seed = 42;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 500; i++) {
      const raw = Array.from({ length: Math.floor(rand() * 64) }, () =>
        String.fromCharCode(Math.floor(rand() * 128)),
      ).join("");
      expect(() => parseFeedItemFrame(raw)).not.toThrow();
    }
    expect(getQuarantineDiagnostics().recent.length).toBeLessThanOrEqual(20);
  });
});
