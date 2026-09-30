import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_VIEWS,
  normalizeViewName,
  sanitizeViewParams,
  sanitizeViews,
  stripAddresses,
  useViewsStore,
  viewParamsToSearch,
} from "./views";

const ADDRESS = "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

describe("views helpers", () => {
  it("keeps valid params and drops defaults", () => {
    expect(sanitizeViewParams("explore", { status: "filled", chain: "all", sort: "largest" })).toEqual({
      params: { status: "filled", sort: "largest" },
      degraded: false,
    });
  });

  it("degrades gracefully for removed chains and unknown keys", () => {
    expect(sanitizeViewParams("explore", { chain: "removed-chain", foo: "bar", status: "failed" })).toEqual({
      params: { status: "failed" },
      degraded: true,
    });
  });

  it("scopes keys: my-intents ignores q and sort", () => {
    expect(sanitizeViewParams("my-intents", { q: "abc", sort: "oldest", range: "30" }).params).toEqual({ range: "30" });
  });

  it("never keeps wallet addresses in the query", () => {
    expect(stripAddresses(`abc ${ADDRESS} def`)).toBe("abc def");
    expect(sanitizeViewParams("explore", { q: ADDRESS }).params).toEqual({});
  });

  it("serialises params to a query string", () => {
    expect(viewParamsToSearch({})).toBe("");
    expect(viewParamsToSearch({ status: "failed", range: "7" })).toBe("?status=failed&range=7");
  });

  it("normalises names and resolves collisions", () => {
    expect(normalizeViewName("  My‮ view  ", [])).toBe("My view");
    expect(normalizeViewName("Ops", ["ops"])).toBe("Ops (2)");
    expect(normalizeViewName("Ops", ["Ops", "Ops (2)"])).toBe("Ops (3)");
    expect(normalizeViewName("   ", [])).toBe("");
    expect(normalizeViewName("x".repeat(80), [])).toHaveLength(40);
  });

  it("drops corrupted persisted entries", () => {
    const result = sanitizeViews({
      views: [
        { id: "1", name: "ok", scope: "explore", params: { status: "filled" } },
        { id: 2, name: "bad id" },
        null,
        { id: "3", name: "", scope: "explore", params: {} },
        { id: "4", name: "bad scope", scope: "nope", params: {} },
      ] as never,
    });
    expect(result.views.map((v) => v.id)).toEqual(["1"]);
  });
});

describe("useViewsStore", () => {
  beforeEach(() => {
    useViewsStore.setState({ views: [] });
  });

  const { saveView, renameView, deleteView, moveView } = useViewsStore.getState();
  const names = () => useViewsStore.getState().views.map((v) => v.name);

  it("saves, renames and deletes", () => {
    const id = saveView("explore", "Mine", { status: "failed" });
    expect(id).not.toBeNull();
    renameView(id!, "Renamed");
    expect(names()).toEqual(["Renamed"]);
    deleteView(id!);
    expect(names()).toEqual([]);
  });

  it("rejects empty names and enforces the cap", () => {
    expect(saveView("explore", " ", {})).toBeNull();
    for (let i = 0; i < MAX_VIEWS; i += 1) saveView("explore", `v${i}`, {});
    expect(saveView("explore", "one too many", {})).toBeNull();
    expect(useViewsStore.getState().views).toHaveLength(MAX_VIEWS);
  });

  it("reorders within a scope, skipping other scopes", () => {
    const a = saveView("explore", "A", {})!;
    saveView("my-intents", "M", {});
    const b = saveView("explore", "B", {})!;
    moveView(b, -1);
    expect(names()).toEqual(["B", "M", "A"]);
    moveView(b, -1);
    expect(names()).toEqual(["B", "M", "A"]);
    moveView(a, 1);
    expect(names()).toEqual(["B", "M", "A"]);
  });

  it("resolves rename collisions", () => {
    saveView("explore", "A", {});
    const b = saveView("explore", "B", {})!;
    renameView(b, "A");
    expect(names()).toEqual(["A", "A (2)"]);
  });
});
