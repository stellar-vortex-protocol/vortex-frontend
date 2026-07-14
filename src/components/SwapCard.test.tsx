import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { Quote } from "@/lib/types";

const { signTransactionMock } = vi.hoisted(() => ({ signTransactionMock: vi.fn() }));
vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: vi.fn(),
    requestAccess: vi.fn(),
    getNetwork: vi.fn(),
    isAllowed: vi.fn(),
    getPublicKey: vi.fn(),
    signTransaction: signTransactionMock,
  },
}));

import { useWalletStore } from "@/store/wallet";
import { SwapCard } from "./SwapCard";

function renderSwapCard() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SwapCard />
    </SWRConfig>
  );
}

const initialWalletState = useWalletStore.getState();

describe("SwapCard", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    useWalletStore.setState(initialWalletState, true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useWalletStore.setState(initialWalletState, true);
  });

  it("does not request a quote before an amount is entered", () => {
    renderSwapCard();
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Enter an amount")).toBeInTheDocument();
  });

  it("exposes the amount input via an accessible label", () => {
    renderSwapCard();
    expect(screen.getByLabelText("Amount to swap")).toBeInTheDocument();
  });

  it("makes the source token picker a real, keyboard-operable button", () => {
    renderSwapCard();
    const toggle = screen.getByRole("button", { name: "Select source token, currently USDC" });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
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

  it("submits a swap end-to-end for an already-connected wallet", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/quote")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            dstAmount: "497.1234",
            solver: "Beta Liquidity Co",
            fillTimeSeconds: 32,
            priceImpactPct: 0.12,
            protocolFeePct: 0.05,
            rate: "1 USDC = 8.4600 XLM",
          }),
        };
      }
      if (url.includes("/intents") && init?.method === "POST" && !url.includes("/submit")) {
        return { ok: true, status: 200, json: async () => ({ intentId: "intent-1", unsignedXdr: "unsigned-xdr" }) };
      }
      if (url.includes("/submit")) {
        return { ok: true, status: 200, json: async () => ({ intentId: "intent-1", status: "pending" }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    signTransactionMock.mockResolvedValue("signed-xdr");

    const user = userEvent.setup();
    renderSwapCard();

    const input = screen.getByPlaceholderText("0");
    await user.type(input, "500");
    await waitFor(() => expect(screen.getByText("Beta Liquidity Co")).toBeInTheDocument(), { timeout: 2000 });

    await user.click(screen.getByText(`Swap 500 USDC → USDC`));

    await waitFor(() => {
      expect(screen.getByText(/Swap submitted/)).toBeInTheDocument();
    });
    expect(signTransactionMock).toHaveBeenCalledWith("unsigned-xdr", { network: "TESTNET" });
  });
});
