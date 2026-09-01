import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useColumnVisibility } from "./useColumnVisibility";

const KEY = "test-columns";
const COLUMNS = ["a", "b", "c", "d"] as const;
const ALWAYS = ["a", "d"] as const;

describe("useColumnVisibility", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it("defaults every column to visible", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS, ALWAYS));
    expect(result.current.visibility).toEqual({ a: true, b: true, c: true, d: true });
  });

  it("toggles and persists a toggleable column", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS, ALWAYS));

    act(() => result.current.toggle("b"));
    expect(result.current.visibility.b).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY)!).b).toBe(false);
  });

  it("refuses to toggle an always-visible column", () => {
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS, ALWAYS));

    act(() => result.current.toggle("a"));
    expect(result.current.visibility.a).toBe(true);
    expect(result.current.isToggleable("a")).toBe(false);
    expect(result.current.isToggleable("b")).toBe(true);
  });

  it("restores a persisted preference and ignores unknown / non-boolean keys", () => {
    localStorage.setItem(KEY, JSON.stringify({ b: false, gone: false, c: "nope" }));
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS, ALWAYS));

    expect(result.current.visibility).toEqual({ a: true, b: false, c: true, d: true });
  });

  it("forces always-visible columns on even if storage says otherwise", () => {
    localStorage.setItem(KEY, JSON.stringify({ a: false, d: false }));
    const { result } = renderHook(() => useColumnVisibility(KEY, COLUMNS, ALWAYS));

    expect(result.current.visibility.a).toBe(true);
    expect(result.current.visibility.d).toBe(true);
  });
});
