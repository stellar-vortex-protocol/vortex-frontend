import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const { acceptIntentMock, mutateMock, addToastMock } = vi.hoisted(() => ({
  acceptIntentMock: vi.fn(),
  mutateMock: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ acceptIntent: acceptIntentMock }));
vi.mock("swr", () => ({ mutate: mutateMock }));
vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));

import { useWalletStore } from "@/store/wallet";
import { useAcceptIntent } from "./useAcceptIntent";

const initialWalletState = useWalletStore.getState();

describe("useAcceptIntent", () => {
  beforeEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
  });

  it("accepts an intent for an already-connected wallet and revalidates the open list", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123" });
    acceptIntentMock.mockResolvedValue({ intentId: "intent-1", status: "accepted" });

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-1");
    });

    expect(acceptIntentMock).toHaveBeenCalledWith("intent-1", "GABC123");
    expect(mutateMock).toHaveBeenCalledWith("/intents/open");
    expect(result.current.error).toBeNull();
    expect(result.current.acceptingId).toBeNull();
    expect(addToastMock).toHaveBeenCalledWith("Intent accepted — you have exclusive fill rights.", "success");
  });

  it("connects the wallet first when not already connected", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({ isConnected: true, address: "GXYZ999" });
      }),
    });
    acceptIntentMock.mockResolvedValue({ intentId: "intent-2", status: "accepted" });

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-2");
    });

    expect(acceptIntentMock).toHaveBeenCalledWith("intent-2", "GXYZ999");
  });

  it("surfaces an error when the wallet connection fails", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({ isConnected: false, address: null, error: "User rejected access" });
      }),
    });

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-3");
    });

    expect(result.current.error).toBe("User rejected access");
    expect(acceptIntentMock).not.toHaveBeenCalled();
  });

  it("surfaces a backend error and clears acceptingId", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123" });
    acceptIntentMock.mockRejectedValue(new Error("Intent already claimed"));

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-4");
    });

    expect(result.current.error).toBe("Intent already claimed");
    expect(result.current.acceptingId).toBeNull();
    expect(addToastMock).toHaveBeenCalledWith("Intent already claimed", "error");
  });
});
