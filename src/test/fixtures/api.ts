// Shared API fixtures used by schema contract tests and fetch/MSW mocks.
import type { FeedItem, IntentDetail, OpenIntent, Quote, Solver } from "@/lib/types";

export const STRKEY = "GBRPYHIL2CI3WHZDTOOQFC6EB4RBWDUYCV45VQ3XMJLYPUFZTBMHK323";

export const feedItem: FeedItem = {
  id: "int_1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500.25",
  dstToken: "XLM",
  solver: "AlphaMax",
  status: "pending",
  createdAt: "2024-01-01T00:00:00Z",
};

export const intentDetail: IntentDetail = {
  ...feedItem,
  dstAmount: "4230.1",
  minOut: "4200",
  dstAddress: STRKEY,
  deadline: "2024-01-01T01:00:00.000+00:00",
};

export const openIntent: OpenIntent = {
  id: "int_2",
  srcChain: "base",
  srcToken: "USDC",
  srcAmount: "10",
  dstToken: "XLM",
  minOut: "80",
  deadline: "2024-01-01T01:00:00Z",
};

export const solver: Solver = {
  name: "Ålpha Solver ☄️",
  address: STRKEY,
  bondUsd: 5000,
  fills: 10,
  failed: 1,
  volumeUsd: 12345,
  avgFillTimeSeconds: 30,
  successRatePct: 90.9,
  chains: ["stellar"],
  status: "active",
};

export const quote: Quote = {
  dstAmount: "497.12",
  solver: "AlphaMax",
  fillTimeSeconds: 30,
  priceImpactPct: 0.1,
  protocolFeePct: 0.05,
  rate: "1 USDC = 8.46 XLM",
};

/** Minimal Response-like object for stubbing global fetch. */
export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: String(status),
    headers: new Headers(headers),
    json: async () => body,
    text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
  };
}
