import { describe, expect, it } from "vitest";
import { evaluateOrigin } from "./config";

describe("evaluateOrigin", () => {
  const trusted = ["localhost", "127.0.0.1", "vortex.app", "*.vercel.app"];

  it("returns 'unknown' when the trusted list is empty", () => {
    expect(evaluateOrigin("localhost", "https", [])).toBe("unknown");
  });

  it("returns 'trusted' for an exact hostname match", () => {
    expect(evaluateOrigin("localhost", "https", trusted)).toBe("trusted");
    expect(evaluateOrigin("vortex.app", "https", trusted)).toBe("trusted");
  });

  it("is case-insensitive for exact matches", () => {
    expect(evaluateOrigin("VORTEX.APP", "https", trusted)).toBe("trusted");
    expect(evaluateOrigin("LocalHost", "https", trusted)).toBe("trusted");
  });

  it("strips port before comparing", () => {
    expect(evaluateOrigin("localhost:3000", "https", trusted)).toBe("trusted");
    expect(evaluateOrigin("vortex.app:443", "https", trusted)).toBe("trusted");
  });

  it("returns 'trusted' for a wildcard suffix match", () => {
    expect(evaluateOrigin("my-project.vercel.app", "https", trusted)).toBe("trusted");
    expect(evaluateOrigin("pr-42.my-project.vercel.app", "https", trusted)).toBe("trusted");
  });

  it("does NOT match a wildcard against a non-matching suffix", () => {
    expect(evaluateOrigin("evil.vercel.app", "https", ["*.example.com"])).toBe("untrusted");
  });

  it("does NOT match a lookalike domain (evil-vortex.app vs vortex.app)", () => {
    expect(evaluateOrigin("evil-vortex.app", "https", trusted)).toBe("untrusted");
  });

  it("does NOT match a suffix attack (vortex.app.evil.com vs vortex.app)", () => {
    expect(evaluateOrigin("vortex.app.evil.com", "https", trusted)).toBe("untrusted");
  });

  it("does NOT match a deeper subdomain against a wildcard with a single label", () => {
    // "*.vercel.app" should match "foo.vercel.app" but not "foo.bar.vercel.app"
    // because the wildcard only covers one label
    expect(evaluateOrigin("foo.vercel.app", "https", trusted)).toBe("trusted");
    expect(evaluateOrigin("foo.bar.vercel.app", "https", trusted)).toBe("untrusted");
  });

  it("returns 'untrusted' for a hostname not in the allowlist", () => {
    expect(evaluateOrigin("evil.com", "https", trusted)).toBe("untrusted");
    expect(evaluateOrigin("vortex-swap.example", "https", trusted)).toBe("untrusted");
  });

  it("returns 'untrusted' for an IP address not in the allowlist", () => {
    expect(evaluateOrigin("192.168.1.1", "https", trusted)).toBe("untrusted");
  });

  it("returns 'trusted' for 127.0.0.1 when it is in the allowlist", () => {
    expect(evaluateOrigin("127.0.0.1", "https", trusted)).toBe("trusted");
  });

  it("handles punycode hostnames correctly (IDN)", () => {
    // Punycode for "münchen.de" is "xn--mnchen-3ya.de"
    const idnTrusted = ["xn--mnchen-3ya.de"];
    expect(evaluateOrigin("xn--mnchen-3ya.de", "https", idnTrusted)).toBe("trusted");
  });

  it("treats a single wildcard '*' as matching everything", () => {
    expect(evaluateOrigin("anything.com", "https", ["*"])).toBe("trusted");
  });

  it("ignores empty entries in the trusted list", () => {
    expect(evaluateOrigin("localhost", "https", ["", "localhost", "  "])).toBe("trusted");
  });
});
