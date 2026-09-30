import { describe, expect, it } from "vitest";
import {
  abs,
  add,
  applySlippage,
  compare,
  decimal,
  DecimalError,
  deviationPct,
  div,
  format,
  fromNumber,
  fromStroops,
  isPositive,
  isZero,
  mul,
  parseDecimal,
  parseRounded,
  rescale,
  sub,
  toNumber,
  toStroops,
  tryParseDecimal,
  zero,
} from "./decimal";

const B = (v: string | number) => BigInt(v);

describe("parseDecimal / format golden vectors", () => {
  it.each([
    ["1.5", 6, "1500000"],
    ["0.000001", 6, "1"],
    ["12.5", 7, "125000000"],
    ["0.0000001", 7, "1"],
    ["21000000", 8, "2100000000000000"],
    ["0.1", 18, "100000000000000000"],
    ["340282366920938463463.374607431768211455", 18, "340282366920938463463374607431768211455"], // max u128
    [".5", 6, "500000"],
    ["5.", 6, "5000000"],
    ["0", 18, "0"],
  ])("%s @ %i decimals → %s units", (input, decimals, units) => {
    const d = parseDecimal(input, decimals);
    expect(d.units).toBe(B(units));
    expect(parseDecimal(format(d), decimals).units).toBe(d.units);
  });

  it("formats with and without trailing zeros", () => {
    expect(format(decimal(B(1500000), 6))).toBe("1.5");
    expect(format(decimal(B(1500000), 6), { trimZeros: false })).toBe("1.500000");
    expect(format(decimal(B(-1), 4))).toBe("-0.0001");
    expect(format(zero(3))).toBe("0");
    expect(format(decimal(B(7), 0))).toBe("7");
  });

  it("rejects exponent notation, negatives, excess decimals and junk", () => {
    const code = (fn: () => unknown) => {
      try {
        fn();
      } catch (e) {
        return (e as DecimalError).code;
      }
      return null;
    };
    expect(code(() => parseDecimal("1e18", 18))).toBe("exponent");
    expect(code(() => parseDecimal("-1", 6))).toBe("negative");
    expect(code(() => parseDecimal("0.1234567", 6))).toBe("too-many-decimals");
    expect(code(() => parseDecimal("1,000.5", 6))).toBe("invalid");
    expect(code(() => parseDecimal("", 6))).toBe("invalid");
    expect(code(() => parseDecimal("abc", 6))).toBe("invalid");
    expect(tryParseDecimal("nope", 6)).toBeNull();
    expect(parseDecimal("-1", 6, { allowNegative: true }).units).toBe(B(-1000000));
  });

  it("accepts a locale decimal separator", () => {
    expect(parseDecimal("1,5", 6, { decimalSeparator: "," }).units).toBe(B(1500000));
    expect(tryParseDecimal("1.000,5", 6, { decimalSeparator: "," })).toBeNull();
  });

  it("validates decimals", () => {
    expect(() => decimal(B(1), -1)).toThrow(RangeError);
    expect(() => decimal(B(1), 1.5)).toThrow(RangeError);
  });
});

describe("rounding", () => {
  it.each([
    ["1.25", "floor", "1.2"],
    ["1.25", "ceil", "1.3"],
    ["1.25", "half-up", "1.3"],
    ["1.24", "half-up", "1.2"],
    ["-1.25", "floor", "-1.3"],
    ["-1.25", "ceil", "-1.2"],
    ["-1.25", "half-up", "-1.3"],
    ["1.20", "ceil", "1.2"],
  ] as const)("%s %s → %s", (input, mode, out) => {
    const d = parseDecimal(input, 2, { allowNegative: true });
    expect(format(rescale(d, 1, mode))).toBe(out);
  });

  it("parseRounded rounds excess precision instead of rejecting", () => {
    expect(format(parseRounded("1.23456", 2))).toBe("1.23");
    expect(format(parseRounded("1.235", 2))).toBe("1.24");
    expect(format(parseRounded("1.239", 2, "floor"))).toBe("1.23");
  });

  it("fromNumber avoids exponent notation", () => {
    expect(format(fromNumber(1e-7, 7))).toBe("0.0000001");
    expect(format(fromNumber(1e21, 0))).toBe("1000000000000000000000");
    expect(format(fromNumber(0.1 + 0.2, 6))).toBe("0.3");
    expect(() => fromNumber(Number.NaN, 2)).toThrow(DecimalError);
  });
});

describe("arithmetic", () => {
  const d6 = (s: string) => parseDecimal(s, 6, { allowNegative: true });

  it("adds and subtracts across scales without float error", () => {
    expect(format(add(parseDecimal("0.1", 18), parseDecimal("0.2", 6)))).toBe("0.3");
    expect(format(sub(d6("1"), d6("1.5")))).toBe("-0.5");
  });

  it("multiplies and divides with explicit rounding", () => {
    expect(format(mul(d6("1.5"), d6("2"), 6))).toBe("3");
    expect(format(mul(d6("0.000001"), d6("0.5"), 6, "floor"))).toBe("0");
    expect(format(mul(d6("0.000001"), d6("0.5"), 6, "ceil"))).toBe("0.000001");
    expect(format(mul(decimal(B(3), 0), decimal(B(2), 0), 4))).toBe("6");
    expect(format(div(d6("1"), d6("3"), 6, "floor"))).toBe("0.333333");
    expect(format(div(d6("2"), d6("3"), 6, "half-up"))).toBe("0.666667");
    expect(format(div(parseDecimal("1", 18), d6("4"), 2))).toBe("0.25");
    expect(() => div(d6("1"), d6("0"))).toThrow(RangeError);
    expect(format(div(d6("-1"), d6("-3"), 2, "floor"))).toBe("0.33");
  });

  it("compares and inspects", () => {
    expect(compare(d6("1"), parseDecimal("1.0", 18))).toBe(0);
    expect(compare(d6("1"), d6("2"))).toBe(-1);
    expect(compare(d6("2"), d6("1"))).toBe(1);
    expect(isZero(zero(6))).toBe(true);
    expect(isPositive(d6("0.000001"))).toBe(true);
    expect(format(abs(d6("-2")))).toBe("2");
    expect(abs(d6("2"))).toEqual(d6("2"));
    expect(toNumber(d6("1.5"))).toBe(1.5);
  });

  it("applySlippage floors so protection never exceeds the setting", () => {
    expect(format(applySlippage(parseDecimal("100", 7), parseDecimal("0.5", 1)))).toBe("99.5");
    expect(format(applySlippage(parseDecimal("0.0000003", 7), parseDecimal("50", 0)))).toBe("0.0000001");
  });

  it("deviationPct rounds up so tolerance checks are conservative", () => {
    expect(format(deviationPct(d6("101"), d6("100"), 2))).toBe("1");
    expect(format(deviationPct(d6("100.000001"), d6("100"), 2))).toBe("0.01");
  });
});

describe("stroops", () => {
  it("converts both ways at 7 decimals", () => {
    expect(toStroops("12.5")).toBe(B(125000000));
    expect(fromStroops(B(125000000))).toBe("12.5000000");
    expect(fromStroops(B(1))).toBe("0.0000001");
    expect(() => toStroops("0.00000001")).toThrow(DecimalError);
  });
});

describe("properties (seeded randomized)", () => {
  // Deterministic LCG so failures are reproducible without a dependency.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const randUnits = () => B(Math.floor(rand() * 1e15)) * B(Math.floor(rand() * 1e6) + 1);

  it("format/parse round-trips and add/sub are inverse", () => {
    for (const decimals of [6, 7, 8, 18]) {
      for (let i = 0; i < 200; i++) {
        const a = decimal(randUnits(), decimals);
        const b = decimal(randUnits(), decimals);
        expect(parseDecimal(format(a), decimals)).toEqual(a);
        expect(sub(add(a, b), b)).toEqual(a);
        expect(add(a, b)).toEqual(add(b, a));
        expect(compare(a, b)).toBe(-compare(b, a));
        // floor ≤ exact ≤ ceil when dividing
        if (!isZero(b)) {
          const lo = div(a, b, 4, "floor");
          const hi = div(a, b, 4, "ceil");
          expect(compare(lo, hi) <= 0).toBe(true);
          expect(sub(hi, lo).units <= B(1)).toBe(true);
        }
      }
    }
  });
});
