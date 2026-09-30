import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptIntent,
  apiFetch,
  ApiError,
  createIntent,
  fetcher,
  registerSolver,
  submitIntent,
  submitSolverRegistration,
  TimeoutError,
  validateApiUrl,
} from "./api";
import { ValidationError } from "./schemas";

// Note: API_URL validation happens at module load time.
// Unit tests verify the apiFetch function behavior; integration tests
// and CI will verify that misconfigured environment variables fail at startup.
describe("API URL validation", () => {
  it("validates URL structure via the URL constructor", () => {
    // Valid URLs
    expect(() => new URL("http://localhost:4000")).not.toThrow();
    expect(() => new URL("https://api.example.com")).not.toThrow();

    // Invalid URLs
    expect(() => new URL("not a url")).toThrow();
    expect(() => new URL("ftp://api.example.com")).not.toThrow(); // URL constructor accepts it
  });
});

describe("validateApiUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts https:// URLs", () => {
    expect(validateApiUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("accepts http:// outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(validateApiUrl("http://localhost:4000")).toBe("http://localhost:4000");
  });

  it("rejects http:// in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(() => validateApiUrl("http://api.example.com")).toThrow(/https:\/\/ in production/);
  });

  it("accepts https:// in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(validateApiUrl("https://api.example.com")).toBe("https://api.example.com");
  });

  it("rejects non-http(s) schemes", () => {
    expect(() => validateApiUrl("ftp://api.example.com")).toThrow(/http:\/\/ or https:\/\//);
  });

  it("rejects strings that are not URLs", () => {
    expect(() => validateApiUrl("not a url")).toThrow(/not a valid URL/);
  });

  it("strips trailing slashes but keeps a path prefix", () => {
    expect(validateApiUrl("https://api.example.com/")).toBe("https://api.example.com");
    expect(validateApiUrl("https://api.example.com/v1//")).toBe("https://api.example.com/v1");
  });

  it("fails at module load when production is configured with http://", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://api.example.com");
    await expect(import("./api")).rejects.toThrow(/https:\/\/ in production/);
    vi.resetModules();
  });
});

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
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
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
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
            });
          }
        }),
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
              reject(
                new DOMException("The operation was aborted.", "AbortError"),
              );
            });
          }
        }),
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

describe("endpoint helpers", () => {
  const fetchMock = () => fetch as ReturnType<typeof vi.fn>;
  const respond = (body: unknown) =>
    fetchMock().mockResolvedValue({ ok: true, status: 200, json: async () => body });

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    {
      name: "createIntent",
      call: () =>
        createIntent({ srcChain: "ethereum", srcToken: "USDC", srcAmount: "10", dstToken: "XLM", dstAddress: "GABC" }),
      path: "/intents",
      body: { srcChain: "ethereum", srcToken: "USDC", srcAmount: "10", dstToken: "XLM", dstAddress: "GABC" },
      response: { intentId: "i-1", unsignedXdr: "AAAA" },
    },
    {
      name: "submitIntent",
      call: () => submitIntent("i-1", "SIGNED"),
      path: "/intents/i-1/submit",
      body: { signedXdr: "SIGNED" },
      response: { intentId: "i-1", status: "pending" },
    },
    {
      name: "acceptIntent",
      call: () => acceptIntent("i-1", "GSOLVER"),
      path: "/intents/i-1/accept",
      body: { solverAddress: "GSOLVER" },
      response: { intentId: "i-1", status: "accepted" },
    },
    {
      name: "registerSolver",
      call: () => registerSolver({ address: "GSOLVER", bondUsd: 500 }),
      path: "/solvers",
      body: { address: "GSOLVER", bondUsd: 500 },
      response: { registrationId: "r-1", unsignedXdr: "AAAA" },
    },
    {
      name: "submitSolverRegistration",
      call: () => submitSolverRegistration("r-1", "SIGNED"),
      path: "/solvers/r-1/submit",
      body: { signedXdr: "SIGNED" },
      response: { registrationId: "r-1", status: "pending" },
    },
  ])("$name POSTs to $path and returns the validated response", async ({ call, path, body, response }) => {
    respond(response);

    await expect(call()).resolves.toEqual(response);

    const [url, init] = fetchMock().mock.calls[0]!;
    expect(url).toMatch(new RegExp(`${path.replace(/\//g, "\\/")}$`));
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(body);
  });

  it("rejects a response that does not match the endpoint's schema", async () => {
    respond({ unexpected: true });

    await expect(submitIntent("i-1", "SIGNED")).rejects.toBeInstanceOf(ValidationError);
  });

  it("fetcher performs a plain GET for SWR", async () => {
    respond([{ id: "i-1" }]);

    await expect(fetcher("/intents/open")).resolves.toEqual([{ id: "i-1" }]);
    expect(fetchMock().mock.calls[0]![1].method).toBeUndefined();
  });
});
