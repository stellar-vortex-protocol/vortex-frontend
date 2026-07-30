import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCopyToClipboard } from "./useCopyToClipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("copies text to the clipboard and marks as copied", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => result.current.copy("0xabc"));

    expect(writeText).toHaveBeenCalledWith("0xabc");
    expect(result.current.copied).toBe(true);

    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.copied).toBe(false);
  });

  it("handles clipboard failures gracefully", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCopyToClipboard());
    await act(async () => result.current.copy("0xabc"));

    expect(result.current.copied).toBe(false);
  });
});
