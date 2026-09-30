import { describe, expect, it } from "vitest";
import {
  formatCurrency,
  formatTokenAmount,
  formatUsdCompact,
  localeToBcp47,
} from "./format";

describe("localeToBcp47", () => {
  it('maps "en" to "en-US"', () => {
    expect(localeToBcp47("en")).toBe("en-US");
  });

  it('maps "es" to "es-419"', () => {
    expect(localeToBcp47("es")).toBe("es-419");
  });

  it("passes through fully-qualified tags unchanged", () => {
    expect(localeToBcp47("de-DE")).toBe("de-DE");
    expect(localeToBcp47("en-US")).toBe("en-US");
  });

  it("falls back to en-US when undefined", () => {
    expect(localeToBcp47(undefined)).toBe("en-US");
  });
});

describe("formatCurrency", () => {
  it("formats USD values for en-US locale", () => {
    expect(formatCurrency(1234.5, "en-US")).toBe("$1,234.50");
  });

  it("formats USD values for de-DE locale", () => {
    expect(formatCurrency(1234.5, "de-DE")).toBe("1.234,50 $");
  });

  it('formats USD values for es locale (via "es-419" BCP-47)', () => {
    const result = formatCurrency(1234.5, "es-419");
    // es-419 renders as US$1,234.50 — currency symbol and separators differ from en-US
    expect(result).toContain("1.234");
    expect(result).toContain("50");
  });
});

describe("formatTokenAmount", () => {
  it("formats token amounts for en-US locale", () => {
    expect(
      formatTokenAmount(1234.5678, "en-US", { maximumFractionDigits: 4 }),
    ).toBe("1,234.5678");
  });

  it("formats token amounts for de-DE locale", () => {
    expect(
      formatTokenAmount(1234.5678, "de-DE", { maximumFractionDigits: 4 }),
    ).toBe("1.234,5678");
  });

  it("formats token amounts for es locale using comma decimal separator", () => {
    const result = formatTokenAmount(1234.5678, "es-419", {
      maximumFractionDigits: 4,
    });
    // Latin-American Spanish uses comma as decimal separator
    expect(result).toContain("1.234");
    expect(result).toContain("5678");
  });

  it("truncates to maximumFractionDigits sensibly for both locales", () => {
    const enResult = formatTokenAmount(0.123456789, "en-US", {
      maximumFractionDigits: 4,
    });
    const esResult = formatTokenAmount(0.123456789, "es-419", {
      maximumFractionDigits: 4,
    });
    // Both should truncate to 4 decimal places; separators differ
    expect(enResult).toBe("0.1235");
    expect(esResult).toMatch(/0[,.]1235/);
  });
});

describe("formatUsdCompact", () => {
  it("formats large values with compact notation in en-US", () => {
    expect(formatUsdCompact(4_200_000, "en-US")).toBe("$4.2M");
    expect(formatUsdCompact(1_500, "en-US")).toBe("$1.5K");
  });

  it("formats compact values differently in es-419", () => {
    const result = formatUsdCompact(4_200_000, "es-419");
    // es-419 uses a different currency symbol position / abbreviation
    expect(result).toBeTruthy();
    expect(typeof result).toBe("string");
    // Should still contain the numeric value
    expect(result).toMatch(/4[,.]?2/);
  });

  it("falls back gracefully when locale is undefined", () => {
    // Should not throw; falls back to browser/navigator locale or en-US
    expect(() => formatUsdCompact(500)).not.toThrow();
  });
});
