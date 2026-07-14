export type Chain = {
  id: string;
  name: string;
  shortName: string;
  color: string;
};

export type Token = {
  symbol: string;
  decimals: number;
  priceUsd: number;
  contract?: string;
};

export type QuoteRequest = {
  srcChain: string;
  srcToken: string;
  srcAmount: string;
  dstToken: string;
};

export type Quote = {
  dstAmount: string;
  solver: string;
  fillTimeSeconds: number;
  priceImpactPct: number;
  protocolFeePct: number;
  rate: string;
};

export type IntentStatus = "pending" | "accepted" | "filled" | "failed";

export type FeedItem = {
  id: string;
  srcChain: string;
  srcToken: string;
  srcAmount: string;
  dstToken: string;
  solver: string;
  status: IntentStatus;
  createdAt: string;
};

export type IntentDetail = FeedItem & {
  dstAmount: string;
  minOut: string;
  dstAddress: string;
  deadline: string;
  txHash?: string;
};

export type OpenIntent = {
  id: string;
  srcChain: string;
  srcToken: string;
  srcAmount: string;
  dstToken: string;
  minOut: string;
  deadline: string;
};

export type CreateIntentRequest = {
  srcChain: string;
  srcToken: string;
  srcAmount: string;
  dstToken: string;
  dstAddress: string;
};

export type CreateIntentResponse = {
  intentId: string;
  unsignedXdr: string;
};

export type SubmitIntentResponse = {
  intentId: string;
  status: IntentStatus;
};

export type Solver = {
  name: string;
  address: string;
  bondUsd: number;
  fills: number;
  failed: number;
  volumeUsd: number;
  avgFillTimeSeconds: number;
  successRatePct: number;
  chains: string[];
  status: "active" | "inactive";
};
