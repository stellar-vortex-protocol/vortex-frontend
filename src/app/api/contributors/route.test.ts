import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  __resetContributorsCache,
  getContributors,
  normalizeContributors,
} from "@/lib/contributors";

function response(body: unknown, status = 200) {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
}

const good = [
  { login: "alice", contributions: 3, type: "User", avatar_url: "https://evil.test/x.png" },
  { login: "dependabot[bot]", contributions: 9, type: "Bot" },
  { login: "<script>", contributions: 1, type: "User" },
];

describe("contributors fetcher", () => {
  beforeEach(() => __resetContributorsCache());

  it("normalises, drops bots/invalid logins and ignores upstream URLs", () => {
    const out = normalizeContributors(good);
    expect(out).toEqual([
      {
        login: "alice",
        contributions: 3,
        avatarUrl: "https://avatars.githubusercontent.com/alice?s=160",
        profileUrl: "https://github.com/alice",
      },
    ]);
  });

  it("sends the optional server-side token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(good));
    const res = await getContributors(fetchImpl, "tkn");
    expect(res.source).toBe("live");
    const init = fetchImpl.mock.calls[0]![1] as RequestInit & { headers: Record<string, string> };
    expect(init.headers["Authorization"]).toBe("Bearer tkn");
  });

  it("omits Authorization when no token is configured", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(response(good));
    await getContributors(fetchImpl, null);
    const init = fetchImpl.mock.calls[0]![1] as RequestInit & { headers: Record<string, string> };
    expect(init.headers["Authorization"]).toBeUndefined();
  });

  it("falls back to the bundled snapshot on a 403 rate limit", async () => {
    const res = await getContributors(vi.fn().mockResolvedValue(response({ message: "rate limit" }, 403)), null);
    expect(res.source).toBe("fallback");
    expect(res.contributors.length).toBeGreaterThan(0);
  });

  it("serves the last good list when a later fetch returns a malformed body", async () => {
    await getContributors(vi.fn().mockResolvedValue(response(good)), null);
    const res = await getContributors(vi.fn().mockResolvedValue(response("{not json")), null);
    expect(res.source).toBe("cache");
    expect(res.contributors[0]!.login).toBe("alice");
  });

  it("route GET returns JSON with cache headers", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(good)));
    const { GET } = await import("./route");
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
    expect((await res.json()).contributors[0].login).toBe("alice");
    vi.unstubAllGlobals();
  });
});
