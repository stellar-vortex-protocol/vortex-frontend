import { beforeEach, describe, expect, it } from "vitest";
import { STORAGE_KEYS, storage } from "@/lib/storage";
import { getRecentCommandIds } from "./recents";
import { registerCommand } from "./registry";

describe("command recents", () => {
  beforeEach(() => {
    storage.remove(STORAGE_KEYS.commandRecents);
  });

  it("drops ids that are no longer in the registry", () => {
    const unregister = registerCommand({
      id: "known.command",
      title: "Known",
      group: "Navigation",
      run: () => {},
    });

    storage.set(STORAGE_KEYS.commandRecents, ["known.command", "bogus.command"]);

    expect(getRecentCommandIds()).toEqual(["known.command"]);

    unregister();
  });
});
