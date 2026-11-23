import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { scheduleExportReminder } from "./reminder";
import { handleExportMessage } from "./runner";
import type { ExportResponse } from "./protocol";

describe("export reminder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not fire a reminder after an export completes", async () => {
    const notify = vi.fn();
    const post = vi.fn<(response: ExportResponse) => void>();
    const cancelled = new Set<string>();

    const reminderSpy = vi.spyOn({ scheduleExportReminder }, "scheduleExportReminder");
    void reminderSpy;

    await handleExportMessage(
      {
        type: "export",
        jobId: "job-1",
        items: [{ id: "a", label: "A" }],
        options: { format: "csv" },
      } as unknown as Parameters<typeof handleExportMessage>[0],
      cancelled,
      post,
    );

    vi.advanceTimersByTime(60_000);

    expect(notify).not.toHaveBeenCalled();
    expect(post).toHaveBeenCalledWith(expect.objectContaining({ type: "complete", jobId: "job-1" }));
  });

  it("clears the timer when cancelled", () => {
    const notify = vi.fn();
    const cancel = scheduleExportReminder("job-2", 1000, notify);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(notify).not.toHaveBeenCalled();
  });
});
