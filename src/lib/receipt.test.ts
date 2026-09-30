import { describe, expect, it } from "vitest";
import type { IntentDetail } from "@/lib/types";
import { buildReceipt, receiptToText } from "./receipt";

const intent: IntentDetail = {
  id: "intent-1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "1234.5",
  dstToken: "XLM",
  dstAmount: "10000",
  minOut: "9900",
  dstAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ234567ABCDEFGHIJKLMNOPQRSTUVW",
  solver: "alpha",
  status: "filled",
  createdAt: "2026-01-02T10:00:00.000Z",
  deadline: "2026-01-02T11:00:00.000Z",
  txHash: "deadbeef",
};

const value = (label: string, r = buildReceipt(intent, "en-US", "testnet")) => r.lines.find((l) => l.label === label)?.value;

describe("buildReceipt", () => {
  it("formats amounts per locale", () => {
    expect(value("Sent")).toBe("1,234.5 USDC");
    expect(value("Sent", buildReceipt(intent, "de-DE", "testnet"))).toBe("1.234,5 USDC");
  });

  it("includes the explorer link and tx hash", () => {
    const r = buildReceipt(intent, "en-US", "public");
    expect(r.explorerUrl).toBe("https://stellar.expert/explorer/public/tx/deadbeef");
    expect(value("Transaction hash", r)).toBe("deadbeef");
  });

  it("shows UTC alongside local time", () => {
    expect(value("Submitted")).toMatch(/^2026-01-02T10:00:00Z UTC \(/);
  });

  it("handles a missing dstAmount and txHash", () => {
    const { txHash: _txHash, ...rest } = intent;
    const r = buildReceipt({ ...rest, dstAmount: "" }, "en-US", "testnet");
    expect(value("Received", r)).toBe("—");
    expect(value("Improvement over minimum", r)).toBe("—");
    expect(r.explorerUrl).toBeNull();
  });

  it("renders a plain-text receipt with the disclaimer", () => {
    const text = receiptToText(buildReceipt(intent, "en-US", "testnet"));
    expect(text).toContain("intent-1");
    expect(text).toContain("On-chain data is authoritative");
  });
});
