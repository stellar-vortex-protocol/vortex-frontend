import type { MessageKey } from "@/lib/i18n";
import { fetcher } from "@/lib/api";
import { isValidStellarPublicKey } from "@/lib/stellarAddress";

// Slashing / penalty events. The relay endpoint is not live yet, so the
// assumed contract is documented in docs/solver-portal.md and served by an
// in-browser mock when NEXT_PUBLIC_SLASH_EVENTS_MOCK=true.

export type SlashEvent = {
  id: string;
  solver: string;
  /** Machine reason code; unknown codes are kept verbatim for support. */
  reasonCode: string;
  /** Decimal string in USD to avoid float precision loss. */
  amountUsd: string;
  /** Bond remaining after the penalty, decimal string in USD. */
  resultingBondUsd: string;
  intentId: string | null;
  createdAt: string;
};

export type SlashEventPage = { events: SlashEvent[]; nextCursor: string | null };

const DECIMAL_RE = /^\d+(\.\d+)?$/;

export function isSlashEvent(val: unknown): val is SlashEvent {
  if (typeof val !== "object" || val === null) return false;
  const v = val as Partial<Record<keyof SlashEvent, unknown>>;
  return (
    typeof v.id === "string" &&
    v.id.length > 0 &&
    typeof v.solver === "string" &&
    isValidStellarPublicKey(v.solver) &&
    typeof v.reasonCode === "string" &&
    v.reasonCode.length > 0 &&
    typeof v.amountUsd === "string" &&
    DECIMAL_RE.test(v.amountUsd) &&
    typeof v.resultingBondUsd === "string" &&
    DECIMAL_RE.test(v.resultingBondUsd) &&
    (v.intentId === null || typeof v.intentId === "string") &&
    typeof v.createdAt === "string" &&
    !Number.isNaN(Date.parse(v.createdAt))
  );
}

export function isSlashEventPage(val: unknown): val is SlashEventPage {
  if (typeof val !== "object" || val === null) return false;
  const v = val as Partial<Record<keyof SlashEventPage, unknown>>;
  return (
    Array.isArray(v.events) &&
    v.events.every(isSlashEvent) &&
    (v.nextCursor === null || typeof v.nextCursor === "string")
  );
}

// ── Reason-code registry ────────────────────────────────────────────────────

export const REASON_CODES = ["missed_deadline", "invalid_fill", "downtime", "double_accept"] as const;
export type ReasonCode = (typeof REASON_CODES)[number];

type ReasonEntry = { label: MessageKey; explanation: MessageKey; remediation: MessageKey };

export const REASON_REGISTRY: Record<ReasonCode, ReasonEntry> = {
  missed_deadline: {
    label: "slash.reason.missed_deadline.label",
    explanation: "slash.reason.missed_deadline.explanation",
    remediation: "slash.reason.missed_deadline.remediation",
  },
  invalid_fill: {
    label: "slash.reason.invalid_fill.label",
    explanation: "slash.reason.invalid_fill.explanation",
    remediation: "slash.reason.invalid_fill.remediation",
  },
  downtime: {
    label: "slash.reason.downtime.label",
    explanation: "slash.reason.downtime.explanation",
    remediation: "slash.reason.downtime.remediation",
  },
  double_accept: {
    label: "slash.reason.double_accept.label",
    explanation: "slash.reason.double_accept.explanation",
    remediation: "slash.reason.double_accept.remediation",
  },
};

const UNKNOWN_REASON: ReasonEntry = {
  label: "slash.reason.unknown.label",
  explanation: "slash.reason.unknown.explanation",
  remediation: "slash.reason.unknown.remediation",
};

export function reasonInfo(code: string): ReasonEntry & { known: boolean } {
  const entry = (REASON_REGISTRY as Record<string, ReasonEntry | undefined>)[code];
  return entry ? { ...entry, known: true } : { ...UNKNOWN_REASON, known: false };
}

// ── Pure helpers ───────────────────────────────────────────────────────────

/** De-duplicate by id and sort newest first (events may arrive out of order). */
export function normalizeEvents(events: SlashEvent[]): SlashEvent[] {
  const byId = new Map<string, SlashEvent>();
  for (const e of events) byId.set(e.id, e);
  return Array.from(byId.values()).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Group events by UTC day (YYYY-MM-DD), newest day first. */
export function groupEventsByDay(events: SlashEvent[]): Array<{ day: string; events: SlashEvent[] }> {
  const groups = new Map<string, SlashEvent[]>();
  for (const e of normalizeEvents(events)) {
    const day = new Date(e.createdAt).toISOString().slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }
  return Array.from(groups.entries()).map(([day, evs]) => ({ day, events: evs }));
}

function sumUsd(values: string[]): string {
  const cents = values.reduce((acc, v) => {
    const [whole = "0", frac = ""] = v.split(".");
    return acc + BigInt(whole) * BigInt(100) + BigInt((frac + "00").slice(0, 2));
  }, BigInt(0));
  const c = (cents % BigInt(100)).toString().padStart(2, "0");
  return `${cents / BigInt(100)}.${c}`;
}

export type PenaltySummary = {
  count: number;
  totalUsd: string;
  /** Count change vs. the preceding window of equal length. */
  trend: "up" | "down" | "flat";
};

export function summarizePenalties(events: SlashEvent[], days: number, now: number = Date.now()): PenaltySummary {
  const span = days * 86_400_000;
  const current = events.filter((e) => now - Date.parse(e.createdAt) < span);
  const previous = events.filter((e) => {
    const age = now - Date.parse(e.createdAt);
    return age >= span && age < 2 * span;
  });
  return {
    count: current.length,
    totalUsd: sumUsd(current.map((e) => e.amountUsd)),
    trend: current.length > previous.length ? "up" : current.length < previous.length ? "down" : "flat",
  };
}

// ── Adapter ────────────────────────────────────────────────────────────────

export const SLASH_EVENTS_MOCK = process.env["NEXT_PUBLIC_SLASH_EVENTS_MOCK"] === "true";

export function slashEventsPath(solver: string | null, cursor: string | null): string {
  const params = new URLSearchParams();
  if (solver) params.set("solver", solver);
  if (cursor) params.set("cursor", cursor);
  const qs = params.toString();
  return `/slash-events${qs ? `?${qs}` : ""}`;
}

const MOCK_SOLVER = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7";

function mockPage(solver: string | null, cursor: string | null): SlashEventPage {
  const page = cursor ? Number(cursor) : 0;
  const now = Date.now();
  const events: SlashEvent[] = Array.from({ length: 5 }, (_, i) => {
    const n = page * 5 + i;
    return {
      id: `mock-slash-${n}`,
      solver: solver ?? MOCK_SOLVER,
      reasonCode: [...REASON_CODES, "rate_limit_abuse"][n % 5]!,
      amountUsd: `${(n + 1) * 125}.50`,
      resultingBondUsd: `${50_000 - (n + 1) * 125}.00`,
      intentId: n % 3 === 0 ? null : `intent-${1000 + n}`,
      createdAt: new Date(now - n * 16 * 3_600_000).toISOString(),
    };
  });
  return { events, nextCursor: page < 2 ? String(page + 1) : null };
}

export async function fetchSlashEvents(solver: string | null, cursor: string | null): Promise<SlashEventPage> {
  const data: unknown = SLASH_EVENTS_MOCK
    ? mockPage(solver, cursor)
    : await fetcher<unknown>(slashEventsPath(solver, cursor));
  if (!isSlashEventPage(data)) throw new Error("Invalid slash event response");
  return data;
}
