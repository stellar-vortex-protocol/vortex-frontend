import { describe, expect, it } from "vitest";
import {
  buildFeatureRequestUrl,
  MAX_DESCRIPTION_LENGTH,
  MAX_TITLE_LENGTH,
} from "./featureRequest";

function params(url: string) {
  return new URL(url).searchParams;
}

describe("buildFeatureRequestUrl", () => {
  it("targets this repo's new-issue form with the enhancement label", () => {
    const url = buildFeatureRequestUrl({ title: "Dark mode", description: "Please" });
    expect(url.startsWith("https://github.com/stellar-vortex-protocol/vortex-frontend/issues/new?")).toBe(true);
    expect(params(url).get("labels")).toBe("enhancement");
    expect(params(url).get("template")).toBeNull();
  });

  it("encodes the title and description, following the feature_request template", () => {
    const url = buildFeatureRequestUrl({
      title: "Swap & bridge #1 ?",
      description: "Line one\nLine two & more",
    });
    expect(url).not.toContain("Swap & bridge");
    expect(params(url).get("title")).toBe("feat: Swap & bridge #1 ?");
    const body = params(url).get("body")!;
    expect(body).toContain("## Problem\n\nLine one\nLine two & more");
    expect(body).toContain("## Proposed solution");
    expect(body).toContain("## Alternatives considered");
    expect(body).toContain("## Additional context");
  });

  it("caps an overly long title and description", () => {
    const url = buildFeatureRequestUrl({
      title: "t".repeat(MAX_TITLE_LENGTH + 50),
      description: "d".repeat(MAX_DESCRIPTION_LENGTH + 500),
    });
    expect(params(url).get("title")).toBe(`feat: ${"t".repeat(MAX_TITLE_LENGTH)}`);
    const body = params(url).get("body")!;
    expect(body).toContain("d".repeat(MAX_DESCRIPTION_LENGTH));
    expect(body).not.toContain("d".repeat(MAX_DESCRIPTION_LENGTH + 1));
    expect(body).toContain("Truncated");
    expect(url.length).toBeLessThan(8000);
  });
});
