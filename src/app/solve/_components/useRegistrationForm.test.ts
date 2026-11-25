import { describe, expect, it } from "vitest";
import { isValidStellarAddress } from "./useRegistrationForm";

describe("isValidStellarAddress", () => {
  it("accepts a valid Stellar public key", () => {
    expect(
      isValidStellarAddress("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H"),
    ).toBe(true);
  });

  it("rejects a key with the wrong length", () => {
    expect(isValidStellarAddress("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2")).toBe(
      false,
    );
    expect(isValidStellarAddress("")).toBe(false);
  });

  it("rejects a 56-character key with a corrupted checksum", () => {
    expect(
      isValidStellarAddress("GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2X"),
    ).toBe(false);
  });
});
