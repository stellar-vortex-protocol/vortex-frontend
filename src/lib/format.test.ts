import { describe, expect, it } from "vitest";
import { formatCurrency, formatTokenAmount } from "./format";

describe("formatCurrency", () => {
  it("formats USD values for en-US locale", () => {
    expect(formatCurrency(1234.5, "en-US")).toBe("$1,234.50");
  });

  it("formats USD values for de-DE locale", () => {
    expect(formatCurrency(1234.5, "de-DE")).toBe("1.234,50 $");
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
});
