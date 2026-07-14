import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOAST_DURATION_MS, useToastStore } from "./toast";

const initialState = useToastStore.getState();

describe("useToastStore", () => {
  beforeEach(() => {
    useToastStore.setState(initialState, true);
  });

  afterEach(() => {
    useToastStore.setState(initialState, true);
    vi.useRealTimers();
  });

  it("starts with no toasts", () => {
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("adds a toast with the given message and variant", () => {
    const id = useToastStore.getState().addToast("Swap submitted", "success");

    const [toast] = useToastStore.getState().toasts;
    expect(toast.id).toBe(id);
    expect(toast.message).toBe("Swap submitted");
    expect(toast.variant).toBe("success");
  });

  it("defaults to the 'info' variant", () => {
    useToastStore.getState().addToast("Heads up");
    expect(useToastStore.getState().toasts[0].variant).toBe("info");
  });

  it("dismisses a toast by id", () => {
    const id = useToastStore.getState().addToast("Bye soon");
    useToastStore.getState().dismissToast(id);
    expect(useToastStore.getState().toasts).toEqual([]);
  });

  it("auto-dismisses after the configured duration", () => {
    vi.useFakeTimers();
    useToastStore.getState().addToast("Auto-dismiss me");
    expect(useToastStore.getState().toasts).toHaveLength(1);

    vi.advanceTimersByTime(TOAST_DURATION_MS);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("supports multiple concurrent toasts", () => {
    useToastStore.getState().addToast("First");
    useToastStore.getState().addToast("Second");
    expect(useToastStore.getState().toasts).toHaveLength(2);
  });
});
