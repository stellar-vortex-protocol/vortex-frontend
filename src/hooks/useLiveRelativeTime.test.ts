import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLiveRelativeTime } from "./useLiveRelativeTime";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useLiveRelativeTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    setVisibility("visible");
  });

  it("advances the returned timestamp on each interval tick", () => {
    const { result } = renderHook(() => useLiveRelativeTime(1000));
    const initial = result.current;

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeGreaterThan(initial);

    const afterOne = result.current;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeGreaterThan(afterOne);
  });

  it("pauses ticking while the tab is hidden and resumes when visible again", () => {
    const { result } = renderHook(() => useLiveRelativeTime(1000));

    act(() => setVisibility("hidden"));
    const whileHidden = result.current;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current).toBe(whileHidden);

    act(() => setVisibility("visible"));
    // Returning to the tab catches the value up immediately.
    expect(result.current).toBeGreaterThanOrEqual(whileHidden);

    const afterReturn = result.current;
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBeGreaterThan(afterReturn);
  });

  it("clears its interval on unmount", () => {
    const clearSpy = vi.spyOn(globalThis, "clearInterval");
    const { unmount } = renderHook(() => useLiveRelativeTime(1000));

    unmount();
    expect(clearSpy).toHaveBeenCalled();

    // No further work is scheduled after unmount.
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(5000);
      }),
    ).not.toThrow();
  });
});
