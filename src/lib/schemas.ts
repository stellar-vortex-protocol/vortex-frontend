import { sanitizeDisplayText } from "./textSafety";
import type {
  Quote,
  FeedItem,
  IntentDetail,
  Solver,
  CreateIntentResponse,
  SubmitIntentResponse,
  RegisterSolverResponse,
  SubmitRegistrationResponse,
} from "./types";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

function isString(val: unknown): val is string {
  return typeof val === "string";
}

function isNumber(val: unknown): val is number {
  return typeof val === "number" && !isNaN(val);
}

function isBoolean(val: unknown): val is boolean {
  return typeof val === "boolean";
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

function isArray(val: unknown): val is unknown[] {
  return Array.isArray(val);
}

export function isQuote(val: unknown): val is Quote {
  if (!isObject(val)) return false;
  return (
    isString(val.dstAmount) &&
    isString(val.solver) &&
    isNumber(val.fillTimeSeconds) &&
    isNumber(val.priceImpactPct) &&
    isNumber(val.protocolFeePct) &&
    isString(val.rate)
  );
}

export function isFeedItem(val: unknown): val is FeedItem {
  if (!isObject(val)) return false;
  return (
    isString(val.id) &&
    isString(val.srcChain) &&
    isString(val.srcToken) &&
    isString(val.srcAmount) &&
    isString(val.dstToken) &&
    isString(val.solver) &&
    isString(val.status) &&
    ["pending", "accepted", "filled", "failed"].includes(val.status as string) &&
    isString(val.createdAt) &&
    (val.deadline === undefined || isString(val.deadline))
  );
}

export function isFeedItemArray(val: unknown): val is FeedItem[] {
  return isArray(val) && val.every(isFeedItem);
}

export function isIntentDetail(val: unknown): val is IntentDetail {
  if (!isFeedItem(val)) return false;
  if (!isObject(val)) return false;
  return (
    isString(val.dstAmount) &&
    isString(val.minOut) &&
    isString(val.dstAddress) &&
    isString(val.deadline) &&
    (val.txHash === undefined || isString(val.txHash))
  );
}

export function isSolver(val: unknown): val is Solver {
  if (!isObject(val)) return false;
  return (
    isString(val.name) &&
    isString(val.address) &&
    isNumber(val.bondUsd) &&
    isNumber(val.fills) &&
    isNumber(val.failed) &&
    isNumber(val.volumeUsd) &&
    isNumber(val.avgFillTimeSeconds) &&
    isNumber(val.successRatePct) &&
    isArray(val.chains) &&
    (val.chains as unknown[]).every(isString) &&
    isString(val.status) &&
    ["active", "inactive"].includes(val.status as string)
  );
}

export function isSolverArray(val: unknown): val is Solver[] {
  return isArray(val) && val.every(isSolver);
}

export function isCreateIntentResponse(val: unknown): val is CreateIntentResponse {
  if (!isObject(val)) return false;
  return isString(val.intentId) && isString(val.unsignedXdr);
}

export function isSubmitIntentResponse(val: unknown): val is SubmitIntentResponse {
  if (!isObject(val)) return false;
  return (
    isString(val.intentId) &&
    isString(val.status) &&
    ["pending", "accepted", "filled", "failed"].includes(val.status as string)
  );
}

export function isRegisterSolverResponse(val: unknown): val is RegisterSolverResponse {
  if (!isObject(val)) return false;
  return isString(val.registrationId) && isString(val.unsignedXdr);
}

export function isSubmitRegistrationResponse(val: unknown): val is SubmitRegistrationResponse {
  if (!isObject(val)) return false;
  return (
    isString(val.registrationId) &&
    isString(val.status) &&
    ["active", "pending"].includes(val.status as string)
  );
}

// ── WebSocket frame validation (#433) ───────────────────────────────────────

export const MAX_FRAME_BYTES = 64 * 1024;
const FORBIDDEN_KEYS = ["__proto__", "constructor", "prototype"];
const FEED_ITEM_KEYS = [
  "id",
  "srcChain",
  "srcToken",
  "srcAmount",
  "dstToken",
  "solver",
  "status",
  "createdAt",
  "deadline",
  "version",
  "updatedAt",
] as const;

function isIsoDate(val: unknown): boolean {
  return isString(val) && !Number.isNaN(Date.parse(val));
}

function isAmount(val: unknown): boolean {
  return isString(val) && /^\d+(\.\d+)?$/.test(val);
}

export type FrameRejection = "oversized" | "json" | "forbidden-key" | "unknown-type" | "shape";

export type FrameResult =
  | { ok: true; item: FeedItem }
  | { ok: false; reason: FrameRejection };

/**
 * Validate one raw WebSocket frame into a sanitized FeedItem. Frames may be a
 * bare FeedItem or an envelope `{ type: "intent", data: FeedItem }`; any other
 * `type` is ignored. Never throws. Unknown fields are stripped and text fields
 * pass through `sanitizeDisplayText` here, at the boundary.
 */
export function validateFeedItemFrame(raw: unknown): FrameResult {
  if (typeof raw !== "string") return { ok: false, reason: "shape" };
  if (new Blob([raw]).size > MAX_FRAME_BYTES) return { ok: false, reason: "oversized" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw, (key, value: unknown) => {
      if (FORBIDDEN_KEYS.includes(key)) throw new ForbiddenKeyError();
      return value;
    });
  } catch (err) {
    return { ok: false, reason: err instanceof ForbiddenKeyError ? "forbidden-key" : "json" };
  }

  let candidate: unknown = parsed;
  if (isObject(parsed) && "type" in parsed) {
    if (parsed.type !== "intent") return { ok: false, reason: "unknown-type" };
    candidate = parsed.data;
  }

  if (
    !isFeedItem(candidate) ||
    !isAmount(candidate.srcAmount) ||
    !isIsoDate(candidate.createdAt) ||
    (candidate.deadline !== undefined && !isIsoDate(candidate.deadline)) ||
    (candidate.updatedAt !== undefined && !isIsoDate(candidate.updatedAt)) ||
    (candidate.version !== undefined && !isNumber(candidate.version))
  ) {
    return { ok: false, reason: "shape" };
  }

  const item: Record<string, unknown> = {};
  for (const key of FEED_ITEM_KEYS) {
    const value = candidate[key];
    if (value === undefined) continue;
    item[key] = typeof value === "string" ? sanitizeDisplayText(value) : value;
  }
  return { ok: true, item: item as FeedItem };
}

class ForbiddenKeyError extends Error {}
