import { describe, expect, it } from "vitest";
import {
  parseIntentId,
  parseStrKey,
  parseChainId,
  parseInternalHref,
  parseExternalUrl,
  type IntentId,
  type StrKey,
  type ChainId,
  type InternalHref,
  type ExternalUrl,
} from "./inputs";

// ─── parseIntentId ──────────────────────────────────────────────

describe("parseIntentId", () => {
  it("accepts a simple alphanumeric id", () => {
    const result = parseIntentId("abc123");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });

  it("accepts ids with hyphens and underscores", () => {
    expect(parseIntentId("intent-abc_123")).not.toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseIntentId("")).toBeNull();
  });

  it("rejects ids with slashes", () => {
    expect(parseIntentId("abc/def")).toBeNull();
  });

  it("rejects ids with path traversal", () => {
    expect(parseIntentId("abc..def")).toBeNull();
    expect(parseIntentId("../etc/passwd")).toBeNull();
  });

  it("rejects ids with query characters", () => {
    expect(parseIntentId("abc?def")).toBeNull();
    expect(parseIntentId("abc#def")).toBeNull();
    expect(parseIntentId("abc&def")).toBeNull();
    expect(parseIntentId("abc=def")).toBeNull();
  });

  it("rejects ids with spaces", () => {
    expect(parseIntentId("abc def")).toBeNull();
  });

  it("rejects ids with unicode", () => {
    expect(parseIntentId("abc\u00e9def")).toBeNull();
  });

  it("rejects ids longer than 64 chars", () => {
    const longId = "a".repeat(65);
    expect(parseIntentId(longId)).toBeNull();
  });

  it("accepts exactly 64 chars", () => {
    const exactId = "a".repeat(64);
    expect(parseIntentId(exactId)).not.toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseIntentId(null as unknown as string)).toBeNull();
    expect(parseIntentId(undefined as unknown as string)).toBeNull();
    expect(parseIntentId(42 as unknown as string)).toBeNull();
  });

  it("returns a branded type", () => {
    const result = parseIntentId("valid-id");
    expect(result).not.toBeNull();
    // Branded types are structurally strings at runtime.
    expect(typeof result).toBe("string");
  });
});

// ─── parseStrKey ────────────────────────────────────────────────

describe("parseStrKey", () => {
  // A valid Stellar Ed25519 public key (G-strkey, 56 chars, valid checksum).
  const VALID_KEY = "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

  it("accepts a valid G-strkey", () => {
    const result = parseStrKey(VALID_KEY);
    expect(result).not.toBeNull();
    expect(result).toBe(VALID_KEY);
  });

  it("rejects a key with wrong length", () => {
    expect(parseStrKey("Gshort")).toBeNull();
    expect(parseStrKey("G" + "A".repeat(56))).toBeNull(); // 57 chars
  });

  it("rejects a key that does not start with G", () => {
    expect(parseStrKey("AB" + "A".repeat(54))).toBeNull();
  });

  it("rejects a key with invalid base32 characters", () => {
    // '1' is not in the base32 alphabet
    expect(parseStrKey("G1" + "A".repeat(54))).toBeNull();
  });

  it("rejects a key with a bad checksum", () => {
    // Valid key with last byte flipped — checksum will fail
    const badKey =
      "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIW";
    expect(parseStrKey(badKey)).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseStrKey(null as unknown as string)).toBeNull();
    expect(parseStrKey(undefined as unknown as string)).toBeNull();
  });

  it("returns a branded type", () => {
    const result = parseStrKey(VALID_KEY);
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

// ─── parseChainId ───────────────────────────────────────────────

describe("parseChainId", () => {
  it("accepts known chain ids", () => {
    expect(parseChainId("ethereum")).not.toBeNull();
    expect(parseChainId("base")).not.toBeNull();
    expect(parseChainId("polygon")).not.toBeNull();
    expect(parseChainId("arbitrum")).not.toBeNull();
    expect(parseChainId("optimism")).not.toBeNull();
    expect(parseChainId("avalanche")).not.toBeNull();
  });

  it("rejects unknown chain ids", () => {
    expect(parseChainId("bitcoin")).toBeNull();
    expect(parseChainId("unknown")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseChainId("")).toBeNull();
  });

  it("rejects chain ids that are too long", () => {
    expect(parseChainId("a".repeat(33))).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseChainId(null as unknown as string)).toBeNull();
  });

  it("returns a branded type", () => {
    const result = parseChainId("ethereum");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

// ─── parseInternalHref ──────────────────────────────────────────

describe("parseInternalHref", () => {
  it("accepts a simple root path", () => {
    expect(parseInternalHref("/")).not.toBeNull();
  });

  it("accepts a nested path", () => {
    expect(parseInternalHref("/explore/abc123")).not.toBeNull();
  });

  it("accepts a path with query string", () => {
    expect(parseInternalHref("/explore?status=all")).not.toBeNull();
  });

  it("accepts a path with hash fragment", () => {
    expect(parseInternalHref("/explore#section")).not.toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseInternalHref("")).toBeNull();
  });

  it("rejects paths that do not start with /", () => {
    expect(parseInternalHref("explore/abc")).toBeNull();
  });

  it("rejects protocol-relative paths", () => {
    expect(parseInternalHref("//evil.com")).toBeNull();
  });

  it("rejects absolute URLs", () => {
    expect(parseInternalHref("https://evil.com")).toBeNull();
  });

  it("rejects paths with .. segments", () => {
    expect(parseInternalHref("/../etc/passwd")).toBeNull();
    expect(parseInternalHref("/explore/../etc/passwd")).toBeNull();
    expect(parseInternalHref("/a/b/../c")).toBeNull();
  });

  it("rejects paths with backslashes", () => {
    expect(parseInternalHref("/explore\\evil")).toBeNull();
  });

  it("rejects paths longer than 256 chars", () => {
    expect(parseInternalHref("/" + "a".repeat(256))).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseInternalHref(null as unknown as string)).toBeNull();
  });

  it("returns a branded type", () => {
    const result = parseInternalHref("/explore");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

// ─── parseExternalUrl ───────────────────────────────────────────

describe("parseExternalUrl", () => {
  const DEFAULT_ORIGINS = ["https://github.com", "https://discord.gg"];

  it("accepts a whitelisted https origin", () => {
    const result = parseExternalUrl("https://github.com/vortex-protocol");
    expect(result).not.toBeNull();
  });

  it("accepts a whitelisted discord origin", () => {
    const result = parseExternalUrl("https://discord.gg/vortex");
    expect(result).not.toBeNull();
  });

  it("rejects a non-whitelisted origin", () => {
    expect(parseExternalUrl("https://evil.com")).toBeNull();
  });

  it("rejects javascript: protocol", () => {
    expect(parseExternalUrl("javascript:alert(1)")).toBeNull();
  });

  it("rejects data: protocol", () => {
    expect(parseExternalUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rejects vbscript: protocol", () => {
    expect(parseExternalUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects non-URL strings", () => {
    expect(parseExternalUrl("not a url")).toBeNull();
  });

  it("rejects empty string", () => {
    expect(parseExternalUrl("")).toBeNull();
  });

  it("rejects urls longer than 2048 chars", () => {
    expect(parseExternalUrl("https://github.com/" + "a".repeat(2048))).toBeNull();
  });

  it("rejects non-string input", () => {
    expect(parseExternalUrl(null as unknown as string)).toBeNull();
  });

  it("accepts a custom allowed-origin list", () => {
    const result = parseExternalUrl("https://example.com/page", [
      "https://example.com",
    ]);
    expect(result).not.toBeNull();
  });

  it("rejects a url not in the custom allowed-origin list", () => {
    expect(
      parseExternalUrl("https://evil.com", ["https://safe.com"]),
    ).toBeNull();
  });

  it("returns a branded type", () => {
    const result = parseExternalUrl("https://github.com/vortex-protocol");
    expect(result).not.toBeNull();
    expect(typeof result).toBe("string");
  });
});

// ─── Path safety: encodeURIComponent prevents path manipulation ─

describe("path safety — encodeURIComponent prevents traversal", () => {
  it("encodeURIComponent encodes ../ so it cannot alter the path", () => {
    const malicious = "../etc/passwd";
    const encoded = encodeURIComponent(malicious);
    const path = `/intents/${encoded}/submit`;
    // The encoded value should not contain literal ../
    expect(path).not.toContain("../");
    // The encoded value should not contain unencoded dots
    expect(path).not.toContain("/../");
  });

  it("encodeURIComponent encodes ? so it cannot inject query params", () => {
    const malicious = "abc?evil=true";
    const encoded = encodeURIComponent(malicious);
    const path = `/intents/${encoded}/submit`;
    expect(path).not.toContain("?evil=true");
    expect(path).toContain("%3F");
  });

  it("encodeURIComponent encodes # so it cannot inject fragments", () => {
    const malicious = "abc#fragment";
    const encoded = encodeURIComponent(malicious);
    const path = `/intents/${encoded}/submit`;
    expect(path).not.toContain("#fragment");
    expect(path).toContain("%23");
  });

  it("encodeURIComponent encodes / so it cannot create sub-paths", () => {
    const malicious = "abc/def";
    const encoded = encodeURIComponent(malicious);
    const path = `/intents/${encoded}/submit`;
    // The slash is encoded, so it stays as a single path segment
    expect(path).toBe("/intents/abc%2Fdef/submit");
    // The path should have exactly 3 segments: intents, encoded-id, submit
    const segments = path.split("/").filter(Boolean);
    expect(segments).toHaveLength(3);
  });
});
