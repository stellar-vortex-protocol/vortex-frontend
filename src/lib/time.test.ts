import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

describe("timeAgo", () => {
  const now = new Date("2026-07-14T12:00:00Z").getTime();

  it("returns 'just now' for timestamps within the last 5 seconds", () => {
    expect(timeAgo(new Date(now - 2000).toISOString(), now)).toBe("just now");
  });

  it("formats seconds", () => {
    expect(timeAgo(new Date(now - 47_000).toISOString(), now)).toBe("47s ago");
  });

  it("formats minutes", () => {
    expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5m ago");
  });

  it("formats hours", () => {
    expect(timeAgo(new Date(now - 3 * 60 * 60_000).toISOString(), now)).toBe("3h ago");
  });

  it("formats days", () => {
    expect(timeAgo(new Date(now - 2 * 24 * 60 * 60_000).toISOString(), now)).toBe("2d ago");
  });

  it("clamps future timestamps to 'just now' instead of a negative duration", () => {
    expect(timeAgo(new Date(now + 5000).toISOString(), now)).toBe("just now");
  });
});
