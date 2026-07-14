import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { IntentDetail } from "@/lib/types";

const { useIntentMock } = vi.hoisted(() => ({ useIntentMock: vi.fn() }));
vi.mock("@/hooks/useIntent", () => ({ useIntent: useIntentMock }));

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
  txHash: "abc123hash",
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

  it("links to the settlement tx on stellar.expert when a txHash is present", () => {
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    const link = screen.getByText(/View settlement tx/);
    expect(link).toHaveAttribute("href", "https://stellar.expert/explorer/testnet/tx/abc123hash");
  });

  it("omits the settlement tx link when there is no txHash yet", () => {
    useIntentMock.mockReturnValue({ intent: { ...detail, txHash: undefined }, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.queryByText(/View settlement tx/)).not.toBeInTheDocument();
  });

  it("links back to the explorer", () => {
    useIntentMock.mockReturnValue({ intent: detail, isLoading: false, error: undefined });
    render(<IntentDetailPage params={{ id: "intent-1" }} />);

    expect(screen.getByText("← Back to explorer")).toHaveAttribute("href", "/explore");
  });
});
