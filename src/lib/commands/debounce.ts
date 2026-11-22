/**
 * Trailing-edge debounce for the command palette's fuzzy scoring.
 *
 * Each call to `schedule` cancels any pending invocation, so a burst of rapid
 * query changes results in exactly one run of `fn` — with the latest
 * arguments — after `delayMs` of quiet. `cancel` drops a pending run (e.g. on
 * unmount or when the palette closes).
 */
export const COMMAND_SCORE_DEBOUNCE_MS = 100;

export type Debounced<A extends unknown[]> = {
  schedule: (...args: A) => void;
  cancel: () => void;
  flush: () => void;
};

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  delayMs: number = COMMAND_SCORE_DEBOUNCE_MS,
): Debounced<A> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: A | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const run = () => {
    timer = null;
    const args = pending;
    pending = null;
    if (args) fn(...args);
  };

  return {
    schedule(...args: A) {
      clear();
      pending = args;
      timer = setTimeout(run, delayMs);
    },
    cancel() {
      clear();
      pending = null;
    },
    flush() {
      if (timer === null) return;
      clear();
      run();
    },
  };
}
