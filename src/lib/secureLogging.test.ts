import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { redactSensitiveData, truncateString, createSecureLogger } from "./secureLogging";

describe("secureLogging", () => {
  describe("redactSensitiveData", () => {
    it("should redact Stellar addresses", () => {
      const address = "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVhaedo74";
      const result = redactSensitiveData(address);
      expect(result).toBe("[REDACTED]");
    });

    it("should redact private keys", () => {
      const key = "SBQWY2BOZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVHAEDO74G";
      const result = redactSensitiveData(key);
      expect(result).toBe("[REDACTED]");
    });

    it("should redact XDR blobs", () => {
      const xdr =
        "AAAAAgAAAABgSvLU8OZaKKAx7BRgZQ5s76q5xOE1/lLPVMI6D/7hAAAAZABDcjYAAAAEAAAAAQAAAAAAAAAA/AAAA";
      const result = redactSensitiveData(xdr);
      expect(result).toContain("[REDACTED]");
    });

    it("should handle objects with sensitive data", () => {
      const obj = {
        address: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVHAEDO74",
        message: "Transfer complete",
      };
      const result = redactSensitiveData(obj);
      expect(result).toContain("[REDACTED]");
      expect(result).toContain("Transfer complete");
    });

    it("should handle null and undefined", () => {
      expect(redactSensitiveData(null)).toBe("null");
      expect(redactSensitiveData(undefined)).toBe("undefined");
    });
  });

  describe("truncateString", () => {
    it("should truncate long strings", () => {
      const longString =
        "This is a very long string that should be truncated to fit within the maximum length";
      const result = truncateString(longString, 20);
      expect(result.length).toBeLessThanOrEqual(24); // 10 + "..." + 10
      expect(result).toMatch(/\.\.\./);
    });

    it("should not truncate short strings", () => {
      const shortString = "Short";
      const result = truncateString(shortString, 50);
      expect(result).toBe("Short");
    });
  });

  describe("createSecureLogger", () => {
    let logSpy: any;
    let warnSpy: any;
    let errorSpy: any;

    beforeEach(() => {
      logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      logSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("should create a logger with redaction", () => {
      const logger = createSecureLogger();

      const address = "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVHAEDO74";
      logger.log("Address:", address);

      expect(logSpy).toHaveBeenCalled();
      const callArgs = logSpy.mock.calls[0];
      expect(callArgs[1]).toContain("[REDACTED]");
      expect(callArgs[1]).not.toContain("GBUQWP3BOUZX");
    });

    it("should handle warn logs with redaction", () => {
      const logger = createSecureLogger();

      logger.warn("Warning:", { key: "SBQWY2BOZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVHAEDO74G" });

      expect(warnSpy).toHaveBeenCalled();
      const callArgs = warnSpy.mock.calls[0];
      expect(callArgs[1]).toContain("[REDACTED]");
    });

    it("should handle error logs with redaction", () => {
      const logger = createSecureLogger();

      logger.error("Error:", { address: "GBUQWP3BOUZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVHAEDO74" });

      expect(errorSpy).toHaveBeenCalled();
      const callArgs = errorSpy.mock.calls[0];
      expect(callArgs[1]).toContain("[REDACTED]");
    });
  });
});
