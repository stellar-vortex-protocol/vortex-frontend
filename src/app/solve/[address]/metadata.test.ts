import { describe, expect, it, vi, beforeEach } from "vitest";
import { generateMetadata } from "./layout";

describe("generateMetadata - solve/[address]", () => {
  const fetch = vi.fn();
  global.fetch = fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns noindex metadata when address format is invalid", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ address: "invalid" }) });

    expect(metadata.robots).toBe("noindex");
    expect(metadata.title).toContain("Not Found");
  });

  it("returns metadata with solver details when valid", async () => {
    const mockSolver = {
      name: "Alpha Solver",
      address: "GAAX8890123456789012345678901234567890123456789012345678",
      bondUsd: 100,
      fills: 1250,
      failed: 2,
      volumeUsd: 5400000,
      avgFillTimeSeconds: 15,
      successRatePct: 99.8,
      chains: ["ethereum", "polygon"],
      status: "active",
    };

    fetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockSolver),
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ address: "GAAX8890123456789012345678901234567890123456789012345678" }),
    });

    expect(metadata.title).toBe("Alpha Solver");
    expect(metadata.description).toContain("1250 fills");
    expect(metadata.robots).toBe("index, follow");
    expect(metadata.openGraph?.images?.[0]?.url).toContain("/solve/GAAX8890123456789012345678901234567890123456789012345678/opengraph-image");
  });

  it("returns noindex when solver not found", async () => {
    fetch.mockResolvedValueOnce({ ok: false });

    const metadata = await generateMetadata({
      params: Promise.resolve({ address: "GAAX8890123456789012345678901234567890123456789012345678" }),
    });

    expect(metadata.robots).toBe("noindex");
  });
});
