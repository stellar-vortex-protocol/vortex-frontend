import { describe, expect, it } from "vitest";
import { isValidStellarPublicKey } from "./stellarAddress";

describe("isValidStellarPublicKey", () => {
  it("accepts a valid Ed25519 public key", () => {
    expect(isValidStellarPublicKey("GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV")).toBe(true);
  });

  it("rejects a key with a corrupted checksum", () => {
    expect(isValidStellarPublicKey("GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIW")).toBe(false);
  });

  it("rejects strings that aren't the right length", () => {
    expect(isValidStellarPublicKey("GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAI")).toBe(false);
  });

  it("rejects a secret seed ('S...') instead of a public key", () => {
    expect(isValidStellarPublicKey("SDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV")).toBe(false);
  });

  it("rejects arbitrary non-address strings", () => {
    expect(isValidStellarPublicKey("not-a-valid-address")).toBe(false);
    expect(isValidStellarPublicKey("")).toBe(false);
  });

  it("rejects lowercase input even if otherwise well-formed", () => {
    expect(isValidStellarPublicKey("gdw4uxk66pddk4cdduJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV")).toBe(false);
  });
});
