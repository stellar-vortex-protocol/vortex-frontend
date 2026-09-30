import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useBufferedFeed } from "./useBufferedFeed";

type Item = { id: string; status?: string };
const ids = (items: Item[]) => items.map((i) => i.id);

describe("useBufferedFeed", () => {
  it("passes items straight through while live", () => {
    const { result, rerender } = renderHook(({ items }) => useBufferedFeed(items, { isPaused: false }), {
      initialProps: { items: [{ id: "a" }] as Item[] },
    });
    rerender({ items: [{ id: "b" }, { id: "a" }] });
    expect(ids(result.current.visible)).toEqual(["b", "a"]);
    expect(result.current.pending).toBe(0);
  });

  it("buffers inserts while paused but updates visible items in place", () => {
    const { result, rerender } = renderHook(
      ({ items, isPaused }) => useBufferedFeed(items, { isPaused }),
      { initialProps: { items: [{ id: "a", status: "pending" }] as Item[], isPaused: false } },
    );
    rerender({ items: [{ id: "a", status: "pending" }], isPaused: true });
    rerender({ items: [{ id: "b" }, { id: "a", status: "filled" }], isPaused: true });

    expect(ids(result.current.visible)).toEqual(["a"]);
    expect(result.current.visible[0]?.status).toBe("filled");
    expect(result.current.pending).toBe(1);
  });

  it("caps the pending count and flags overflow", () => {
    const burst = Array.from({ length: 12 }, (_, i) => ({ id: `n${i}` }));
    const { result, rerender } = renderHook(
      ({ items, isPaused }) => useBufferedFeed(items, { isPaused, cap: 10 }),
      { initialProps: { items: [{ id: "a" }] as Item[], isPaused: false } },
    );
    rerender({ items: [{ id: "a" }], isPaused: true });
    rerender({ items: [...burst, { id: "a" }], isPaused: true });
    expect(result.current.pending).toBe(10);
    expect(result.current.overflow).toBe(true);
  });

  it("does not buffer the first snapshot even when paused", () => {
    const { result } = renderHook(() => useBufferedFeed([{ id: "a" }], { isPaused: true }));
    expect(ids(result.current.visible)).toEqual(["a"]);
  });
});
