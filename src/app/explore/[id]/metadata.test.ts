import { describe, expect, it, vi } from "vitest";
import { generateMetadata } from "./layout";

describe("generateMetadata - explore/[id]", () => {
  const fetch = vi.fn();
  global.fetch = fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns noindex metadata when intent not found", async () => {
    fetch.mockResolvedValueOnce({ ok: false });

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "missing" }) });

    expect(metadata.robots).toBe("noindex");
    expect(metadata.title).toContain("Not Found");
  });

  it("returns metadata with sanitized title and description for valid intent", async () => {
    const mockIntent = {
      id: "intent-1",
      srcChain: "ethereum",
      srcToken: "USDC",
      srcAmount: "500",
      dstToken: "USDC",
      dstAmount: "498.5",
      minOut: "495",
      dstAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ23456",
      solver: "Alpha Market Making",
      status: "filled",
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + 60_000).toISOString(),
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockIntent),
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "intent-1" }) });

    expect(metadata.title).toBe("500 USDC → 498.5 USDC");
    expect(metadata.description).toContain("ethereum → Stellar via Alpha Market Making");
    expect(metadata.robots).toBe("index, follow");
    expect(metadata.openGraph?.images?.[0]?.url).toContain("/explore/intent-1/opengraph-image");
    expect(metadata.alternates?.canonical).toContain("/explore/intent-1");
  });

  it("sanitizes malicious unicode in solver name", async () => {
    const mockIntent = {
      id: "intent-2",
      srcChain: "ethereum",
      srcToken: "USDC",
      srcAmount: "100",
      dstToken: "USDC",
      dstAmount: "99.5",
      minOut: "99",
      dstAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ23456",
      solver: "Malicious\u202ESpoof",
      status: "pending",
      createdAt: new Date().toISOString(),
      deadline: new Date(Date.now() + 60_000).toISOString(),
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockIntent),
    });

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "intent-2" }) });

    // The RTL override character should be stripped
    expect(metadata.description).not.toContain("\u202E");
  });

  it("handles API timeout gracefully with noindex", async () => {
    fetch.mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          const err = new Error("AbortError");
          err.name = "AbortError";
          reject(err);
        }),
    );

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "timeout" }) });

    expect(metadata.robots).toBe("noindex");
  });
});