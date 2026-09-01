import { describe, it, expect } from "vitest";
import {
  checkSuspiciousPattern,
  validatePublicEnvVariables,
  enforcePublicEnvValidation,
  getPublicEnvVariables,
} from "./envValidation";

describe("envValidation", () => {
  describe("checkSuspiciousPattern", () => {
    it("should detect SECRET pattern", () => {
      const pattern = checkSuspiciousPattern("NEXT_PUBLIC_API_SECRET");
      expect(pattern).not.toBeNull();
      expect(pattern?.source).toContain("secret");
    });

    it("should detect KEY pattern", () => {
      const pattern = checkSuspiciousPattern("NEXT_PUBLIC_API_KEY");
      expect(pattern).not.toBeNull();
      expect(pattern?.source).toContain("key");
    });

    it("should detect TOKEN pattern", () => {
      const pattern = checkSuspiciousPattern("NEXT_PUBLIC_AUTH_TOKEN");
      expect(pattern).not.toBeNull();
      expect(pattern?.source).toContain("token");
    });

    it("should detect PASSWORD pattern", () => {
      const pattern = checkSuspiciousPattern("NEXT_PUBLIC_DB_PASSWORD");
      expect(pattern).not.toBeNull();
      expect(pattern?.source).toContain("password");
    });

    it("should detect PRIVATE pattern", () => {
      const pattern = checkSuspiciousPattern("NEXT_PUBLIC_PRIVATE_KEY");
      expect(pattern).not.toBeNull();
      expect(pattern?.source).toContain("private");
    });

    it("should detect API_KEY pattern", () => {
      const pattern = checkSuspiciousPattern("NEXT_PUBLIC_API_KEY");
      expect(pattern).not.toBeNull();
    });

    it("should detect case-insensitive patterns", () => {
      expect(checkSuspiciousPattern("NEXT_PUBLIC_secret")).not.toBeNull();
      expect(checkSuspiciousPattern("NEXT_PUBLIC_Secret")).not.toBeNull();
      expect(checkSuspiciousPattern("NEXT_PUBLIC_SECRET")).not.toBeNull();
    });

    it("should not flag safe variable names", () => {
      expect(checkSuspiciousPattern("NEXT_PUBLIC_API_URL")).toBeNull();
      expect(checkSuspiciousPattern("NEXT_PUBLIC_WS_URL")).toBeNull();
      expect(checkSuspiciousPattern("NEXT_PUBLIC_NETWORK")).toBeNull();
      expect(checkSuspiciousPattern("NEXT_PUBLIC_RELAY_HOST")).toBeNull();
    });

    it("should not flag non-NEXT_PUBLIC variables", () => {
      // This function only checks the variable name, not the prefix
      // but it should still work on non-NEXT_PUBLIC names
      expect(checkSuspiciousPattern("DB_PASSWORD")).not.toBeNull();
      expect(checkSuspiciousPattern("API_SECRET")).not.toBeNull();
    });
  });

  describe("validatePublicEnvVariables", () => {
    it("should pass when only safe NEXT_PUBLIC variables exist", () => {
      const env = {
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
        NEXT_PUBLIC_WS_URL: "ws://localhost:4000/ws",
        NEXT_PUBLIC_NETWORK: "testnet",
      };

      const errors = validatePublicEnvVariables(env);
      expect(errors).toHaveLength(0);
    });

    it("should detect suspicious NEXT_PUBLIC variables", () => {
      const env = {
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
        NEXT_PUBLIC_SECRET_KEY: "abc123def456",
      };

      const errors = validatePublicEnvVariables(env);
      expect(errors).toHaveLength(1);
      expect(errors[0].variable).toBe("NEXT_PUBLIC_SECRET_KEY");
    });

    it("should ignore non-NEXT_PUBLIC variables", () => {
      const env = {
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
        DATABASE_PASSWORD: "secret123", // Not NEXT_PUBLIC_, so ignored
        PRIVATE_KEY: "xyz789", // Not NEXT_PUBLIC_, so ignored
      };

      const errors = validatePublicEnvVariables(env);
      expect(errors).toHaveLength(0);
    });

    it("should detect multiple suspicious variables", () => {
      const env = {
        NEXT_PUBLIC_API_KEY: "key123",
        NEXT_PUBLIC_AUTH_TOKEN: "token456",
        NEXT_PUBLIC_PASSWORD: "pass789",
      };

      const errors = validatePublicEnvVariables(env);
      expect(errors).toHaveLength(3);
    });

    it("should include descriptive error messages", () => {
      const env = {
        NEXT_PUBLIC_API_SECRET: "secret123",
      };

      const errors = validatePublicEnvVariables(env);
      expect(errors[0].message).toContain("NEXT_PUBLIC_API_SECRET");
      expect(errors[0].message).toContain("sensitive data");
      expect(errors[0].message).toContain("bundled into the client");
    });
  });

  describe("enforcePublicEnvValidation", () => {
    it("should not throw when validation passes", () => {
      const env = {
        NEXT_PUBLIC_API_URL: "http://localhost:4000",
        NEXT_PUBLIC_NETWORK: "testnet",
      };

      expect(() => enforcePublicEnvValidation(env)).not.toThrow();
    });

    it("should throw error when validation fails", () => {
      const env = {
        NEXT_PUBLIC_API_SECRET: "secret123",
      };

      expect(() => enforcePublicEnvValidation(env)).toThrow(
        "Environment Variable Security Check Failed"
      );
    });

    it("should include helpful guidance in error message", () => {
      const env = {
        NEXT_PUBLIC_DB_PASSWORD: "password123",
      };

      try {
        enforcePublicEnvValidation(env);
        expect.fail("Should have thrown");
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain("NEXT_PUBLIC_DB_PASSWORD");
        expect(message).toContain("docs/security-audit.md");
      }
    });
  });

  describe("getPublicEnvVariables", () => {
    it("should return sorted list of NEXT_PUBLIC variables", () => {
      const env = {
        NEXT_PUBLIC_WS_URL: "ws://...",
        NEXT_PUBLIC_API_URL: "http://...",
        NEXT_PUBLIC_NETWORK: "testnet",
        PRIVATE_VAR: "should-not-appear",
        DB_URL: "should-not-appear",
      };

      const vars = getPublicEnvVariables(env);

      expect(vars).toEqual([
        "NEXT_PUBLIC_API_URL",
        "NEXT_PUBLIC_NETWORK",
        "NEXT_PUBLIC_WS_URL",
      ]);
    });

    it("should return empty array when no NEXT_PUBLIC variables", () => {
      const env = {
        PRIVATE_VAR: "value",
        DB_URL: "value",
      };

      const vars = getPublicEnvVariables(env);
      expect(vars).toHaveLength(0);
    });
  });
});
