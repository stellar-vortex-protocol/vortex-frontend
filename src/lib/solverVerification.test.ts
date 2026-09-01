import { describe, it, expect } from "vitest";
import {
  verifySolverAddress,
  getSolverDisplayName,
  formatSolverIdentifier,
} from "./solverVerification";
import type { Solver } from "./types";

const mockSolvers: Solver[] = [
  {
    name: "AlphaMax",
    address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
    bondUsd: 500,
    fills: 42,
    failed: 1,
    volumeUsd: 125000,
    avgFillTimeSeconds: 12,
    successRatePct: 97.67,
    chains: ["ethereum", "polygon"],
    status: "active",
  },
  {
    name: "BetaBot",
    address: "GBZXN3Z5GEO57LMOJNWHPGKBPJJQNVBIVLYOXG2VE7JQDZHW53DFUEI",
    bondUsd: 300,
    fills: 30,
    failed: 2,
    volumeUsd: 75000,
    avgFillTimeSeconds: 15,
    successRatePct: 93.33,
    chains: ["ethereum"],
    status: "active",
  },
];

describe("solverVerification", () => {
  describe("verifySolverAddress", () => {
    it("should verify registered solver addresses", () => {
      const result = verifySolverAddress(
        "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        mockSolvers
      );

      expect(result.isVerified).toBe(true);
      expect(result.solver?.name).toBe("AlphaMax");
      expect(result.warning).toBeUndefined();
    });

    it("should reject unregistered solver addresses", () => {
      const result = verifySolverAddress(
        "GBUNKNOWNADDRESS0000000000000000000000000000000000000000",
        mockSolvers
      );

      expect(result.isVerified).toBe(false);
      expect(result.solver).toBeUndefined();
      expect(result.warning).toBe("Unverified solver identifier");
    });

    it("should handle null addresses", () => {
      const result = verifySolverAddress(null, mockSolvers);

      expect(result.isVerified).toBe(false);
      expect(result.warning).toBe("No solver specified");
    });

    it("should handle undefined addresses", () => {
      const result = verifySolverAddress(undefined, mockSolvers);

      expect(result.isVerified).toBe(false);
      expect(result.warning).toBe("No solver specified");
    });

    it("should handle empty solver list", () => {
      const result = verifySolverAddress(
        "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        []
      );

      expect(result.isVerified).toBe(false);
      expect(result.warning).toBe("Unverified solver identifier");
    });
  });

  describe("getSolverDisplayName", () => {
    it("should return verified solver name", () => {
      const result = getSolverDisplayName(
        "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        mockSolvers
      );

      expect(result.name).toBe("AlphaMax");
      expect(result.isVerified).toBe(true);
    });

    it("should return address for unverified solver", () => {
      const unverifiedAddress = "GBUNKNOWNADDRESS0000000000000000000000000000000000000000";
      const result = getSolverDisplayName(unverifiedAddress, mockSolvers);

      expect(result.name).toBe(unverifiedAddress);
      expect(result.isVerified).toBe(false);
    });

    it("should return 'Unknown' for null address", () => {
      const result = getSolverDisplayName(null, mockSolvers);

      expect(result.name).toBe("Unknown");
      expect(result.isVerified).toBe(false);
    });
  });

  describe("formatSolverIdentifier", () => {
    it("should format verified solver with name only", () => {
      const result = formatSolverIdentifier(
        "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        mockSolvers
      );

      expect(result).toBe("AlphaMax");
    });

    it("should format unverified solver with warning", () => {
      const result = formatSolverIdentifier(
        "GBUNKNOWNADDRESS0000000000000000000000000000000000000000",
        mockSolvers
      );

      expect(result).toBe("Unverified solver identifier");
    });

    it("should include address when showAddress option is true", () => {
      const unverifiedAddress = "GBUNKNOWNADDRESS0000000000000000000000000000000000000000";
      const result = formatSolverIdentifier(unverifiedAddress, mockSolvers, {
        showAddress: true,
      });

      expect(result).toContain("GBUNKNOWNADDRESS");
      expect(result).toContain("Unverified");
    });

    it("should handle null solver address", () => {
      const result = formatSolverIdentifier(null, mockSolvers);

      expect(result).toBe("Unverified solver identifier");
    });
  });
});
