import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError, TimeoutError } from "./api";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resolves with parsed JSON on a successful response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hello: "world" }),
    });

    const result = await apiFetch<{ hello: string }>("/ping");

    expect(result).toEqual({ hello: "world" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/ping$/),
      expect.objectContaining({ headers: expect.objectContaining({ "Content-Type": "application/json" }) })
    );
  });

  it("returns undefined for a 204 No Content response", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 204,
      json: async () => {
        throw new Error("should not be called");
      },
    });

    const result = await apiFetch<undefined>("/ack", { method: "POST" });

    expect(result).toBeUndefined();
  });

  it("throws an ApiError with the response status on a failed request", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
      text: async () => "intent not found",
    });

    await expect(apiFetch("/intents/missing")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "intent not found",
    });
  });

  it("wraps failures in the exported ApiError class", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    await expect(apiFetch("/boom")).rejects.toBeInstanceOf(ApiError);
  });

  it("throws a TimeoutError when the request exceeds the timeout", async () => {
    vi.useFakeTimers();
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        })
    );

    const promise = apiFetch("/slow");
    vi.advanceTimersByTime(10_000);

    await expect(promise).rejects.toThrow(TimeoutError);
    vi.useRealTimers();
  });

  it("throws a distinct TimeoutError message rather than a generic network error", async () => {
    vi.useFakeTimers();
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener("abort", () => {
              reject(new DOMException("The operation was aborted.", "AbortError"));
            });
          }
        })
    );

    const promise = apiFetch("/slow");
    vi.advanceTimersByTime(10_000);

    await expect(promise).rejects.toMatchObject({
      name: "TimeoutError",
      message: "Request timed out. Please try again.",
    });
    vi.useRealTimers();
  });
});
