import { describe, expect, it } from "vitest";
import { getMessage } from "./i18n-legacy";

describe("i18n", () => {
  it("retrieves messages from the catalog using dot notation", () => {
    expect(getMessage("footer.copyright")).toBe(
      "© 2025 Vortex Protocol · MIT License",
    );
    expect(getMessage("footer.github")).toBe("GitHub");
    expect(getMessage("footer.discord")).toBe("Discord");
  });

  it("returns the key when a message is not found", () => {
    expect(getMessage("nonexistent.key" as any)).toBe("nonexistent.key");
  });
});
