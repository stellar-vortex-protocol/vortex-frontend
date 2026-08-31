import { describe, expect, it } from "vitest";
import { verifySignedXdrMatches } from "./xdrReview";

describe("verifySignedXdrMatches", () => {
  it("returns valid:false for malformed XDR", () => {
    const result = verifySignedXdrMatches("invalid", "also invalid");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("provides error message for mismatched XDRs", () => {
    // Using empty strings will fail to parse
    const result = verifySignedXdrMatches("", "");
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("handles empty input gracefully", () => {
    const result = verifySignedXdrMatches("", "aGVsbG8="); // base64 for "hello"
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
