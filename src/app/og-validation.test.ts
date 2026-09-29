import { describe, expect, it } from "vitest";
import IntentOGImage from "./explore/[id]/opengraph-image";
import SolverOGImage from "./solve/[address]/opengraph-image";
import ProposalOGImage from "./governance/[id]/opengraph-image";

describe("Validation Tooling: Open Graph Images", () => {
  it("renders intent opengraph image for fixture and asserts size/dimensions and non-empty output", async () => {
    const res = await IntentOGImage({ params: Promise.resolve({ id: "intent-1" }) });
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get("content-type")).toContain("image/png");

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("renders solver opengraph image for fixture and asserts size/dimensions and non-empty output", async () => {
    const res = await SolverOGImage({
      params: Promise.resolve({ address: "GAAX8890123456789012345678901234567890123456789012345678" }),
    });
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get("content-type")).toContain("image/png");

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });

  it("renders proposal opengraph image for fixture and asserts size/dimensions and non-empty output", async () => {
    const res = await ProposalOGImage({ params: Promise.resolve({ id: "VIP-1" }) });
    expect(res).toBeInstanceOf(Response);
    expect(res.headers.get("content-type")).toContain("image/png");

    const arrayBuffer = await res.arrayBuffer();
    expect(arrayBuffer.byteLength).toBeGreaterThan(0);
  });
});
