import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IntentDetail } from "@/lib/types";

const { useIntentMock } = vi.hoisted(() => ({ useIntentMock: vi.fn() }));
vi.mock("@/hooks/useIntent", () => ({ useIntent: useIntentMock }));
// Nav/Footer are app chrome that needs wallet + i18n context this suite does
// not set up - stub them so the record itself is what's under test.
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));

import IntentDetailPage from "./page";

const detail: IntentDetail = {
  id: "intent-1",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500",
  dstToken: "USDC",
  dstAmount: "498.5",
  minOut: "495",
  dstAddress: "GABCDEFGHIJKLMNOPQRSTUVWXYZ23456",
  solver: "Alpha Market Making",
  status: "filled",
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  deadline: new Date(Date.now() + 5 * 60_000).toISOString(),
  txHash: "abc1234567890hash",
};

describe("IntentDetailPage", () => {
  it("shows a loading skeleton while the intent is being fetched", () => {
    useIntentMock.mockReturnValue({ intent: undefined, isLoading: true, error: undefined });
    const { container } = render(<IntentDetailPage params={{ id: "intent-1" }} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an error state when the intent can't be found", () => {
    useIntentMock.mockReturnValue({ intent: undefined, isLoading: false, error: new Error("not found") });
    render(<IntentDetailPage params={{ id: "missing" }} />);
    expect(screen.getByText(/Couldn't find that intent/)).toBeInTheDocument();
  });

  it("shows a not-found message when the request succeeds with no intent data", () => {
    useIntentMock.mockReturnValue({ intent: undefined, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);
    expect(screen.getByText("No details found for this intent.")).toBeInTheDocument();
  });

  it("renders the intent's details", () => {
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.getByText("500 USDC → 498.5 USDC")).toBeInTheDocument();
    expect(screen.getByText("Alpha Market Making")).toBeInTheDocument();
    expect(screen.getByText("495 USDC")).toBeInTheDocument();
    expect(screen.getByText("GABCDE...Z23456")).toBeInTheDocument();
  });

  it("shows a truncated tx hash, a copy button, and a stellar.expert link when a txHash is present", () => {
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.getByText("abc123...90hash")).toBeInTheDocument();
    expect(screen.getByText("Copy")).toBeInTheDocument();
    expect(screen.getByText(/View on stellar.expert/)).toBeInTheDocument();
  });

  it("links to the settlement tx on stellar.expert when a txHash is present", () => {
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    const link = screen.getByText(/View on stellar.expert/);
    expect(link).toHaveAttribute("href", "https://stellar.expert/explorer/testnet/tx/abc1234567890hash");
  });

  it("omits the settlement tx section when there is no txHash yet", () => {
    useIntentMock.mockReturnValue({ intent: { ...detail, txHash: undefined }, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.queryByText(/View on stellar.expert/)).not.toBeInTheDocument();
    expect(screen.queryByText("Copy")).not.toBeInTheDocument();
  });

  it("links back to the explorer", () => {
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.getByText("← Back to explorer")).toHaveAttribute("href", "/explore");
  });

  it("triggers the browser print dialog from the Print / Save as PDF action", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    await userEvent.click(screen.getByRole("button", { name: /print \/ save as pdf/i }));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it("marks a non-settled intent as not a completed-swap record", () => {
    useIntentMock.mockReturnValue({
      intent: { ...detail, status: "pending", txHash: undefined },
      isLoading: false,
      error: undefined,
    });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.getByRole("note")).toHaveTextContent(/not yet settled/i);
  });

  it("shows a completed record with no warning for a filled intent", () => {
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});
