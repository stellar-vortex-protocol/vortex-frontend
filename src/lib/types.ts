export type Chain = {
  id: string;
  name: string;
  shortName: string;
  color: string;
};

export type Token = {
  symbol: string;
  name?: string;
  decimals: number;
  priceUsd: number;
  contract?: string;
  issuer?: string;
};

export type QuoteRequest = {
  srcChain: string;
  srcToken: string;
  srcAmount: string;
  dstToken: string;
  minOut?: string | undefined;
};

export type QuoteErrorType =
  | { kind: "no-solver"; message?: string }
  | { kind: "generic"; message: string };

export type Quote = {
  dstAmount: string;
  solver: string;
  fillTimeSeconds: number;
  priceImpactPct: number;
  protocolFeePct: number;
  rate: string;
  expiresAt?: string | number;
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
  deadline?: string;
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
  /** USD value of `srcAmount` when the relay can price it (optional). */
  usdValue?: number;
};

export type CreateIntentRequest = {
  srcChain: string;
  srcToken: string;
  srcAmount: string;
  dstToken: string;
  minOut?: string | undefined;
  dstAddress: string;
  memo?: string;
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
  /** Rank in the previous period for the requested window, when the relay provides it. */
  previousRank?: number;
  /** Relay-side verification flag (display only — never used for authorization). */
  verified?: boolean;
  /** Home domain claimed by the solver; verified client-side via stellar.toml. */
  homeDomain?: string;
};

export type RegisterSolverRequest = {
  address: string;
  bondUsd: number;
};

export type RegisterSolverResponse = {
  registrationId: string;
  unsignedXdr: string;
};

export type SubmitRegistrationResponse = {
  registrationId: string;
  status: "active" | "pending";
};
