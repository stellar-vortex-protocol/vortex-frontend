import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCooldown } from "./useCooldown";

describe("useCooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is idle initially", () => {
    const { result } = renderHook(() => useCooldown(3000));
    expect(result.current.isCoolingDown()).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });

  it("counts down after start() and expires after the window", () => {
    const { result } = renderHook(() => useCooldown(3000));

    act(() => result.current.start());
    expect(result.current.isCoolingDown()).toBe(true);
    expect(result.current.remainingSeconds).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.remainingSeconds).toBe(2);
    expect(result.current.isCoolingDown()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.remainingSeconds).toBe(0);
    expect(result.current.isCoolingDown()).toBe(false);
  });

  it("reset() clears an active cooldown immediately", () => {
    const { result } = renderHook(() => useCooldown(3000));

    act(() => result.current.start());
    act(() => result.current.reset());

    expect(result.current.isCoolingDown()).toBe(false);
    expect(result.current.remainingSeconds).toBe(0);
  });
});
