import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A plain function (not a spy) in the module mock: a vi.fn that rejects is
// reported by vitest as a test error even when the route handles it.
const { safeFetchMock, state } = vi.hoisted(() => {
  const state = { fail: false };
  return { state, safeFetchMock: vi.fn() };
});
vi.mock("@/lib/server/safeFetch", () => ({
  safeFetch: async (url: string) => {
    const result = await safeFetchMock(url);
    if (state.fail) throw Object.assign(new Error("blocked"), { code: "blocked-address" });
    return result;
  },
}));

const A = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

async function load() {
  vi.resetModules();
  return (await import("./route")).GET;
}

const req = (domain: string | null, ip = "1.1.1.1") =>
  new NextRequest(`http://localhost/api/verify-solver${domain === null ? "" : `?domain=${encodeURIComponent(domain)}`}`, {
    headers: { "x-forwarded-for": ip },
  });

describe("GET /api/verify-solver", () => {
  beforeEach(() => {
    safeFetchMock.mockReset();
    state.fail = false;
  });

  it("rejects missing or unsafe domains without fetching", async () => {
    const GET = await load();
    for (const d of [null, "127.0.0.1", "localhost", "evil.example/path"]) {
      expect((await GET(req(d))).status).toBe(400);
    }
    expect(safeFetchMock).not.toHaveBeenCalled();
  });

  it("fetches the well-known stellar.toml and returns normalised, cached JSON", async () => {
    safeFetchMock.mockResolvedValue({ status: 200, body: `ACCOUNTS=["${A}"]\n[DOCUMENTATION]\nORG_NAME="Acme"`, finalUrl: "" });
    const GET = await load();
    const res = await GET(req("Acmé.Example"));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("max-age=3600");
    expect(await res.json()).toEqual({
      domain: "xn--acm-dma.example",
      domainUnicode: "acmé.example",
      accounts: [A],
      orgName: "Acme",
      orgUrl: null,
    });
    expect(safeFetchMock).toHaveBeenCalledWith("https://xn--acm-dma.example/.well-known/stellar.toml");

    await GET(req("acmé.example"));
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 when the fetch fails and caches the failure", async () => {
    state.fail = true;
    const GET = await load();
    expect((await GET(req("acme.example"))).status).toBe(502);
    expect((await GET(req("acme.example"))).status).toBe(502);
    expect(safeFetchMock).toHaveBeenCalledTimes(1);
  });

  it("rate-limits uncached lookups per client IP", async () => {
    safeFetchMock.mockResolvedValue({ status: 200, body: "", finalUrl: "" });
    const GET = await load();
    const statuses: number[] = [];
    for (let i = 0; i < 12; i++) statuses.push((await GET(req(`d${i}.example`, "9.9.9.9"))).status);
    expect(statuses.filter((s) => s === 429)).toHaveLength(2);
    expect((await GET(req("fresh.example", "8.8.8.8"))).status).toBe(200);
  });
});
