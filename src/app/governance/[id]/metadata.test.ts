import { describe, expect, it } from "vitest";
import { generateMetadata } from "./layout";

describe("generateMetadata - governance/[id]", () => {
  it("returns noindex when proposal ID does not exist", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "VIP-999" }) });

    expect(metadata.robots).toBe("noindex");
    expect(metadata.title).toContain("Not Found");
  });

  it("returns rich metadata for valid proposal", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "VIP-1" }) });

    expect(metadata.title).toContain("VIP-1");
    expect(metadata.title).toContain("Adjust Minimum Solver Bond");
    expect(metadata.robots).toBe("index, follow");
    expect(metadata.openGraph?.images?.[0]?.url).toContain("/governance/VIP-1/opengraph-image");
    expect(metadata.alternates?.canonical).toContain("/governance/VIP-1");
  });
});
