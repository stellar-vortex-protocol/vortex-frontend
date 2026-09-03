import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { Quote } from "@/lib/types";

const { signTransactionMock } = vi.hoisted(() => ({
  signTransactionMock: vi.fn(),
}));
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
    </SWRConfig>,
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
    const toggle = screen.getByRole("button", {
      name: "Select source token, currently USDC",
    });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes a descriptive accessible name on the source chain select control", () => {
    renderSwapCard();
    const toggle = screen.getByRole("button", {
      name: "Source chain, currently Ethereum",
    });
    expect(toggle.tagName).toBe("BUTTON");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("exposes a descriptive group label on the destination token select control", () => {
    renderSwapCard();
    const group = screen.getByRole("group", { name: "Destination token" });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "XLM" })).toHaveAttribute(
      "aria-pressed",
    );
  });

  it("opening the chain picker with the keyboard moves focus into its search field", async () => {
    const user = userEvent.setup();
    renderSwapCard();

    const chainToggle = screen.getByRole("button", {
      name: "Source chain, currently Ethereum",
    });
    chainToggle.focus();
    await user.keyboard("{Enter}");

    const listbox = screen.getByRole("listbox", { name: "Select source chain" });
    expect(listbox.parentElement).toContainElement(document.activeElement as HTMLElement);
  });

  it("closes the chain picker with Escape and returns focus to the toggle button", async () => {
    const user = userEvent.setup();
    renderSwapCard();

    const chainToggle = screen.getByRole("button", {
      name: "Source chain, currently Ethereum",
    });
    await user.click(chainToggle);
    expect(screen.getByRole("listbox", { name: "Select source chain" })).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(chainToggle).toHaveFocus();
  });

  it("selecting a chain via keyboard closes the picker and returns focus to the toggle button", async () => {
    const user = userEvent.setup();
    renderSwapCard();

    const chainToggle = screen.getByRole("button", {
      name: "Source chain, currently Ethereum",
    });
    await user.click(chainToggle);

    // Chains are listed as Ethereum, Base, … — one ArrowDown moves the roving index onto Base.
    await user.keyboard("{ArrowDown}{Enter}");

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Source chain, currently Base" })).toHaveFocus();
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
      { timeout: 2000 },
    );

    expect(screen.getByText("1 USDC = 8.4600 XLM")).toBeInTheDocument();
    expect(screen.getByText(`Swap 500 USDC → USDC`)).toBeInTheDocument();
  });

  it("renders a warning for high price impact quotes", async () => {
    const quote: Quote = {
      dstAmount: "497.1234",
      solver: "Beta Liquidity Co",
      fillTimeSeconds: 32,
      priceImpactPct: 3.5,
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

    await user.type(screen.getByPlaceholderText("0"), "500");

    await waitFor(
      () => {
        expect(screen.getByRole("alert")).toHaveTextContent(
          "High price impact above 3%",
        );
      },
      { timeout: 2000 },
    );
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
      { timeout: 2000 },
    );
  });

  it("submits a swap end-to-end for an already-connected wallet", async () => {
    useWalletStore.setState({
      isConnected: true,
      address: "GABC123",
      network: "TESTNET",
    });
    (fetch as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string, init?: RequestInit) => {
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
        if (
          url.includes("/intents") &&
          init?.method === "POST" &&
          !url.includes("/submit")
        ) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              intentId: "intent-1",
              unsignedXdr: "unsigned-xdr",
            }),
          };
        }
        if (url.includes("/submit")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ intentId: "intent-1", status: "pending" }),
          };
        }
        throw new Error(`Unexpected fetch: ${url}`);
      },
    );
    signTransactionMock.mockResolvedValue("signed-xdr");

    const user = userEvent.setup();
    renderSwapCard();

    const input = screen.getByPlaceholderText("0");
    await user.type(input, "500");
    await waitFor(
      () => expect(screen.getByText("Beta Liquidity Co")).toBeInTheDocument(),
      { timeout: 2000 },
    );

    await user.clear(screen.getByLabelText("Slippage tolerance percent"));
    await user.type(screen.getByLabelText("Slippage tolerance percent"), "1");

    expect(screen.getByText("Min out: 492.1522 USDC")).toBeInTheDocument();

    await user.click(screen.getByText(`Swap 500 USDC → USDC`));

    await waitFor(() => {
      expect(screen.getByText(/Swap submitted/)).toBeInTheDocument();
    });
    expect(signTransactionMock).toHaveBeenCalledWith("unsigned-xdr", {
      network: "TESTNET",
    });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/intents"),
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"minOut":"492.1522"'),
      }),
    );
  });

  // ── Issue #248: networkMismatch submission guard ──────────────────────────

  it("disables the swap button and shows an inline alert when connected to the wrong network", async () => {
    useWalletStore.setState({
      isConnected: true,
      address: "GABC123",
      network: "MAINNET",
      networkMismatch: true,
    });

    const user = userEvent.setup();
    renderSwapCard();

    const input = screen.getByPlaceholderText("0");
    await user.type(input, "500");

    // Inline alert must be visible.
    await waitFor(() => {
      expect(screen.getAllByRole("alert").some((el) =>
        el.textContent?.toLowerCase().includes("wrong network")
      )).toBe(true);
    });

    // The swap button must be disabled.
    const swapButton = screen.getAllByRole("button").find(
      (btn) => btn.textContent?.toLowerCase().includes("wrong network")
    );
    expect(swapButton).toBeDefined();
    expect(swapButton).toBeDisabled();

    // Freighter must never be called.
    expect(signTransactionMock).not.toHaveBeenCalled();
  });

  it("does not show the network-mismatch alert when networkMismatch is false", async () => {
    useWalletStore.setState({
      isConnected: true,
      address: "GABC123",
      network: "TESTNET",
      networkMismatch: false,
    });

    renderSwapCard();

    // No mismatch alert should be present.
    const alerts = screen.queryAllByRole("alert");
    const mismatchAlert = alerts.find((el) =>
      el.textContent?.toLowerCase().includes("wrong network")
    );
    expect(mismatchAlert).toBeUndefined();
  });

  it("does not show the network-mismatch alert when wallet is not connected (networkMismatch defaults to false)", () => {
    // networkMismatch defaults to false before any connection — the guard
    // must not falsely block a pre-connection state.
    useWalletStore.setState({
      isConnected: false,
      address: null,
      networkMismatch: false,
    });

    renderSwapCard();

    const alerts = screen.queryAllByRole("alert");
    const mismatchAlert = alerts.find((el) =>
      el.textContent?.toLowerCase().includes("wrong network")
    );
    expect(mismatchAlert).toBeUndefined();
  });
});
