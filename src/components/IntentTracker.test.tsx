import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { deriveTrackerSteps } from "@/lib/intentLifecycle";
import type { IntentDetail, IntentStatus } from "@/lib/types";
import { IntentTrackerView } from "./IntentTracker";

// The live wrapper's data layer is covered by its own tests; keep this suite
// focused on rendering (and independent of the API module).
vi.mock("@/hooks/useIntentLifecycle", () => ({ useIntentLifecycle: vi.fn() }));

const NOW = Date.parse("2026-01-01T12:00:00Z");
const intent = (status: IntentStatus, deadline = "2026-01-01T12:10:00Z"): IntentDetail => ({
  id: "i1",
  srcChain: "base",
  srcToken: "USDC",
  srcAmount: "25",
  dstToken: "XLM",
  solver: "s",
  status,
  createdAt: "2026-01-01T11:55:00Z",
  deadline,
  dstAmount: "200",
  minOut: "199",
  dstAddress: "GDEST",
});

function renderState(i: IntentDetail, props: { onDismiss?: () => void; hideDetailsLink?: boolean } = {}) {
  return render(
    <I18nProvider locale="en">
      <IntentTrackerView intent={i} view={deriveTrackerSteps(i, NOW)} {...props} />
    </I18nProvider>,
  );
}

describe("IntentTrackerView", () => {
  it("shows the pending state with a deadline countdown and no retry", () => {
    renderState(intent("pending"));
    expect(screen.getByText("Waiting for a solver")).toBeInTheDocument();
    expect(screen.getByText("Deadline in 10m 00s")).toBeInTheDocument();
    expect(screen.queryByText("Retry this swap")).toBeNull();
    expect(screen.getByRole("link", { name: "View details" })).toHaveAttribute("href", "/explore/i1");
  });

  it("shows the accepted state", () => {
    renderState(intent("accepted"));
    expect(screen.getByText("Solver is filling your swap")).toBeInTheDocument();
  });

  it("shows the filled state without countdown", () => {
    renderState(intent("filled"));
    expect(screen.getByText("Filled")).toBeInTheDocument();
    expect(screen.queryByText(/Deadline in/)).toBeNull();
  });

  it("shows failed guidance and a retry link that omits the destination", () => {
    renderState(intent("failed"));
    expect(screen.getByText(/Funds remain on the source chain/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retry this swap" })).toHaveAttribute(
      "href",
      "/?srcChain=base&srcToken=USDC&amount=25&dstToken=XLM",
    );
  });

  it("distinguishes expired from failed", () => {
    renderState(intent("pending", "2026-01-01T11:00:00Z"));
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText(/No solver filled this intent/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Retry this swap" })).toBeInTheDocument();
  });

  it("lets terminal trackers be dismissed and can hide the details link", () => {
    const onDismiss = vi.fn();
    renderState(intent("filled"), { onDismiss, hideDetailsLink: true });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss tracker" }));
    expect(onDismiss).toHaveBeenCalled();
    expect(screen.queryByText("View details")).toBeNull();
  });

  it("marks the active step for assistive tech", () => {
    const { container } = renderState(intent("accepted"));
    expect(container.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });
});
