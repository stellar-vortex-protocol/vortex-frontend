import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const { acceptIntentMock, mutateMock, addToastMock, ApiErrorCtor } = vi.hoisted(() => {
  class ApiErrorCtor extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return {
    acceptIntentMock: vi.fn(),
    mutateMock: vi.fn(),
    addToastMock: vi.fn(),
    ApiErrorCtor,
  };
});

// A minimal fake of SWR's mutate(key, asyncUpdater, { optimisticData, rollbackOnError })
// good enough to exercise the optimistic-update + rollback behavior under test.
const openIntentsStore = new Map<string, unknown>();
mutateMock.mockImplementation(async (key: string, updater?: unknown, opts?: Record<string, unknown>) => {
  const current = openIntentsStore.get(key);
  if (typeof updater !== "function") return current;

  if (opts && "optimisticData" in opts) {
    const optimisticData = opts.optimisticData as unknown;
    const next = typeof optimisticData === "function" ? (optimisticData as (c: unknown) => unknown)(current) : optimisticData;
    openIntentsStore.set(key, next);
  }

  try {
    const result = await (updater as (c: unknown) => unknown)(current);
    openIntentsStore.set(key, result);
    return result;
  } catch (err) {
    if (opts?.rollbackOnError) {
      openIntentsStore.set(key, current);
    }
    throw err;
  }
});

vi.mock("@/lib/api", () => ({ acceptIntent: acceptIntentMock, ApiError: ApiErrorCtor }));
vi.mock("swr", () => ({ mutate: mutateMock }));
vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));

import { useWalletStore } from "@/store/wallet";
import { useAcceptIntent } from "./useAcceptIntent";

const initialWalletState = useWalletStore.getState();
const OPEN_INTENTS_KEY = "/intents/open";

describe("useAcceptIntent", () => {
  beforeEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
    openIntentsStore.set(OPEN_INTENTS_KEY, [{ id: "intent-1" }, { id: "intent-4" }]);
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
  });

  it("accepts an intent for an already-connected wallet, optimistically removing it from the open list", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123" });
    acceptIntentMock.mockResolvedValue({
      intentId: "intent-1",
      status: "accepted",
    });

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-1");
    });

    expect(acceptIntentMock).toHaveBeenCalledWith("intent-1", "GABC123");
    expect(openIntentsStore.get(OPEN_INTENTS_KEY)).toEqual([{ id: "intent-4" }]);
    expect(result.current.error).toBeNull();
    expect(result.current.acceptingId).toBeNull();
    expect(addToastMock).toHaveBeenCalledWith(
      "Intent accepted — you have exclusive fill rights.",
      "success",
    );
  });

  it("connects the wallet first when not already connected", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({ isConnected: true, address: "GXYZ999" });
      }),
    });
    acceptIntentMock.mockResolvedValue({ intentId: "intent-1", status: "accepted" });

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-1");
    });

    expect(acceptIntentMock).toHaveBeenCalledWith("intent-1", "GXYZ999");
  });

  it("surfaces an error when the wallet connection fails", async () => {
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

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-3");
    });

    expect(result.current.error).toBe("User rejected access");
    expect(acceptIntentMock).not.toHaveBeenCalled();
  });

  it("rolls back and shows a distinguishing message on a 409 race conflict", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123" });
    acceptIntentMock.mockRejectedValue(new ApiErrorCtor("already accepted", 409));

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-4");
    });

    expect(result.current.error).toBe("Someone else accepted this intent first.");
    expect(result.current.acceptingId).toBeNull();
    expect(openIntentsStore.get(OPEN_INTENTS_KEY)).toEqual([{ id: "intent-1" }, { id: "intent-4" }]);
    expect(addToastMock).toHaveBeenCalledWith("Someone else accepted this intent first.", "error");
  });

  it("rolls back and surfaces a generic backend error", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123" });
    acceptIntentMock.mockRejectedValue(new Error("Intent already claimed"));

    const { result } = renderHook(() => useAcceptIntent());
    await act(async () => {
      await result.current.accept("intent-4");
    });

    expect(result.current.error).toBe("Intent already claimed");
    expect(result.current.acceptingId).toBeNull();
    expect(openIntentsStore.get(OPEN_INTENTS_KEY)).toEqual([{ id: "intent-1" }, { id: "intent-4" }]);
    expect(addToastMock).toHaveBeenCalledWith("Intent already claimed", "error");
  });
});
