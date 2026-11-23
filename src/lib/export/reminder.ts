export type ReminderCancel = () => void;

/**
 * Schedules a reminder notification for an export job. Returns a cancel handle
 * that clears the pending timer so a completed, failed, or cancelled export
 * never fires a stale reminder.
 */
export function scheduleExportReminder(
  jobId: string,
  delayMs: number,
  notify: (jobId: string) => void,
): ReminderCancel {
  const timer = setTimeout(() => {
    notify(jobId);
  }, delayMs);

  return () => {
    clearTimeout(timer);
  };
}
