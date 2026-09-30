import { timeRemaining } from "@/lib/time";

/** Inline time-to-deadline label; turns amber in the final five minutes. */
export function DeadlineChip({ deadline, now = Date.now() }: { deadline: string; now?: number }) {
  const urgent = new Date(deadline).getTime() - now < 5 * 60_000;
  return (
    <time dateTime={deadline} title={new Date(deadline).toLocaleString()} className={urgent ? "text-vx-amber" : undefined}>
      {timeRemaining(deadline, now)}
    </time>
  );
}
