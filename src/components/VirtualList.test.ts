import { describe, expect, it } from "vitest";
import { isRestorable, nextActiveIndex } from "./VirtualList";

describe("nextActiveIndex", () => {
  it.each([
    ["ArrowDown", 2, 3],
    ["ArrowUp", 2, 1],
    ["ArrowUp", 0, 0],
    ["Home", 5, 0],
    ["End", 0, 9],
    ["PageDown", 8, 9],
    ["PageUp", 4, 0],
    ["a", 3, null],
  ])("%s from %i → %s", (key, from, expected) => {
    expect(nextActiveIndex(key, from, 10, 5)).toBe(expected);
  });

  it("returns null for an empty list", () => {
    expect(nextActiveIndex("ArrowDown", 0, 0, 5)).toBeNull();
  });
});

describe("isRestorable", () => {
  const saved = { offset: 400, activeIndex: 4, count: 100, firstKey: "a" };
  it("restores when the data set is materially the same", () => {
    expect(isRestorable(saved, 110, "a")).toBe(true);
  });
  it("skips when the first item or size changed materially", () => {
    expect(isRestorable(saved, 100, "b")).toBe(false);
    expect(isRestorable(saved, 50, "a")).toBe(false);
  });
});
