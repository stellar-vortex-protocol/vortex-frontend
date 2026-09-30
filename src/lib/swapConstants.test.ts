import { describe, expect, it } from "vitest";
import { quoteFreshness, STALE_QUOTE_THRESHOLD_MS } from "./swapConstants";

describe("quoteFreshness", () => {
  it("reports no expiry when there is no quote", () => {
    expect(quoteFreshness(null, 1_000)).toEqual({ isStale: false, expiresInSeconds: null });
  });

  it("is fresh right after fetching, with the full window remaining", () => {
    expect(quoteFreshness(1_000, 1_000)).toEqual({
      isStale: false,
      expiresInSeconds: STALE_QUOTE_THRESHOLD_MS / 1000,
    });
  });

  it("counts down in whole seconds, rounding up", () => {
    expect(quoteFreshness(0, STALE_QUOTE_THRESHOLD_MS - 4_500).expiresInSeconds).toBe(5);
  });

  it("becomes stale exactly at the threshold", () => {
    expect(quoteFreshness(0, STALE_QUOTE_THRESHOLD_MS - 1).isStale).toBe(false);
    expect(quoteFreshness(0, STALE_QUOTE_THRESHOLD_MS)).toEqual({ isStale: true, expiresInSeconds: 0 });
  });

  it("uses the 30 s threshold by default", () => {
    expect(STALE_QUOTE_THRESHOLD_MS).toBe(30_000);
  });
});
