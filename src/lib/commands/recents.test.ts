import { beforeEach, describe, expect, it } from "vitest";
import { getRecentCommandIds, recordRecentCommand } from "./recents";
import { registerCommand } from "./registry";
import { STORAGE_KEYS, storage } from "../storage";

describe("command recents", () => {
  beforeEach(() => {
    storage.remove(STORAGE_KEYS.commandRecents);
  });

  it("filters out recents whose command is no longer registered", () => {
    const unregister = registerCommand({
      id: "test.registered",
      title: "Registered",
      group: "Navigation",
      run: () => {},
    });

    storage.set(STORAGE_KEYS.commandRecents, ["test.removed", "test.registered"]);

    expect(getRecentCommandIds()).toEqual(["test.registered"]);

    unregister();
  });

  it("keeps stored entries so a returning command is remembered", () => {
    recordRecentCommand("test.removed");

    expect(getRecentCommandIds()).toEqual([]);
    expect(storage.get<string[]>(STORAGE_KEYS.commandRecents)).toContain("test.removed");
  });
});
