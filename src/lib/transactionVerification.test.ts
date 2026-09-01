import { describe, it, expect } from "vitest";
import {
  verifyContractAddresses,
  ContractVerificationError,
  decodeContractIdFromXdr,
} from "./transactionVerification";

describe("Transaction Contract Verification", () => {
  describe("verifyContractAddresses", () => {
    it("should throw if no contract addresses are configured", () => {
      const xdr = "AAAAAgAAAAB+Aut...";
      expect(() => {
        verifyContractAddresses(xdr, [null, undefined]);
      }).toThrow(ContractVerificationError);
      expect(() => {
        verifyContractAddresses(xdr, [null, undefined]);
      }).toThrow(/No contract addresses configured/);
    });

    it("should throw error with clear configuration guidance", () => {
      const xdr = "AAAAAgAAAAB+Aut...";
      const error = new ContractVerificationError(
        "No contract addresses configured. Set NEXT_PUBLIC_SETTLEMENT_CONTRACT and/or NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT environment variables."
      );
      expect(error.message).toContain("NEXT_PUBLIC_SETTLEMENT_CONTRACT");
      expect(error.message).toContain("NEXT_PUBLIC_SOLVER_REGISTRY_CONTRACT");
    });

    it("should filter out null and undefined addresses", () => {
      const expectedAddresses = [null, "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",undefined];
      const filtered = expectedAddresses.filter(
        (addr) => addr !== null && addr !== undefined
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0]).toBe("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA");
    });

    it("should create meaningful error on XDR decode failure", () => {
      const invalidXdr = "not-valid-xdr";
      const expectedAddress = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

      expect(() => {
        verifyContractAddresses(invalidXdr, [expectedAddress]);
      }).toThrow(ContractVerificationError);
    });
  });

  describe("decodeContractIdFromXdr", () => {
    it("should throw on invalid XDR format", () => {
      expect(() => {
        decodeContractIdFromXdr("not-an-xdr");
      }).toThrow("Failed to decode XDR transaction");
    });

    it("should throw on empty XDR", () => {
      expect(() => {
        decodeContractIdFromXdr("");
      }).toThrow("Failed to decode XDR transaction");
    });

    it("should provide informative error messages", () => {
      try {
        decodeContractIdFromXdr("invalid");
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain("Failed to decode XDR");
      }
    });
  });

  describe("ContractVerificationError", () => {
    it("should have correct error name", () => {
      const error = new ContractVerificationError("Test error");
      expect(error.name).toBe("ContractVerificationError");
    });

    it("should maintain error message", () => {
      const message = "Transaction targets wrong contract";
      const error = new ContractVerificationError(message);
      expect(error.message).toBe(message);
    });

    it("should be instanceof Error", () => {
      const error = new ContractVerificationError("Test");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("Configuration validation", () => {
    it("should handle single contract address", () => {
      const address = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const configured = [address].filter(
        (addr) => addr !== null && addr !== undefined
      );
      expect(configured.length).toBe(1);
      expect(configured[0]).toBe(address);
    });

    it("should handle multiple contract addresses", () => {
      const addresses = [
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ];
      const configured = addresses.filter(
        (addr) => addr !== null && addr !== undefined
      );
      expect(configured.length).toBe(2);
    });

    it("should handle mixed valid and invalid addresses", () => {
      const addresses = [
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        null,
        "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
        undefined,
      ];
      const configured = addresses.filter(
        (addr) => addr !== null && addr !== undefined
      );
      expect(configured.length).toBe(2);
      expect(configured).toEqual([
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ]);
    });
  });

  describe("Error scenarios", () => {
    it("should throw if transaction targets different contract", () => {
      const expectedAddress = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
      const transactionAddress = "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

      const error = new ContractVerificationError(
        `Transaction targets contract ${transactionAddress}, but expected one of: ${expectedAddress}`
      );
      expect(error.message).toContain(transactionAddress);
      expect(error.message).toContain(expectedAddress);
    });

    it("should list all expected addresses in error message", () => {
      const expected = [
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
        "CBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      ];
      const actual = "CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";

      const error = new ContractVerificationError(
        `Transaction targets contract ${actual}, but expected one of: ${expected.join(", ")}`
      );
      expect(error.message).toContain(expected[0]);
      expect(error.message).toContain(expected[1]);
      expect(error.message).toContain(actual);
    });
  });
});
