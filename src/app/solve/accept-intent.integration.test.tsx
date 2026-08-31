import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OpenIntent } from "@/lib/types";

const { fetcherMock, acceptIntentMock } = vi.hoisted(() => ({
  fetcherMock: vi.fn(),
  acceptIntentMock: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  fetcher: fetcherMock,
  acceptIntent: acceptIntentMock,
}));

import { useWalletStore } from "@/store/wallet";
import { ToastViewport } from "@/components/ToastViewport";
import SolvePage from "./page";

const openIntent: OpenIntent = {
  id: "a1b2",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500",
  dstToken: "USDC",
  minOut: "495",
  deadline: new Date(Date.now() + 18 * 60_000).toISOString(),
};

const initialWalletState = useWalletStore.getState();

function renderSolvePage() {
  return render(
    <>
      <SolvePage />
      <ToastViewport />
    </>,
  );
}

describe("solve page accept-intent flow (integration)", () => {
  beforeEach(() => {
    useWalletStore.setState(
      { ...initialWalletState, isConnected: true, address: "GABC123" },
      true,
    );
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
  });

  it("lists an open intent, accepts it, shows a success toast, and removes it from the feed", async () => {
    fetcherMock.mockImplementation(async (path: string) => {
      if (path === "/solvers") return [];
      if (path === "/intents/open") {
        return acceptIntentMock.mock.calls.length > 0 ? [] : [openIntent];
      }
      throw new Error(`Unexpected fetch: ${path}`);
    });
    acceptIntentMock.mockResolvedValue({
      intentId: "a1b2",
      status: "accepted",
    });

    const user = userEvent.setup();
    renderSolvePage();

    await user.click(screen.getByRole("tab", { name: "intents" }));
    await waitFor(() =>
      expect(screen.getByText("500 USDC on ethereum")).toBeInTheDocument(),
    );

    await user.click(screen.getByText("Accept Intent →"));

    await waitFor(() => {
      expect(
        screen.getByText("Intent accepted — you have exclusive fill rights."),
      ).toBeInTheDocument();
    });
    expect(acceptIntentMock).toHaveBeenCalledWith("a1b2", "GABC123");

    await waitFor(() => {
      expect(screen.getByText(/No open intents right now/)).toBeInTheDocument();
    });
  });
});
