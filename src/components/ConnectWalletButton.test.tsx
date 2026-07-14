import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { isConnectedMock, requestAccessMock, getNetworkMock } = vi.hoisted(() => ({
  isConnectedMock: vi.fn(),
  requestAccessMock: vi.fn(),
  getNetworkMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: isConnectedMock,
    requestAccess: requestAccessMock,
    getNetwork: getNetworkMock,
  },
}));

import { useWalletStore } from "@/store/wallet";
import { ConnectWalletButton } from "./ConnectWalletButton";

const initialState = useWalletStore.getState();

describe("ConnectWalletButton", () => {
  beforeEach(() => {
    useWalletStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    useWalletStore.setState(initialState, true);
  });

  it("shows a Connect Freighter prompt when disconnected", () => {
    render(<ConnectWalletButton />);
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("connects the wallet and shows the truncated address on click", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ23456");
    getNetworkMock.mockResolvedValue("TESTNET");

    const user = userEvent.setup();
    render(<ConnectWalletButton />);

    await user.click(screen.getByText("Connect Freighter"));

    await waitFor(() => {
      expect(screen.getByText("GABC...3456")).toBeInTheDocument();
    });
  });

  it("disconnects when the connected button is clicked", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABCDEFGHIJKLMNOPQRSTUVWXYZ23456");
    getNetworkMock.mockResolvedValue("TESTNET");

    const user = userEvent.setup();
    render(<ConnectWalletButton />);
    await user.click(screen.getByText("Connect Freighter"));
    await waitFor(() => screen.getByText("GABC...3456"));

    await user.click(screen.getByText("GABC...3456"));

    expect(useWalletStore.getState().isConnected).toBe(false);
  });
});
