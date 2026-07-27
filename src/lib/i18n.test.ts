import { describe, expect, it } from "vitest";
import { getMessage } from "./i18n";

describe("i18n message catalog", () => {
  it("returns the English copy for explore page messages", () => {
    expect(getMessage("explore.page.hero.title")).toBe("Browse all intents");
    expect(getMessage("explore.page.liveLabel")).toBe("Live");
  });

  it("supports parameterized messages", () => {
    expect(getMessage("explore.detail.nav.label", { id: "intent-1" })).toBe("Intent intent-1");
    expect(getMessage("explore.page.intentCount", { count: 1 })).toBe("1 intent");
  });
});
