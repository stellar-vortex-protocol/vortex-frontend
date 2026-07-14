import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import { SwapCard } from "./SwapCard";
import type { Quote } from "@/lib/types";

function renderSwapCard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SwapCard />
    </SWRConfig>
  );
}

describe("SwapCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not request a quote before an amount is entered", () => {
    renderSwapCard();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Enter an amount")).toBeInTheDocument();
  });

  it("fetches and renders a live quote after the debounced amount settles", async () => {
    const quote: Quote = {
      dstAmount: "497.1234",
      solver: "Beta Liquidity Co",
      fillTimeSeconds: 32,
      priceImpactPct: 0.12,
      protocolFeePct: 0.05,
      rate: "1 USDC = 8.4600 XLM",
    };
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => quote,
    });

    const user = userEvent.setup();
    renderSwapCard();

    const input = screen.getByPlaceholderText("0");
    await user.type(input, "500");

    await waitFor(
      () => {
        expect(screen.getByText("Beta Liquidity Co")).toBeInTheDocument();
      },
      { timeout: 2000 }
    );

    expect(screen.getByText("1 USDC = 8.4600 XLM")).toBeInTheDocument();
    expect(screen.getByText(`Swap 500 USDC → USDC`)).toBeInTheDocument();
  });

  it("falls back to an estimate and shows a warning when the quote request fails", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      text: async () => "",
    });

    const user = userEvent.setup();
    renderSwapCard();

    const input = screen.getByPlaceholderText("0");
    await user.type(input, "500");

    await waitFor(
      () => {
        expect(screen.getByText(/Live quote unavailable/)).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});
