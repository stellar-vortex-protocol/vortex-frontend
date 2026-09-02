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

  it("copies text to the clipboard and returns true", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCopyToClipboard());
    let success = false;
    await act(async () => {
      success = await result.current.copy("0xabc");
    });

    expect(writeText).toHaveBeenCalledWith("0xabc");
    expect(success).toBe(true);
  });

  it("handles clipboard failures gracefully and returns false", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    const { result } = renderHook(() => useCopyToClipboard());
    let success = true;
    await act(async () => {
      success = await result.current.copy("0xabc");
    });

    expect(success).toBe(false);
  });
});
