import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import type { Quote } from "@/lib/types";
import { SwapConfirmation, computeMinReceived, type SwapConfirmationProps } from "./SwapConfirmation";

const QUOTE: Quote = {
  dstAmount: "100",
  solver: "GSOLVER",
  fillTimeSeconds: 12,
  priceImpactPct: 0.5,
  protocolFeePct: 0.1,
  rate: "1 USDC = 1 USDC",
};

function renderConfirmation(overrides: Partial<SwapConfirmationProps> = {}) {
  const props: SwapConfirmationProps = {
    quote: QUOTE,
    srcChainName: "Ethereum",
    srcAmount: "100",
    srcToken: { symbol: "USDC", decimals: 6, priceUsd: 1 },
    dstToken: { symbol: "USDC", decimals: 7, priceUsd: 1 },
    dstAddress: "GDEST",
    slippagePct: 0.5,
    highPriceImpactThresholdPct: 3,
    quoteExpiresAt: null,
    isRefreshing: false,
    solverVerified: true,
    solverDisplayName: "Acme Solver",
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  const utils = render(
    <I18nProvider locale="en">
      <SwapConfirmation {...props} />
    </I18nProvider>,
  );
  const rerender = (next: Partial<SwapConfirmationProps>) =>
    utils.rerender(
      <I18nProvider locale="en">
        <SwapConfirmation {...props} {...next} />
      </I18nProvider>,
    );
  return { props, rerender };
}

describe("SwapConfirmation", () => {
  beforeEach(() => localStorage.clear());

  it("shows the quote economics including computed minimum received", () => {
    renderConfirmation();
    expect(screen.getByRole("dialog", { name: "Review swap" })).toBeInTheDocument();
    expect(screen.getByText("99.5 USDC (≈ $99.5)")).toBeInTheDocument();
    expect(screen.getByText("Ethereum → Stellar")).toBeInTheDocument();
    expect(screen.getByText("Acme Solver")).toBeInTheDocument();
    expect(computeMinReceived({ ...QUOTE, dstAmount: "10" }, 1, 7)).toBe("9.9");
  });

  it("warns on high price impact, unverified solver and a first-time destination", () => {
    renderConfirmation({ quote: { ...QUOTE, priceImpactPct: 3 }, solverVerified: false });
    expect(screen.getByText(/High price impact above 3%/)).toBeInTheDocument();
    expect(screen.getByText(/could not be verified/)).toBeInTheDocument();
    expect(screen.getByText(/haven't sent to this destination/)).toBeInTheDocument();
  });

  it("warns when the quote is near expiry and shows seconds on the button", () => {
    renderConfirmation({ quoteExpiresAt: Date.now() + 5_000 });
    expect(screen.getByText(/Quote expires in \d+s/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm swap \(\d+s\)/ })).toBeEnabled();
  });

  it("disables confirm while the quote refreshes", () => {
    renderConfirmation({ isRefreshing: true });
    expect(screen.getByRole("button", { name: "Refreshing quote…" })).toBeDisabled();
  });

  it("freezes the shown quote and requires accepting a changed price", async () => {
    const user = userEvent.setup();
    const { props, rerender } = renderConfirmation();
    rerender({ quote: { ...QUOTE, dstAmount: "90" } });

    const confirm = screen.getByRole("button", { name: "Confirm swap" });
    expect(confirm).toBeDisabled();
    expect(screen.getByText("99.5 USDC (≈ $99.5)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept new price" }));
    await user.click(confirm);
    expect(props.onConfirm).toHaveBeenCalledWith({ quote: { ...QUOTE, dstAmount: "90" }, minOut: "89.55" });
  });

  it("dismisses on Escape without confirming", async () => {
    const user = userEvent.setup();
    const { props } = renderConfirmation();
    await user.keyboard("{Escape}");
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onConfirm).not.toHaveBeenCalled();
  });
});
