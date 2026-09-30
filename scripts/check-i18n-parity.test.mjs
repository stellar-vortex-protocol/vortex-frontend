import { describe, it, expect } from "vitest";
import {
  checkCatalogs,
  findJsxLiterals,
  findKeyReferences,
  parseCatalog,
  placeholders,
} from "./check-i18n-parity.mjs";

const EN = `export const en = {
  "swap.cta": "Swap {amount} {token}",
  "nav.docs": "Docs",
} as const;`;

describe("parseCatalog", () => {
  it("reads string entries, including ones split over two lines", () => {
    const catalog = parseCatalog(`export const es = {\n  "a.b":\n    "Hola",\n  "c": "x",\n} as const;`);
    expect([...catalog.entries()]).toEqual([
      ["a.b", "Hola"],
      ["c", "x"],
    ]);
  });
});

describe("checkCatalogs", () => {
  it("passes matching catalogs", () => {
    const es = parseCatalog(`export const es = { "swap.cta": "Cambiar {amount} {token}", "nav.docs": "Docs" };`);
    expect(checkCatalogs({ en: parseCatalog(EN), es })).toEqual([]);
  });

  it("reports missing and extra keys", () => {
    const es = parseCatalog(`export const es = { "swap.cta": "Cambiar {amount} {token}", "extra": "x" };`);
    expect(checkCatalogs({ en: parseCatalog(EN), es })).toEqual([
      'es: missing key "nav.docs"',
      'es: key "extra" is not in the English catalog',
    ]);
  });

  it("reports placeholder mismatches", () => {
    const es = parseCatalog(`export const es = { "swap.cta": "Cambiar {cantidad} {token}", "nav.docs": "Docs" };`);
    const [error] = checkCatalogs({ en: parseCatalog(EN), es });
    expect(error).toContain('"swap.cta"');
    expect(placeholders("Swap {amount} {token}")).toEqual(["amount", "token"]);
  });
});

describe("findKeyReferences", () => {
  it("collects literal keys and flags template-built keys", () => {
    const source = 'const a = t("nav.docs"); const b = t(`nav.${x}`); const c = t(KEYS[x]);';
    const { keys, dynamic } = findKeyReferences(source, "a.tsx");
    expect(keys.map((k) => k.key)).toEqual(["nav.docs"]);
    expect(dynamic).toHaveLength(1);
  });
});

describe("findJsxLiterals", () => {
  it("fails on a seeded hard-coded literal", () => {
    const fixture = `export function Page() {
      return (
        <main>
          <h1>{t("page.title")}</h1>
          <p>Hard-coded English sentence</p>
          <input placeholder="Search here" aria-label={t("search.label")} />
        </main>
      );
    }`;
    expect(findJsxLiterals(fixture, "page.tsx").map((l) => l.text)).toEqual([
      "Hard-coded English sentence",
      "Search here",
    ]);
  });

  it("ignores translated text, symbols and allowlisted brand names", () => {
    const fixture = `const x = (
      <div title={t("a.b")}>
        {t("a.c")} → · 42% <span>Vortex</span>
      </div>
    );`;
    expect(findJsxLiterals(fixture, "x.tsx", new Set(["Vortex"]))).toEqual([]);
  });
});
