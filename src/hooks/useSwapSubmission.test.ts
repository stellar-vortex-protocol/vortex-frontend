import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const {
  signTransactionMock,
  createIntentMock,
  submitIntentMock,
  addToastMock,
  decodeXdrMock,
  validateSwapXdrMock,
} = vi.hoisted(() => ({
  signTransactionMock: vi.fn(),
  createIntentMock: vi.fn(),
  submitIntentMock: vi.fn(),
  addToastMock: vi.fn(),
  decodeXdrMock: vi.fn(),
  validateSwapXdrMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  default: { signTransaction: signTransactionMock },
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    createIntent: createIntentMock,
    submitIntent: submitIntentMock,
  };
});

vi.mock("@/lib/xdrReview", () => ({
  verifySignedXdrMatches: verifySignedXdrMatchesMock,
}));

vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));

// Mock xdrReview so unit tests don't need real Stellar SDK XDR fixtures.
vi.mock("@/lib/xdrReview", () => {
  class XdrMismatchError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "XdrMismatchError";
    }
  }
  return {
    decodeXdr: decodeXdrMock,
    validateSwapXdr: validateSwapXdrMock,
    XdrMismatchError,
  };
});

import { useWalletStore } from "@/store/wallet";
import { classifySwapError, useSwapSubmission } from "./useSwapSubmission";

const params = {
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500",
  dstToken: "XLM",
};
const initialWalletState = useWalletStore.getState();
const DECODED_STUB = {
  networkPassphrase: "Test SDF Network ; September 2015",
  fee: "100",
  operationCount: 1,
  operations: [
    {
      kind: "payment" as const,
      destination: "GABC123",
      asset: "XLM (native)",
      amount: "500",
    },
  ],
  sourceAccount: "GSOURCE",
};

describe("useSwapSubmission", () => {
  beforeEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
    decodeXdrMock.mockReturnValue(DECODED_STUB);
    validateSwapXdrMock.mockReturnValue(undefined); // passes by default
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
  });

  it("errors out when the wallet is not connected and connect() fails", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({
          isConnected: false,
          address: null,
          error: "User rejected access",
        });
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

  it("connects, builds, reviews, signs, and submits when the wallet starts disconnected", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      network: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({
          isConnected: true,
          address: "GABC123",
          network: "TESTNET",
        });
      }),
    });
    createIntentMock.mockResolvedValue({
      intentId: "intent-1",
      unsignedXdr: "unsigned-xdr",
    });
    signTransactionMock.mockResolvedValue("signed-xdr");
    verifySignedXdrMatchesMock.mockReturnValue({ valid: true });
    submitIntentMock.mockResolvedValue({ intentId: "intent-1", status: "pending" });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(decodeXdrMock).toHaveBeenCalledWith("unsigned-xdr", "TESTNET");
    expect(validateSwapXdrMock).toHaveBeenCalledWith(DECODED_STUB, {
      srcAmount: "500",
      dstAddress: "GABC123",
    });
    expect(createIntentMock).toHaveBeenCalledWith({ ...params, dstAddress: "GABC123" });
    expect(signTransactionMock).toHaveBeenCalledWith("unsigned-xdr", { network: "TESTNET" });
    expect(submitIntentMock).toHaveBeenCalledWith("intent-1", "signed-xdr");
    expect(result.current.status).toBe("success");
    expect(result.current.intentId).toBe("intent-1");
    expect(result.current.error).toBeNull();
    expect(addToastMock).toHaveBeenCalledWith(
      "Swap submitted successfully.",
      "success",
    );
  });

  it("skips reconnecting when the wallet is already connected", async () => {
    const connect = vi.fn();
    useWalletStore.setState({
      isConnected: true,
      address: "GXYZ999",
      network: "TESTNET",
      connect,
    });
    createIntentMock.mockResolvedValue({
      intentId: "intent-2",
      unsignedXdr: "unsigned-xdr",
    });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitIntentMock.mockResolvedValue({
      intentId: "intent-2",
      status: "pending",
    });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(connect).not.toHaveBeenCalled();
    expect(result.current.status).toBe("success");
  });

  it("surfaces an error when the user rejects the Freighter signature request", async () => {
    useWalletStore.setState({
      isConnected: true,
      address: "GXYZ999",
      network: "TESTNET",
    });
    createIntentMock.mockResolvedValue({
      intentId: "intent-3",
      unsignedXdr: "unsigned-xdr",
    });
    signTransactionMock.mockRejectedValue(new Error("User declined access"));

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("User declined access");
    expect(result.current.errorKind).toBe("user-rejected");
    expect(submitIntentMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith("User declined access", "error");
  });

  it("blocks signing and surfaces an error when XDR decode fails", async () => {
    useWalletStore.setState({ isConnected: true, address: "GXYZ999", network: "TESTNET" });
    createIntentMock.mockResolvedValue({ intentId: "intent-4", unsignedXdr: "bad-xdr" });
    decodeXdrMock.mockImplementation(() => {
      throw new Error("XDR decode failed — refusing to sign. Details: bad envelope");
    });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/XDR decode failed/i);
    // Must never reach the signing step.
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitIntentMock).not.toHaveBeenCalled();
  });

  it("blocks signing and surfaces an error when XDR validation detects a mismatch", async () => {
    useWalletStore.setState({ isConnected: true, address: "GXYZ999", network: "TESTNET" });
    createIntentMock.mockResolvedValue({ intentId: "intent-5", unsignedXdr: "mismatched-xdr" });
    // Simulate the relay encoding a different destination.
    const { XdrMismatchError } = await import("@/lib/xdrReview");
    validateSwapXdrMock.mockImplementation(() => {
      throw new XdrMismatchError(
        'Transaction destination mismatch: relay encoded "GEVIL" but you entered "GXYZ999". Signing blocked.'
      );
    });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toContain("destination mismatch");
    expect(result.current.error).toContain("Signing blocked");
    // Must never reach Freighter.
    expect(signTransactionMock).not.toHaveBeenCalled();
    expect(submitIntentMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(
      expect.stringContaining("destination mismatch"),
      "error"
    );
  });

  it("resets back to idle", async () => {
    useWalletStore.setState({ isConnected: true, address: "GXYZ999", network: "TESTNET" });
    createIntentMock.mockResolvedValue({ intentId: "intent-6", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitIntentMock.mockResolvedValue({ intentId: "intent-6", status: "pending" });

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

  // Issue #308: XDR structural integrity verification
  it("rejects a swap when the signed XDR fails verification", async () => {
    useWalletStore.setState({ isConnected: true, address: "GXYZ999", network: "TESTNET" });
    createIntentMock.mockResolvedValue({ intentId: "intent-5", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("tampered-signed-xdr");
    verifySignedXdrMatchesMock.mockReturnValue({
      valid: false,
      error: "Transaction verification failed. The signed transaction does not match what was reviewed.",
    });

    const { result } = renderHook(() => useSwapSubmission());
    await act(async () => {
      await result.current.submit(params);
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/verification failed/i);
    expect(submitIntentMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(expect.stringMatching(/verification failed/i), "error");
  });
});
