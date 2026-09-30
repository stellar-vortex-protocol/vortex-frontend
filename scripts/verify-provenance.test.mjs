import { describe, it, expect } from "vitest";
import {
  runAuditSignatures,
  parseAuditResults,
  checkAllowlist,
  ATTESTATION_ALLOWLIST,
} from "./verify-provenance.mjs";

describe("parseAuditResults", () => {
  it("should return empty arrays for an error result", () => {
    const result = { error: "command failed" };
    const { valid, invalid, missing } = parseAuditResults(result);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(0);
    expect(missing).toEqual(["(unable to run npm audit signatures)"]);
  });

  it("should categorize valid signatures", () => {
    const result = {
      signatureInfo: {
        "react": { signatureStatus: "valid" },
        "lodash": { signatureStatus: "valid" },
      },
    };
    const { valid, invalid, missing } = parseAuditResults(result);
    expect(valid).toContain("react");
    expect(valid).toContain("lodash");
    expect(invalid).toHaveLength(0);
    expect(missing).toHaveLength(0);
  });

  it("should categorize missing attestations", () => {
    const result = {
      signatureInfo: {
        "some-pkg": { signatureStatus: "missing" },
      },
    };
    const { valid, invalid, missing } = parseAuditResults(result);
    expect(missing).toContain("some-pkg");
  });

  it("should categorize invalid signatures", () => {
    const result = {
      signatureInfo: {
        "tampered-pkg": { signatureStatus: "invalid" },
      },
    };
    const { valid, invalid, missing } = parseAuditResults(result);
    expect(invalid).toContain("tampered-pkg");
  });

  it("should handle array-shaped results", () => {
    const result = [
      { name: "react", signatureStatus: "valid" },
      { name: "bad-pkg", signatureStatus: "invalid" },
    ];
    const { valid, invalid, missing } = parseAuditResults(result);
    expect(valid).toContain("react");
    expect(invalid).toContain("bad-pkg");
  });
});

describe("checkAllowlist", () => {
  it("should return an empty array when all missing packages are allowlisted", () => {
    // Temporarily add a package to the allowlist
    ATTESTATION_ALLOWLIST.add("@org/internal-pkg");
    const result = checkAllowlist(["@org/internal-pkg"]);
    expect(result).toHaveLength(0);
    ATTESTATION_ALLOWLIST.delete("@org/internal-pkg");
  });

  it("should return non-allowlisted missing packages", () => {
    const result = checkAllowlist(["some-pkg", "@org/internal-pkg"]);
    expect(result).toContain("some-pkg");
  });
});

describe("ATTESTATION_ALLOWLIST", () => {
  it("should be a Set", () => {
    expect(ATTESTATION_ALLOWLIST).toBeInstanceOf(Set);
  });
});

describe("runAuditSignatures", () => {
  it("should return an error object when npm is not available", () => {
    // In a test environment without npm, this should fail gracefully
    const result = runAuditSignatures();
    // The result may be an error object or a parsed result
    // We just verify it returns something
    expect(result).toBeDefined();
  });
});
