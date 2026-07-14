import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./api";

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
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
});
