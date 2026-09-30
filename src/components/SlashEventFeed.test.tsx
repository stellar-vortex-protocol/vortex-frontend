import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
// api.ts is not exercised here; mock it so the feed renders in isolation.
vi.mock("@/lib/api", () => ({ fetcher: vi.fn() }));

import { SlashEventFeed } from "./SlashEventFeed";
import type { SlashEvent } from "@/lib/slashEvents";

const event: SlashEvent = {
  id: "e1",
  solver: "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB",
  reasonCode: "missed_deadline",
  amountUsd: "12.00",
  resultingBondUsd: "488.00",
  intentId: "intent-9",
  createdAt: "2025-06-10T12:00:00Z",
};

describe("SlashEventFeed", () => {
  it("shows empty and error states", () => {
    const { rerender } = render(<SlashEventFeed events={[]} />);
    expect(screen.getByRole("status").textContent).toContain("No penalties recorded.");
    rerender(<SlashEventFeed events={[]} error={new Error("x")} />);
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("groups by day, keeps unknown codes visible and opens the detail drawer", () => {
    render(<SlashEventFeed events={[event, { ...event, id: "e2", reasonCode: "mystery" }]} />);
    expect(screen.getByText("2025-06-10")).toBeTruthy();
    expect(screen.getByText("(mystery)")).toBeTruthy();

    fireEvent.click(screen.getAllByRole("button", { name: /Missed deadline/ })[0]!);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("$488.00");
    expect(screen.getByRole("link", { name: "intent-9" }).getAttribute("href")).toBe("/explore/intent-9");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("loads more pages on demand", () => {
    const onLoadMore = vi.fn();
    render(<SlashEventFeed events={[event]} hasMore onLoadMore={onLoadMore} />);
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalled();
  });
});
