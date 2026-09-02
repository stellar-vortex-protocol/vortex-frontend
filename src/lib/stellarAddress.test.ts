import { describe, expect, it } from "vitest";
import { isValidStellarPublicKey, truncateAddress } from "./stellarAddress";

describe("isValidStellarPublicKey", () => {
  it("accepts a valid Ed25519 public key", () => {
    expect(
      isValidStellarPublicKey(
        "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
      ),
    ).toBe(true);
  });

  it("rejects a key with a corrupted checksum", () => {
    expect(
      isValidStellarPublicKey(
        "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIW",
      ),
    ).toBe(false);
  });

  it("rejects strings that aren't the right length", () => {
    expect(
      isValidStellarPublicKey(
        "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAI",
      ),
    ).toBe(false);
  });

  it("rejects a secret seed ('S...') instead of a public key", () => {
    expect(
      isValidStellarPublicKey(
        "SDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
      ),
    ).toBe(false);
  });

  it("rejects arbitrary non-address strings", () => {
    expect(isValidStellarPublicKey("not-a-valid-address")).toBe(false);
    expect(isValidStellarPublicKey("")).toBe(false);
  });

  it("rejects lowercase input even if otherwise well-formed", () => {
    expect(
      isValidStellarPublicKey(
        "gdw4uxk66pddk4cdduJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
      ),
    ).toBe(false);
  });
});

describe("truncateAddress", () => {
  const ADDR = "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

  it("keeps 4 leading and 4 trailing characters by default", () => {
    expect(truncateAddress(ADDR)).toBe("GDW4...VAIV");
  });

  it("honours a custom prefix/suffix length", () => {
    expect(truncateAddress(ADDR, { prefix: 6, suffix: 6 })).toBe("GDW4UX...ZIVAIV");
  });

  it("returns the input unchanged when it is no longer than prefix + suffix", () => {
    expect(truncateAddress("abcd")).toBe("abcd");
    expect(truncateAddress("abcdefgh")).toBe("abcdefgh");
    expect(truncateAddress("GABCDEF", { prefix: 4, suffix: 4 })).toBe("GABCDEF");
  });

  it("returns an empty string unchanged", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("truncates as soon as the input exceeds prefix + suffix by one character", () => {
    expect(truncateAddress("abcdefghi")).toBe("abcd...fghi");
  });
});
