import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, TimeoutError } from "./api";
import { ValidationError } from "./schemas";
import { onErrorRetry, retryDelay, shouldRetry, SWR_MAX_DELAY_MS, SWR_MAX_RETRIES } from "./swrPolicy";

afterEach(() => vi.useRealTimers());

describe("swrPolicy", () => {
  it.each([
    [new ApiError("", 400), false],
    [new ApiError("", 404), false],
    [new ApiError("", 408), true],
    [new ApiError("", 429), true],
    [new ApiError("", 503), true],
    [new TimeoutError(), true],
    [new TypeError("net"), true],
    [new ValidationError("bad"), false],
    [new DOMException("aborted", "AbortError"), false],
  ])("shouldRetry(%s) → %s", (err, expected) => {
    expect(shouldRetry(err)).toBe(expected);
  });

  it("uses jittered exponential backoff capped at the max", () => {
    expect(retryDelay(new TypeError(), 0, () => 0)).toBe(500);
    expect(retryDelay(new TypeError(), 0, () => 1)).toBe(1000);
    expect(retryDelay(new TypeError(), 20, () => 1)).toBe(SWR_MAX_DELAY_MS);
  });

  it("honours Retry-After", () => {
    expect(retryDelay(new ApiError("", 429, { retryAfterMs: 7000 }), 0)).toBe(7000);
  });

  it("schedules revalidation only while retries remain", () => {
    vi.useFakeTimers();
    const revalidate = vi.fn();
    const call = (err: unknown, retryCount: number) =>
      onErrorRetry(err, "k", {} as never, revalidate, { retryCount, dedupe: true });
    call(new ApiError("", 503), 0);
    call(new ApiError("", 404), 0);
    call(new ApiError("", 503), SWR_MAX_RETRIES);
    vi.runAllTimers();
    expect(revalidate).toHaveBeenCalledTimes(1);
  });
});
