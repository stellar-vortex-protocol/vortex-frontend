import { useSyncExternalStore } from "react";

/**
 * A single shared 1 s ticker. Every subscriber reads the same timestamp, so a
 * board with hundreds of countdowns runs one interval instead of one per row.
 * The interval only runs while at least one component is subscribed.
 */
const listeners = new Set<() => void>();
let now = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === null) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot() {
  return now;
}

/** Current time (ms), refreshed once per second by the shared ticker. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
