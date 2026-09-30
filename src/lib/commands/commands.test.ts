import { afterEach, describe, expect, it, vi } from "vitest";
import { fuzzyMatch, rankByQuery } from "./fuzzy";
import { registerCommand, useCommandRegistry } from "./registry";
import { MAX_RECENT_INTENTS, pushRecentIntent, readRecentIntents } from "./recents";

describe("fuzzyMatch", () => {
  it("matches subsequences and reports indices", () => {
    expect(fuzzyMatch("cw", "Connect wallet")?.indices).toEqual([0, 8]);
    expect(fuzzyMatch("xyz", "Connect wallet")).toBeNull();
  });

  it("scores prefixes above scattered matches", () => {
    expect(fuzzyMatch("con", "Connect")!.score).toBeGreaterThan(fuzzyMatch("con", "Reconnect")!.score);
  });
});

describe("rankByQuery", () => {
  const items = [
    { title: "Disconnect wallet", keywords: [] },
    { title: "Connect wallet", keywords: [] },
    { title: "Switch language", keywords: ["idioma"] },
  ];

  it("ranks the best match first and keeps ties stable", () => {
    const ranked = rankByQuery(items, "conn", (i) => i.title, (i) => i.keywords);
    expect(ranked.map((r) => r.item.title)).toEqual(["Connect wallet", "Disconnect wallet"]);
  });

  it("matches keywords without highlighting the title", () => {
    const [hit] = rankByQuery(items, "idioma", (i) => i.title, (i) => i.keywords);
    expect(hit?.item.title).toBe("Switch language");
    expect(hit?.indices).toEqual([]);
  });
});

describe("command registry", () => {
  afterEach(() => useCommandRegistry.setState({ commands: {} }));

  it("registers and unregisters commands", () => {
    const run = vi.fn();
    const unregister = registerCommand({ id: "x", title: "X", group: "Navigation", run });
    expect(useCommandRegistry.getState().commands["x"]?.title).toBe("X");
    unregister();
    expect(useCommandRegistry.getState().commands["x"]).toBeUndefined();
  });

  it("does not remove a newer registration with the same id", () => {
    const first = registerCommand({ id: "x", title: "Old", group: "Navigation", run: vi.fn() });
    registerCommand({ id: "x", title: "New", group: "Navigation", run: vi.fn() });
    first();
    expect(useCommandRegistry.getState().commands["x"]?.title).toBe("New");
  });
});

describe("recent intents", () => {
  afterEach(() => window.localStorage.clear());

  it("keeps the most recent unique ids, capped", () => {
    for (let i = 0; i < MAX_RECENT_INTENTS + 2; i++) pushRecentIntent(`i-${i}`);
    pushRecentIntent("i-5");
    const recents = readRecentIntents();
    expect(recents).toHaveLength(MAX_RECENT_INTENTS);
    expect(recents[0]).toBe("i-5");
    expect(new Set(recents).size).toBe(recents.length);
  });

  it("tolerates corrupt storage", () => {
    window.localStorage.setItem("vortex-recent-intents", "{");
    expect(readRecentIntents()).toEqual([]);
  });
});
