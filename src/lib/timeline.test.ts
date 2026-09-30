import { describe, expect, it } from "vitest";
import { buildTimeline, formatDuration } from "./timeline";
import { explorerUrl } from "./explorerLinks";
import { buildIntentSummary, intentToJson, redactForExport } from "./intentExport";
import type { IntentDetail } from "./types";

const base: IntentDetail = {
  id: "i-1",
  srcChain: "base",
  srcToken: "USDC",
  srcAmount: "100",
  dstToken: "XLM",
  dstAmount: "800",
  minOut: "790",
  dstAddress: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
  solver: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
  status: "pending",
  createdAt: "2026-01-01T00:00:00Z",
  deadline: "2026-01-01T00:10:00Z",
};

const states = (intent: IntentDetail) => buildTimeline(intent).map((s) => `${s.key}:${s.state}`);

describe("buildTimeline", () => {
  it("pending: created is current, the rest upcoming", () => {
    expect(states(base)).toEqual(["created:current", "accepted:upcoming", "submitted:upcoming", "filled:upcoming"]);
  });

  it("accepted: shows the solver on the accepted step", () => {
    const steps = buildTimeline({ ...base, status: "accepted", acceptedAt: "2026-01-01T00:00:30Z" });
    expect(steps.map((s) => s.state)).toEqual(["done", "current", "upcoming", "upcoming"]);
    expect(steps[1]?.solver).toBe(base.solver);
    expect(steps[1]?.durationMs).toBeNull();
  });

  it("filled: all done with durations between steps", () => {
    const steps = buildTimeline({
      ...base,
      status: "filled",
      acceptedAt: "2026-01-01T00:00:30Z",
      submittedAt: "2026-01-01T00:01:00Z",
      filledAt: "2026-01-01T00:03:00Z",
    });
    expect(steps.every((s) => s.state === "done")).toBe(true);
    expect(steps.map((s) => s.durationMs)).toEqual([null, 30_000, 30_000, 120_000]);
  });

  it("filled with missing timestamps: duration spans from the last known step", () => {
    const steps = buildTimeline({ ...base, status: "filled", filledAt: "2026-01-01T00:02:00Z" });
    expect(steps.map((s) => s.at)).toEqual([base.createdAt, null, null, "2026-01-01T00:02:00Z"]);
    expect(steps[3]?.durationMs).toBe(120_000);
  });

  it("failed before acceptance: middle steps skipped", () => {
    expect(states({ ...base, status: "failed", failedAt: "2026-01-01T00:10:00Z" })).toEqual([
      "created:done",
      "accepted:skipped",
      "submitted:skipped",
      "failed:done",
    ]);
  });

  it("ignores unparseable timestamps", () => {
    expect(buildTimeline({ ...base, createdAt: "not a date" })[0]?.at).toBeNull();
  });

  it.each([
    [45_000, "45s"],
    [192_000, "3m 12s"],
    [7_500_000, "2h 5m"],
    [90_000_000, "1d 1h"],
  ])("formatDuration(%i) = %s", (ms, label) => {
    expect(formatDuration(ms)).toBe(label);
  });
});

describe("explorerUrl", () => {
  const hash = "a".repeat(64);
  it.each([
    ["tx", hash, "testnet", `https://stellar.expert/explorer/testnet/tx/${hash}`],
    ["tx", hash, "MAINNET", `https://stellar.expert/explorer/public/tx/${hash}`],
    ["account", base.dstAddress, "public", `https://stellar.expert/explorer/public/account/${base.dstAddress}`],
    ["tx", hash, "unknownnet", null],
    ["tx", "not-a-hash", "testnet", null],
    ["account", "javascript:alert(1)", "testnet", null],
    ["contract", "CABC123", "testnet", "https://stellar.expert/explorer/testnet/contract/CABC123"],
    ["account", "G ABC", "testnet", null],
  ] as const)("%s %s on %s", (entity, value, network, expected) => {
    expect(explorerUrl(entity, value, network)).toBe(expected);
  });
});

describe("intent exports", () => {
  const withSecrets = { ...base, signedXdr: "AAAA", nested: { unsignedXdr: "BBBB", note: "a‮b" } };

  it("redacts XDR keys deeply and strips bidi characters", () => {
    expect(redactForExport(withSecrets)).toMatchObject({ nested: { note: "ab" } });
    expect(JSON.stringify(redactForExport(withSecrets))).not.toMatch(/Xdr|AAAA|BBBB/);
    expect(intentToJson(withSecrets as IntentDetail)).not.toContain("AAAA");
  });

  it("builds a readable summary without empty lines", () => {
    const summary = buildIntentSummary({ ...base, status: "filled", txHash: "abc" });
    expect(summary).toContain("Intent: i-1");
    expect(summary).toContain("Settlement tx: abc");
    expect(summary).not.toContain("Failed:");
  });
});
