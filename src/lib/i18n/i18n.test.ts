import { describe, expect, it } from "vitest";
import {
  CATALOGS,
  createTranslator,
  interpolate,
  isLocale,
  translate,
  LOCALES,
} from "./index";
import { en } from "./messages/en";

describe("interpolate", () => {
  it("substitutes named placeholders", () => {
    expect(
      interpolate("Swap {amount} {srcToken}", {
        amount: "500",
        srcToken: "USDC",
      }),
    ).toBe("Swap 500 USDC");
  });

  it("coerces numeric values", () => {
    expect(interpolate("~{seconds}s", { seconds: 32 })).toBe("~32s");
  });

  it("leaves unknown placeholders untouched", () => {
    expect(interpolate("Hello {name}", {})).toBe("Hello {name}");
  });

  it("returns the template unchanged when no values are given", () => {
    expect(interpolate("Enter an amount")).toBe("Enter an amount");
  });
});

describe("translate", () => {
  it("resolves a key in the default locale", () => {
    expect(translate("en", "swap.submit.enterAmount")).toBe("Enter an amount");
  });

  it("fills placeholders", () => {
    expect(
      translate("en", "swap.submit.cta", {
        amount: "500",
        srcToken: "USDC",
        dstToken: "XLM",
      }),
    ).toBe("Swap 500 USDC → XLM");
  });

  it("falls back to the key when a message is missing", () => {
    expect(translate("en", "swap.does.not.exist" as never)).toBe(
      "swap.does.not.exist",
    );
  });
});

describe("createTranslator", () => {
  it("binds a locale", () => {
    const t = createTranslator("en");
    expect(t("swap.from.label")).toBe("From");
  });
});

describe("catalogs", () => {
  it("recognises registered locales only", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("xx")).toBe(false);
  });

  it("keeps every locale in sync with the English key set", () => {
    const expected = Object.keys(en).sort();
    for (const locale of LOCALES) {
      expect(Object.keys(CATALOGS[locale]).sort(), locale).toEqual(expected);
    }
  });
});
