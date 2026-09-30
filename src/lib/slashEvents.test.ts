import { describe, expect, it, vi } from "vitest";

const { fetcherMock } = vi.hoisted(() => ({ fetcherMock: vi.fn() }));
// api.ts is mocked so these tests exercise only the adapter logic.
vi.mock("@/lib/api", () => ({ fetcher: fetcherMock }));
import {
  fetchSlashEvents,
  groupEventsByDay,
  isSlashEvent,
  isSlashEventPage,
  normalizeEvents,
  reasonInfo,
  slashEventsPath,
  summarizePenalties,
  type SlashEvent,
} from "./slashEvents";

const SOLVER = "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB";

function ev(overrides: Partial<SlashEvent>): SlashEvent {
  return {
    id: "e1",
    solver: SOLVER,
    reasonCode: "missed_deadline",
    amountUsd: "10.50",
    resultingBondUsd: "489.50",
    intentId: "intent-1",
    createdAt: "2025-06-10T12:00:00Z",
    ...overrides,
  };
}

describe("isSlashEvent", () => {
  it("accepts a valid event", () => {
    expect(isSlashEvent(ev({}))).toBe(true);
    expect(isSlashEvent(ev({ intentId: null }))).toBe(true);
  });

  it.each([
    ["null", null],
    ["bad solver", ev({ solver: "GBAD" })],
    ["float amount", { ...ev({}), amountUsd: 10.5 }],
    ["negative amount", ev({ amountUsd: "-1" })],
    ["empty code", ev({ reasonCode: "" })],
    ["bad date", ev({ createdAt: "nope" })],
    ["missing id", ev({ id: "" })],
  ])("rejects %s", (_, value) => {
    expect(isSlashEvent(value)).toBe(false);
  });

  it("validates pages", () => {
    expect(isSlashEventPage({ events: [ev({})], nextCursor: null })).toBe(true);
    expect(isSlashEventPage({ events: [{}], nextCursor: null })).toBe(false);
    expect(isSlashEventPage({ events: [], nextCursor: 1 })).toBe(false);
  });
});

describe("reason registry", () => {
  it("maps known codes and falls back for unknown ones", () => {
    expect(reasonInfo("downtime")).toMatchObject({ known: true, label: "slash.reason.downtime.label" });
    expect(reasonInfo("weird_code")).toMatchObject({ known: false, label: "slash.reason.unknown.label" });
  });
});

describe("ordering and grouping", () => {
  it("dedupes and sorts out-of-order events newest first", () => {
    const events = [
      ev({ id: "a", createdAt: "2025-06-09T10:00:00Z" }),
      ev({ id: "b", createdAt: "2025-06-10T10:00:00Z" }),
      ev({ id: "a", createdAt: "2025-06-09T10:00:00Z" }),
    ];
    expect(normalizeEvents(events).map((e) => e.id)).toEqual(["b", "a"]);
    expect(groupEventsByDay(events).map((g) => g.day)).toEqual(["2025-06-10", "2025-06-09"]);
  });
});

describe("summarizePenalties", () => {
  const now = Date.parse("2025-06-30T00:00:00Z");

  it("sums large amounts exactly and reports trend", () => {
    const summary = summarizePenalties(
      [
        ev({ id: "1", amountUsd: "99999999999999999.99", createdAt: "2025-06-29T00:00:00Z" }),
        ev({ id: "2", amountUsd: "0.01", createdAt: "2025-06-20T00:00:00Z" }),
        ev({ id: "3", createdAt: "2025-05-20T00:00:00Z" }),
      ],
      30,
      now,
    );
    expect(summary).toEqual({ count: 2, totalUsd: "100000000000000000.00", trend: "up" });
  });

  it("handles empty history", () => {
    expect(summarizePenalties([], 30, now)).toEqual({ count: 0, totalUsd: "0.00", trend: "flat" });
  });
});

describe("adapter", () => {
  it("builds query paths", () => {
    expect(slashEventsPath(null, null)).toBe("/slash-events");
    expect(slashEventsPath(SOLVER, "2")).toBe(`/slash-events?solver=${SOLVER}&cursor=2`);
  });

  it("fetches from the relay and rejects invalid payloads", async () => {
    fetcherMock.mockResolvedValueOnce({ events: [ev({})], nextCursor: null });
    await expect(fetchSlashEvents(SOLVER, null)).resolves.toMatchObject({ nextCursor: null });
    expect(fetcherMock).toHaveBeenCalledWith(`/slash-events?solver=${SOLVER}`);
    fetcherMock.mockResolvedValueOnce({ events: "nope" });
    await expect(fetchSlashEvents(null, null)).rejects.toThrow("Invalid slash event response");
  });

  it("serves valid paginated mock pages when the flag is on", async () => {
    vi.stubEnv("NEXT_PUBLIC_SLASH_EVENTS_MOCK", "true");
    vi.resetModules();
    const mod = await import("./slashEvents");
    const page = await mod.fetchSlashEvents(SOLVER, null);
    expect(page.events).toHaveLength(5);
    expect(page.events.some((e) => !mod.reasonInfo(e.reasonCode).known)).toBe(true);
    expect(page.nextCursor).toBe("1");
    expect((await mod.fetchSlashEvents(null, "2")).nextCursor).toBeNull();
    vi.unstubAllEnvs();
  });
});
