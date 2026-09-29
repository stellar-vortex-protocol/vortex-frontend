import { describe, expect, it } from "vitest";
import {
  truncateText,
  truncateTitle,
  truncateDescription,
  truncateHash,
  formatAmount,
  getStatusColor,
  getStatusLabel,
  COLORS,
} from "./ogImageHelpers";

describe("ogImageHelpers", () => {
  describe("truncateText", () => {
    it("returns original text if within limit", () => {
      expect(truncateText("hello", 10)).toBe("hello");
    });

    it("truncates and adds ellipsis if over limit", () => {
      expect(truncateText("hello world", 6)).toBe("hello…");
    });

    it("handles CJK and emojis correctly via graphemes", () => {
      const text = "👋 Hello 世界 🚀";
      const truncated = truncateText(text, 6);
      expect(truncated.endsWith("…")).toBe(true);
    });
  });

  describe("truncateTitle", () => {
    it("truncates with default 48 length", () => {
      const longTitle = "A".repeat(60);
      expect(truncateTitle(longTitle).length).toBe(48);
      expect(truncateTitle(longTitle).endsWith("…")).toBe(true);
    });

    it("respects custom length", () => {
      expect(truncateTitle("1234567890", 5)).toBe("1234…");
    });
  });

  describe("truncateDescription", () => {
    it("truncates with default 120 length", () => {
      const longDesc = "B".repeat(150);
      expect(truncateDescription(longDesc).length).toBe(120);
      expect(truncateDescription(longDesc).endsWith("…")).toBe(true);
    });
  });

  describe("truncateHash", () => {
    it("returns hash unchanged if short", () => {
      expect(truncateHash("abc123")).toBe("abc123");
    });

    it("truncates long hashes with prefix and suffix", () => {
      const hash = "GAAX8890123456789012345678901234567890123456789012345678";
      const result = truncateHash(hash, 6, 6);
      expect(result).toBe("GAAX88…5678");
    });
  });

  describe("formatAmount", () => {
    it("formats normal numbers", () => {
      expect(formatAmount("123.4567")).toBe("123.4567");
    });

    it("formats millions with M", () => {
      expect(formatAmount("1500000")).toBe("1.5M");
    });

    it("formats thousands with K", () => {
      expect(formatAmount("2500")).toBe("2.5K");
    });

    it("returns original string if invalid number", () => {
      expect(formatAmount("abc")).toBe("abc");
    });
  });

  describe("getStatusColor", () => {
    it("returns correct color for intent status", () => {
      expect(getStatusColor("filled", "intent")).toBe(COLORS.statusFilled);
      expect(getStatusColor("pending", "intent")).toBe(COLORS.statusPending);
      expect(getStatusColor("failed", "intent")).toBe(COLORS.statusFailed);
      expect(getStatusColor("unknown", "intent")).toBe(COLORS.textSecondary);
    });

    it("returns correct color for solver status", () => {
      expect(getStatusColor("active", "solver")).toBe(COLORS.statusActive);
      expect(getStatusColor("inactive", "solver")).toBe(COLORS.statusInactive);
    });

    it("returns correct color for proposal status", () => {
      expect(getStatusColor("passed", "proposal")).toBe(COLORS.statusPassed);
      expect(getStatusColor("rejected", "proposal")).toBe(COLORS.statusRejected);
      expect(getStatusColor("active", "proposal")).toBe(COLORS.statusPending);
      expect(getStatusColor("unknown", "proposal")).toBe(COLORS.textSecondary);
    });
  });

  describe("getStatusLabel", () => {
    it("returns formatted label for intent status", () => {
      expect(getStatusLabel("filled", "intent")).toBe("Filled");
      expect(getStatusLabel("pending", "intent")).toBe("Pending");
      expect(getStatusLabel("accepted", "intent")).toBe("Accepted");
      expect(getStatusLabel("failed", "intent")).toBe("Failed");
      expect(getStatusLabel("other", "intent")).toBe("other");
    });

    it("returns formatted label for solver status", () => {
      expect(getStatusLabel("active", "solver")).toBe("Active");
      expect(getStatusLabel("inactive", "solver")).toBe("Inactive");
    });

    it("returns formatted label for proposal status", () => {
      expect(getStatusLabel("passed", "proposal")).toBe("Passed");
      expect(getStatusLabel("rejected", "proposal")).toBe("Rejected");
      expect(getStatusLabel("active", "proposal")).toBe("Active");
      expect(getStatusLabel("custom", "proposal")).toBe("custom");
    });
  });
});
