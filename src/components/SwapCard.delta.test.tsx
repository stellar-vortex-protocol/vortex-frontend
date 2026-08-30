import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Quote } from "@/lib/types";

const { useQuoteMock } = vi.hoisted(() => ({ useQuoteMock: vi.fn() }));
vi.mock("@/hooks/useQuote", () => ({ useQuote: useQuoteMock }));
vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: vi.fn(),
    requestAccess: vi.fn(),
    getNetwork: vi.fn(),
    isAllowed: vi.fn(),
    getPublicKey: vi.fn(),
    signTransaction: vi.fn(),
  },
}));

import { SwapCard } from "./SwapCard";

const baseQuote: Quote = {
  dstAmount: "100.0000",
  solver: "Alpha",
  fillTimeSeconds: 30,
  priceImpactPct: 0.5,
  protocolFeePct: 0.05,
  rate: "1 USDC = 8.4600 XLM",
};

function setQuote(quote: Quote | undefined) {
  useQuoteMock.mockReturnValue({
    quote,
    quoteFetchedAt: quote ? Date.now() : null,
    isLoading: false,
    error: undefined,
  });
}

describe("SwapCard quote-change delta indicator", () => {
  beforeEach(() => {
    setQuote(baseQuote);
  });

  afterEach(() => {
    useQuoteMock.mockReset();
  });

  it("shows no delta on the first quote for a route", () => {
    render(<SwapCard initialAmount="500" />);
    expect(screen.queryByText(/improved by|worsened by/i)).not.toBeInTheDocument();
  });

  it("flags an improvement when a refreshed quote pays out more", () => {
    const { rerender } = render(<SwapCard initialAmount="500" />);

    setQuote({ ...baseQuote, dstAmount: "104.0000" });
    rerender(<SwapCard initialAmount="500" />);

    expect(screen.getByText(/improved by/i)).toBeInTheDocument();
    expect(screen.queryByText(/worsened by/i)).not.toBeInTheDocument();
  });

  it("flags a worsening when a refreshed quote pays out less", () => {
    const { rerender } = render(<SwapCard initialAmount="500" />);

    setQuote({ ...baseQuote, dstAmount: "97.0000" });
    rerender(<SwapCard initialAmount="500" />);

    expect(screen.getByText(/worsened by/i)).toBeInTheDocument();
    expect(screen.queryByText(/improved by/i)).not.toBeInTheDocument();
  });

  it("does not treat a token/route change as a delta", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SwapCard initialAmount="500" />);

    // Switch the destination token - that's a different route. useQuote would
    // drop the stale quote while the new route's quote loads.
    await user.click(screen.getByRole("button", { name: "XLM" }));
    setQuote(undefined);
    rerender(<SwapCard initialAmount="500" />);

    setQuote({ ...baseQuote, dstAmount: "104.0000" });
    rerender(<SwapCard initialAmount="500" />);

    expect(screen.queryByText(/improved by|worsened by/i)).not.toBeInTheDocument();
  });
});
