import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { addToastMock } = vi.hoisted(() => ({
  addToastMock: vi.fn(),
}));

vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));

import { useGlobalErrorCapture } from "./useGlobalErrorCapture";

describe("useGlobalErrorCapture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers window 'error' and 'unhandledrejection' listeners on mount", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    renderHook(() => useGlobalErrorCapture());

    expect(addSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(addSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });

  it("removes both listeners on unmount", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useGlobalErrorCapture());
    unmount();

    expect(removeSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
  });

  it("forwards a synchronous ErrorEvent to the toast store", () => {
    renderHook(() => useGlobalErrorCapture());

    act(() => {
      const event = new ErrorEvent("error", {
        error: new Error("Something exploded"),
        message: "Something exploded",
      });
      window.dispatchEvent(event);
    });

    expect(addToastMock).toHaveBeenCalledWith("Something exploded", "error");
  });

  it("handles an ErrorEvent with no error object (message fallback)", () => {
    renderHook(() => useGlobalErrorCapture());

    act(() => {
      const event = new ErrorEvent("error", { message: "script error from string" });
      window.dispatchEvent(event);
    });

    expect(addToastMock).toHaveBeenCalledWith("script error from string", "error");
  });

  it("invokes the unhandledrejection handler with an Error reason", () => {
    // jsdom does not define PromiseRejectionEvent, so we call the listener
    // directly by capturing it from addEventListener.
    const handlers = new Map<string, EventListener>();
    const addSpy = vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        handlers.set(type, listener as EventListener);
      }
    );

    renderHook(() => useGlobalErrorCapture());

    const handler = handlers.get("unhandledrejection");
    expect(handler).toBeDefined();

    act(() => {
      handler!({ type: "unhandledrejection", reason: new Error("Promise blew up") } as unknown as Event);
    });

    expect(addToastMock).toHaveBeenCalledWith("Promise blew up", "error");
    addSpy.mockRestore();
  });

  it("handles a string rejection reason", () => {
    const handlers = new Map<string, EventListener>();
    const addSpy = vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        handlers.set(type, listener as EventListener);
      }
    );

    renderHook(() => useGlobalErrorCapture());

    const handler = handlers.get("unhandledrejection")!;
    act(() => {
      handler({ type: "unhandledrejection", reason: "plain string error" } as unknown as Event);
    });

    expect(addToastMock).toHaveBeenCalledWith("plain string error", "error");
    addSpy.mockRestore();
  });

  it("uses a fallback message for null rejection reasons", () => {
    const handlers = new Map<string, EventListener>();
    const addSpy = vi.spyOn(window, "addEventListener").mockImplementation(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        handlers.set(type, listener as EventListener);
      }
    );

    renderHook(() => useGlobalErrorCapture());

    const handler = handlers.get("unhandledrejection")!;
    act(() => {
      handler({ type: "unhandledrejection", reason: null } as unknown as Event);
    });

    expect(addToastMock).toHaveBeenCalledWith("An unexpected error occurred.", "error");
    addSpy.mockRestore();
  });

  it("truncates very long error messages", () => {
    renderHook(() => useGlobalErrorCapture());

    const longMessage = "x".repeat(200);
    act(() => {
      const event = new ErrorEvent("error", {
        error: new Error(longMessage),
        message: longMessage,
      });
      window.dispatchEvent(event);
    });

    const [toastMsg] = addToastMock.mock.calls[0] as [string, string];
    expect(toastMsg.length).toBeLessThanOrEqual(121); // 120 chars + ellipsis
    expect(toastMsg.endsWith("…")).toBe(true);
  });

  it("does not fire after the component unmounts", () => {
    // Spy on removeEventListener to confirm it is called on cleanup.
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useGlobalErrorCapture());

    unmount();

    // Both listeners must be deregistered so no more toasts appear.
    expect(removeSpy).toHaveBeenCalledWith("error", expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith("unhandledrejection", expect.any(Function));
    // No toasts were fired during this test.
    expect(addToastMock).not.toHaveBeenCalled();
  });

  it("also logs via console.error", () => {
    renderHook(() => useGlobalErrorCapture());

    act(() => {
      const event = new ErrorEvent("error", {
        error: new Error("logged error"),
        message: "logged error",
      });
      window.dispatchEvent(event);
    });

    expect(console.error).toHaveBeenCalled();
  });
});
