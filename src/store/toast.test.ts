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
    expect(toast!.id).toBe(id);
    expect(toast!.message).toBe("Swap submitted");
    expect(toast!.variant).toBe("success");
  });

  it("defaults to the 'info' variant", () => {
    useToastStore.getState().addToast("Heads up");
    expect(useToastStore.getState().toasts[0]!.variant).toBe("info");
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

  it("pausing prevents auto-dismissal until resumed", () => {
    vi.useFakeTimers();
    const id = useToastStore.getState().addToast("Pause me");

    vi.advanceTimersByTime(TOAST_DURATION_MS - 500);
    useToastStore.getState().pauseToast(id);
    vi.advanceTimersByTime(10_000);
    expect(useToastStore.getState().toasts).toHaveLength(1);

    useToastStore.getState().resumeToast(id);
    vi.advanceTimersByTime(499);
    expect(useToastStore.getState().toasts).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("pausing/resuming one toast does not affect another's timer", () => {
    vi.useFakeTimers();
    const pausedId = useToastStore.getState().addToast("Paused");
    useToastStore.getState().addToast("Running");

    useToastStore.getState().pauseToast(pausedId);
    vi.advanceTimersByTime(TOAST_DURATION_MS);

    const remaining = useToastStore.getState().toasts;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(pausedId);
  });

  it("stores a valid internal href", () => {
    useToastStore.getState().addToast("Message", "info", "/explore/abc123");
    const [toast] = useToastStore.getState().toasts;
    expect(toast!.href).toBe("/explore/abc123");
  });

  it("stores a valid external href from a whitelisted origin", () => {
    useToastStore.getState().addToast(
      "Message",
      "info",
      "https://github.com/vortex-protocol",
    );
    const [toast] = useToastStore.getState().toasts;
    expect(toast!.href).toBe("https://github.com/vortex-protocol");
  });

  it("drops an invalid href (path traversal)", () => {
    useToastStore.getState().addToast(
      "Message",
      "info",
      "/../etc/passwd",
    );
    const [toast] = useToastStore.getState().toasts;
    expect(toast!.href).toBeUndefined();
  });

  it("drops an invalid href (non-whitelisted external)", () => {
    useToastStore.getState().addToast(
      "Message",
      "info",
      "https://evil.com/phishing",
    );
    const [toast] = useToastStore.getState().toasts;
    expect(toast!.href).toBeUndefined();
  });

  it("drops an invalid href (javascript: protocol)", () => {
    useToastStore.getState().addToast(
      "Message",
      "info",
      "javascript:alert(1)",
    );
    const [toast] = useToastStore.getState().toasts;
    expect(toast!.href).toBeUndefined();
  });

  it("does not store an href when none is provided", () => {
    useToastStore.getState().addToast("No href");
    const [toast] = useToastStore.getState().toasts;
    expect(toast!.href).toBeUndefined();
  });
});
