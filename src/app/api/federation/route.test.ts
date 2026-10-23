import { beforeEach, describe, expect, it, vi } from "vitest";

const safeFetch = vi.fn();
vi.mock("@/lib/server/safeFetch", () => ({ safeFetch: (...a: unknown[]) => safeFetch(...a) }));

import { GET } from "./route";

const get = (address: string) => GET(new Request(`http://x/api/federation?address=${encodeURIComponent(address)}`));

beforeEach(() => {
  safeFetch.mockReset();
});

describe("GET /api/federation", () => {
  it("rejects malformed aliases and domains with 400", async () => {
    expect((await get("nope")).status).toBe(400);
    expect((await get("a*localhost")).status).toBe(400);
  });

  it("delegates to safeFetch and returns the JSON", async () => {
    safeFetch.mockResolvedValue({ status: 200, body: '{"account_id":"G1"}', finalUrl: "" });
    const res = await get("bob*example.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ account_id: "G1" });
    expect(safeFetch.mock.calls[0]![0]).toBe("https://example.com/federation?type=name&q=bob");
  });

  it("blocks a connect-time rebind to a private address (403)", async () => {
    safeFetch.mockImplementation(async () => { throw Object.assign(new Error("boom"), { code: "blocked-address" }); });
    expect((await get("bob*rebind.example")).status).toBe(403);
  });

  it("maps other failures to 502", async () => {
    safeFetch.mockImplementation(async () => { throw Object.assign(new Error("x"), { code: "timeout" }); });
    expect((await get("bob*example.com")).status).toBe(502);
    safeFetch.mockResolvedValue({ status: 200, body: "not json", finalUrl: "" });
    expect((await get("bob*example.com")).status).toBe(502);
  });
});
