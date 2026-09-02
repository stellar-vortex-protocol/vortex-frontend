import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

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

const { fetcherMock, createIntentMock, submitIntentMock } = vi.hoisted(() => ({
  fetcherMock: vi.fn(),
  createIntentMock: vi.fn(),
  submitIntentMock: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  fetcher: fetcherMock,
  createIntent: createIntentMock,
  submitIntent: submitIntentMock,
}));

import { useWalletStore } from "@/store/wallet";
import { SwapCard } from "@/components/SwapCard";
import { ToastViewport } from "@/components/ToastViewport";

function renderSwapFlow() {
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SwapCard />
      <ToastViewport />
    </SWRConfig>,
  );
}

const initialWalletState = useWalletStore.getState();

describe("swap submission flow (integration)", () => {
  beforeEach(() => {
    useWalletStore.setState(
      {
        ...initialWalletState,
        isConnected: true,
        address: "GABC123",
        network: "TESTNET",
      },
      true,
    );
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
  });

  it("enters an amount, fetches a quote, submits the swap, and surfaces a success toast", async () => {
    fetcherMock.mockResolvedValue({
      dstAmount: "497.1234",
      solver: "Beta Liquidity Co",
      fillTimeSeconds: 32,
      priceImpactPct: 0.12,
      protocolFeePct: 0.05,
      rate: "1 USDC = 8.4600 XLM",
    });
    createIntentMock.mockResolvedValue({
      intentId: "intent-1",
      unsignedXdr: "unsigned-xdr",
    });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitIntentMock.mockResolvedValue({
      intentId: "intent-1",
      status: "pending",
    });

    const user = userEvent.setup();
    renderSwapFlow();

    const input = screen.getByPlaceholderText("0");
    await user.type(input, "500");

    await waitFor(
      () => expect(screen.getByText("Beta Liquidity Co")).toBeInTheDocument(),
      { timeout: 2000 },
    );

    await user.click(screen.getByText("Swap 500 USDC → USDC"));

    await waitFor(() => {
      expect(
        screen.getByText("Swap submitted successfully."),
      ).toBeInTheDocument();
    });

    expect(createIntentMock).toHaveBeenCalledWith(
      expect.objectContaining({ srcAmount: "500", dstAddress: "GABC123" }),
    );
    expect(signTransactionMock).toHaveBeenCalledWith("unsigned-xdr", {
      network: "TESTNET",
    });
    expect(submitIntentMock).toHaveBeenCalledWith("intent-1", "signed-xdr");
  });
});
