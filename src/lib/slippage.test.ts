import { describe, expect, it } from "vitest";
import { computeMinOut, getSlippageStatus, parseSlippageInput } from "./slippage";

describe("computeMinOut", () => {
  it("rounds down at the token's decimals", () => {
    expect(computeMinOut("497.1234", 1, 7)).toBe("492.152166");
    expect(computeMinOut("1", 0.5, 6)).toBe("0.995");
    expect(computeMinOut("0.0000003", 50, 7)).toBe("0.0000001");
    expect(computeMinOut("0.000001", 0.5, 6)).toBe("0");
  });

  it("stays exact for 18-decimal amounts", () => {
    expect(computeMinOut("1.000000000000000001", 0.1, 18)).toBe("0.999");
    expect(computeMinOut("123456789.123456789123456789", 0.5, 18)).toBe("122839505.177839505177839505");
  });

  it("truncates excess input precision and rejects bad input", () => {
    expect(computeMinOut("1.23456789", 0, 7)).toBe("1.2345678");
    expect(computeMinOut("", 0.5, 7)).toBe("0");
    expect(computeMinOut("-1", 0.5, 7)).toBe("0");
    expect(computeMinOut("abc", 0.5, 7)).toBe("0");
    expect(computeMinOut("1", Number.NaN, 7)).toBe("0");
  });
});

describe("parseSlippageInput", () => {
  it("accepts comma decimals and percent suffixes", () => {
    expect(parseSlippageInput("0,5")).toBe(0.5);
    expect(parseSlippageInput(" 0.5% ")).toBe(0.5);
    expect(parseSlippageInput("1.")).toBe(1);
  });

  it("returns NaN for negatives and garbage", () => {
    expect(parseSlippageInput("-1")).toBeNaN();
    expect(parseSlippageInput("abc")).toBeNaN();
    expect(parseSlippageInput("")).toBeNaN();
  });
});

describe("getSlippageStatus", () => {
  it("classifies the validation bands", () => {
    expect(getSlippageStatus(0.005)).toBe("invalid");
    expect(getSlippageStatus(0.05)).toBe("low");
    expect(getSlippageStatus(0.5)).toBe("ok");
    expect(getSlippageStatus(5)).toBe("ok");
    expect(getSlippageStatus(10)).toBe("high");
    expect(getSlippageStatus(50)).toBe("high");
    expect(getSlippageStatus(50.01)).toBe("invalid");
    expect(getSlippageStatus(Number.NaN)).toBe("invalid");
  });
});
