import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectivity } from "./useConnectivity";

// Mock SWR's global mutate so we can assert it's called on reconnection.
const mutateMock = vi.fn();
vi.mock("swr", async (importOriginal) => {
  const actual = await importOriginal<typeof import("swr")>();
  return { ...actual, mutate: mutateMock };
});

// ── Helpers ────────────────────────────────────────────────────────────────

function fireOffline() {
  window.dispatchEvent(new Event("offline"));
}

function fireOnline() {
  window.dispatchEvent(new Event("online"));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("useConnectivity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mutateMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts online", () => {
    const { result } = renderHook(() => useConnectivity());
    expect(result.current.connectivity).toBe("online");
    expect(result.current.reconnectionCount).toBe(0);
  });

  it("transitions to offline after the debounce delay on an offline event", async () => {
    const { result } = renderHook(() => useConnectivity());

    act(() => {
      fireOffline();
    });

    // Before debounce fires, still online.
    expect(result.current.connectivity).toBe("online");

    await act(async () => {
      vi.advanceTimersByTime(1600); // > OFFLINE_DEBOUNCE_MS (1500ms)
    });

    expect(result.current.connectivity).toBe("offline");
  });

  it("does NOT transition to offline if the connection is restored before the debounce fires", async () => {
    const { result } = renderHook(() => useConnectivity());

    act(() => {
      fireOffline();
    });

    // Quickly reconnect before the debounce (1500ms) fires.
    await act(async () => {
      vi.advanceTimersByTime(500);
      fireOnline();
      vi.advanceTimersByTime(2000);
    });

    // We never reached the debounce threshold so we stayed online.
    expect(result.current.connectivity).toBe("online");
  });

  it("transitions back to online after going offline", async () => {
    const { result } = renderHook(() => useConnectivity());

    act(() => {
      fireOffline();
    });

    await act(async () => {
      vi.advanceTimersByTime(1600);
    });

    expect(result.current.connectivity).toBe("offline");

    act(() => {
      fireOnline();
    });

    expect(result.current.connectivity).toBe("online");
  });

  it("increments reconnectionCount each time connectivity is restored", async () => {
    const { result } = renderHook(() => useConnectivity());

    // First offline→online cycle
    act(() => { fireOffline(); });
    await act(async () => { vi.advanceTimersByTime(1600); });
    act(() => { fireOnline(); });

    expect(result.current.reconnectionCount).toBe(1);

    // Second cycle
    act(() => { fireOffline(); });
    await act(async () => { vi.advanceTimersByTime(1600); });
    act(() => { fireOnline(); });

    expect(result.current.reconnectionCount).toBe(2);
  });

  it("calls SWR global mutate exactly once per reconnection", async () => {
    renderHook(() => useConnectivity());

    act(() => { fireOffline(); });
    await act(async () => { vi.advanceTimersByTime(1600); });
    act(() => { fireOnline(); });

    expect(mutateMock).toHaveBeenCalledTimes(1);

    act(() => { fireOffline(); });
    await act(async () => { vi.advanceTimersByTime(1600); });
    act(() => { fireOnline(); });

    // Should fire once more — still exactly once per reconnection, not
    // once per flapping offline event.
    expect(mutateMock).toHaveBeenCalledTimes(2);
  });

  it("does NOT call SWR mutate when coming online without having been offline", () => {
    renderHook(() => useConnectivity());

    // Dispatch an online event without ever having been offline.
    act(() => { fireOnline(); });

    expect(mutateMock).not.toHaveBeenCalled();
  });

  it("cleans up event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useConnectivity());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
  });
});
