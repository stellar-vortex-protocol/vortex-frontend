import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const { signTransactionMock, createIntentMock, submitIntentMock, addToastMock } = vi.hoisted(() => ({
  signTransactionMock: vi.fn(),
  createIntentMock: vi.fn(),
  submitIntentMock: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  default: { signTransaction: signTransactionMock },
}));

vi.mock("@/lib/api", () => ({
  createIntent: createIntentMock,
  submitIntent: submitIntentMock,
}));

vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));

import { useWalletStore } from "@/store/wallet";
import { useSwapSubmission } from "./useSwapSubmission";

const params = { srcChain: "ethereum", srcToken: "USDC", srcAmount: "500", dstToken: "XLM" };
const initialWalletState = useWalletStore.getState();

describe("useSwapSubmission", () => {
  beforeEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
  });

  it("errors out when the wallet is not connected and connect() fails", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({ isConnected: false, address: null, error: "User rejected access" });
      }),
    });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("User rejected access");
    expect(createIntentMock).not.toHaveBeenCalled();
  });

  it("connects, builds, signs, and submits when the wallet starts disconnected", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      network: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });
      }),
    });
    createIntentMock.mockResolvedValue({ intentId: "intent-1", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitIntentMock.mockResolvedValue({ intentId: "intent-1", status: "pending" });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(createIntentMock).toHaveBeenCalledWith({ ...params, dstAddress: "GABC123" });
    expect(signTransactionMock).toHaveBeenCalledWith("unsigned-xdr", { network: "TESTNET" });
    expect(submitIntentMock).toHaveBeenCalledWith("intent-1", "signed-xdr");
    expect(result.current.status).toBe("success");
    expect(result.current.intentId).toBe("intent-1");
    expect(result.current.error).toBeNull();
    expect(addToastMock).toHaveBeenCalledWith("Swap submitted successfully.", "success");
  });

  it("skips reconnecting when the wallet is already connected", async () => {
    const connect = vi.fn();
    useWalletStore.setState({ isConnected: true, address: "GXYZ999", network: "TESTNET", connect });
    createIntentMock.mockResolvedValue({ intentId: "intent-2", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitIntentMock.mockResolvedValue({ intentId: "intent-2", status: "pending" });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(connect).not.toHaveBeenCalled();
    expect(result.current.status).toBe("success");
  });

  it("surfaces an error when the user rejects the Freighter signature request", async () => {
    useWalletStore.setState({ isConnected: true, address: "GXYZ999", network: "TESTNET" });
    createIntentMock.mockResolvedValue({ intentId: "intent-3", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockRejectedValue(new Error("User declined access"));

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("User declined access");
    expect(submitIntentMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith("User declined access", "error");
  });

  it("resets back to idle", async () => {
    useWalletStore.setState({ isConnected: true, address: "GXYZ999", network: "TESTNET" });
    createIntentMock.mockResolvedValue({ intentId: "intent-4", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitIntentMock.mockResolvedValue({ intentId: "intent-4", status: "pending" });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.intentId).toBeNull();
  });
});
