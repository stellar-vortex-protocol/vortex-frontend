import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import type { LookupAddress } from "node:dns";
import { isBlockedAddress, safeFetch, SafeFetchError, type SafeFetchDeps } from "./safeFetch";
import { normalizeDomain } from "./domain";
import { createTokenBucket } from "./rateLimit";

type Reply = { status: number; headers?: Record<string, string>; body?: string | Buffer };

/**
 * Fake https.request: runs the injected `lookup` exactly like a socket would
 * (so the SSRF guard is exercised), then replies from `replies` by URL.
 */
function fakeDeps(dns: Record<string, string[]>, replies: Record<string, Reply>) {
  const requested: string[] = [];
  const resolve = vi.fn(async (host: string): Promise<LookupAddress[]> => {
    const addrs = dns[host];
    if (!addrs) throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    return addrs.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
  });
  const request = ((url: URL, opts: { lookup: (h: string, o: { all?: boolean }, cb: (err: Error | null) => void) => void }, onRes: (res: unknown) => void) => {
    const req = new EventEmitter() as EventEmitter & { end: () => void };
    req.end = () => {
      opts.lookup(url.hostname, { all: true }, (err) => {
        if (err) {
          req.emit("error", err);
          return;
        }
        requested.push(url.toString());
        const reply = replies[url.toString()] ?? { status: 404 };
        const res = Object.assign(new PassThrough(), { statusCode: reply.status, headers: reply.headers ?? {} });
        onRes(res);
        res.end(reply.body ?? "");
      });
    };
    return req;
  }) as unknown as SafeFetchDeps["request"];
  return { deps: { resolve, request }, requested, resolve };
}

const URL_OK = "https://acme.example/.well-known/stellar.toml";

describe("isBlockedAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:a00:1", "not-an-ip"])(
    "blocks %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  );
  it.each(["93.184.216.34", "2606:2800:220:1:248:1893:25c8:1946"])("allows %s", (ip) => {
    expect(isBlockedAddress(ip)).toBe(false);
  });
});

describe("safeFetch", () => {
  it("fetches a public https resource", async () => {
    const { deps } = fakeDeps({ "acme.example": ["93.184.216.34"] }, { [URL_OK]: { status: 200, body: "OK" } });
    await expect(safeFetch(URL_OK, { deps })).resolves.toMatchObject({ status: 200, body: "OK" });
  });

  it.each([
    ["http://acme.example/x", "invalid-url"],
    ["https://user:pw@acme.example/x", "invalid-url"],
    ["https://acme.example:8443/x", "invalid-url"],
    ["https://127.0.0.1/x", "blocked-address"],
    ["https://[::1]/x", "blocked-address"],
    ["not a url", "invalid-url"],
  ])("rejects %s", async (url, code) => {
    const { deps, resolve } = fakeDeps({}, {});
    await expect(safeFetch(url, { deps })).rejects.toMatchObject({ code });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("blocks hosts that resolve to private addresses, including mixed answers (DNS rebinding)", async () => {
    const { deps, requested } = fakeDeps({ "acme.example": ["93.184.216.34", "10.0.0.5"] }, { [URL_OK]: { status: 200 } });
    await expect(safeFetch(URL_OK, { deps })).rejects.toMatchObject({ code: "blocked-address" });
    expect(requested).toEqual([]);
  });

  it("follows same-host redirects up to the limit and refuses cross-host ones", async () => {
    const hop = "https://acme.example/moved";
    const ok = fakeDeps({ "acme.example": ["93.184.216.34"] }, {
      [URL_OK]: { status: 302, headers: { location: "/moved" } },
      [hop]: { status: 200, body: "moved" },
    });
    await expect(safeFetch(URL_OK, { deps: ok.deps })).resolves.toMatchObject({ body: "moved", finalUrl: hop });

    const cross = fakeDeps({ "acme.example": ["93.184.216.34"] }, {
      [URL_OK]: { status: 301, headers: { location: "https://169.254.169.254/latest" } },
    });
    await expect(safeFetch(URL_OK, { deps: cross.deps })).rejects.toMatchObject({ code: "blocked-address" });

    const loop = fakeDeps({ "acme.example": ["93.184.216.34"] }, { [URL_OK]: { status: 302, headers: { location: URL_OK } } });
    await expect(safeFetch(URL_OK, { deps: loop.deps, maxRedirects: 2 })).rejects.toMatchObject({ code: "redirect" });
    expect(loop.requested).toHaveLength(3);
  });

  it("caps the body size by header and by streamed bytes", async () => {
    const big = fakeDeps({ "acme.example": ["93.184.216.34"] }, { [URL_OK]: { status: 200, headers: { "content-length": "999999" } } });
    await expect(safeFetch(URL_OK, { deps: big.deps })).rejects.toMatchObject({ code: "too-large" });
    const stream = fakeDeps({ "acme.example": ["93.184.216.34"] }, { [URL_OK]: { status: 200, body: "x".repeat(2048) } });
    await expect(safeFetch(URL_OK, { deps: stream.deps, maxBytes: 1024 })).rejects.toMatchObject({ code: "too-large" });
  });

  it("maps upstream errors and DNS failures", async () => {
    const notFound = fakeDeps({ "acme.example": ["93.184.216.34"] }, {});
    await expect(safeFetch(URL_OK, { deps: notFound.deps })).rejects.toMatchObject({ code: "http-status" });
    const nxdomain = fakeDeps({}, {});
    await expect(safeFetch(URL_OK, { deps: nxdomain.deps })).rejects.toBeInstanceOf(SafeFetchError);
  });

  it("times out", async () => {
    const hang: SafeFetchDeps = {
      resolve: async () => [{ address: "93.184.216.34", family: 4 }],
      request: ((_url: URL, opts: { signal: AbortSignal }) => {
        const req = new EventEmitter() as EventEmitter & { end: () => void };
        req.end = () => opts.signal.addEventListener("abort", () => req.emit("error", new Error("aborted")));
        return req;
      }) as unknown as SafeFetchDeps["request"],
    };
    await expect(safeFetch(URL_OK, { deps: hang, timeoutMs: 20 })).rejects.toMatchObject({ code: "timeout" });
  });
});

describe("normalizeDomain", () => {
  it.each([
    ["Acme.Example.", { ascii: "acme.example", unicode: "acme.example" }],
    ["acmé.example", { ascii: "xn--acm-dma.example", unicode: "acmé.example" }],
  ])("normalises %s", (input, expected) => expect(normalizeDomain(input)).toEqual(expected));

  it.each([null, "", "localhost", "127.0.0.1", "acme.example:443", "acme.example/x", "user@acme.example", "-bad.example", "1.2.3.4.5", "a".repeat(254)])(
    "rejects %s",
    (input) => expect(normalizeDomain(input)).toBeNull(),
  );
});

describe("createTokenBucket", () => {
  it("allows a burst then refills over time, per key", () => {
    const take = createTokenBucket(2, 1);
    expect([take("ip", 0), take("ip", 0), take("ip", 0)]).toEqual([true, true, false]);
    expect(take("other", 0)).toBe(true);
    expect(take("ip", 1000)).toBe(true);
  });

  it("evicts the oldest key when full", () => {
    const take = createTokenBucket(1, 0, 1);
    expect(take("a", 0)).toBe(true);
    expect(take("b", 0)).toBe(true);
    expect(take("a", 0)).toBe(true);
  });
});
