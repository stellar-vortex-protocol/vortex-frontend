import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const { signTransactionMock, registerSolverMock, submitSolverRegistrationMock, mutateMock, addToastMock, apiErrorMock } = vi.hoisted(() => ({
  signTransactionMock: vi.fn(),
  registerSolverMock: vi.fn(),
  submitSolverRegistrationMock: vi.fn(),
  mutateMock: vi.fn(),
  addToastMock: vi.fn(),
  apiErrorMock: class extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
}));

vi.mock("@stellar/freighter-api", () => ({
  default: { signTransaction: signTransactionMock },
}));

vi.mock("@/lib/api", () => ({
  registerSolver: registerSolverMock,
  submitSolverRegistration: submitSolverRegistrationMock,
  ApiError: apiErrorMock,
}));

vi.mock("swr", () => ({ mutate: mutateMock }));
vi.mock("@/store/toast", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));

import { useWalletStore } from "@/store/wallet";
import { useSolverRegistration } from "./useSolverRegistration";

const initialWalletState = useWalletStore.getState();

describe("useSolverRegistration", () => {
  beforeEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
  });

  it("connects, builds, signs, and submits a registration", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      network: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });
      }),
    });
    registerSolverMock.mockResolvedValue({ registrationId: "reg-1", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitSolverRegistrationMock.mockResolvedValue({ registrationId: "reg-1", status: "pending" });

    const { result } = renderHook(() => useSolverRegistration());
    await act(async () => {
      await result.current.register("GXYZ999", 50);
    });

    expect(registerSolverMock).toHaveBeenCalledWith({ address: "GXYZ999", bondUsd: 50 });
    expect(signTransactionMock).toHaveBeenCalledWith("unsigned-xdr", { network: "TESTNET" });
    expect(submitSolverRegistrationMock).toHaveBeenCalledWith("reg-1", "signed-xdr");
    expect(mutateMock).toHaveBeenCalledWith("/solvers");
    expect(result.current.status).toBe("success");
    expect(addToastMock).toHaveBeenCalledWith("Registered as a solver.", "success");
  });

  it("errors when wallet connection fails", async () => {
    useWalletStore.setState({
      isConnected: false,
      address: null,
      connect: vi.fn(async () => {
        useWalletStore.setState({ isConnected: false, address: null, error: "User rejected access" });
      }),
    });

    const { result } = renderHook(() => useSolverRegistration());
    await act(async () => {
      await result.current.register("GXYZ999", 50);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("User rejected access");
    expect(registerSolverMock).not.toHaveBeenCalled();
  });

  it("errors when the user declines the signature request", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });
    registerSolverMock.mockResolvedValue({ registrationId: "reg-2", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockRejectedValue(new Error("User declined access"));

    const { result } = renderHook(() => useSolverRegistration());
    await act(async () => {
      await result.current.register("GXYZ999", 50);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("User declined access");
    expect(submitSolverRegistrationMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith("User declined access", "error");
  });

  it("resets back to idle", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });
    registerSolverMock.mockResolvedValue({ registrationId: "reg-3", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitSolverRegistrationMock.mockResolvedValue({ registrationId: "reg-3", status: "pending" });

    const { result } = renderHook(() => useSolverRegistration());
    await act(async () => {
      await result.current.register("GXYZ999", 50);
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => result.current.reset());

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("surfaces a specific message when the address is already registered", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });
    registerSolverMock.mockResolvedValue({ registrationId: "reg-4", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitSolverRegistrationMock.mockRejectedValue(new apiErrorMock("address already registered", 409));

    const { result } = renderHook(() => useSolverRegistration());
    await act(async () => {
      await result.current.register("GXYZ999", 50);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("This address is already registered as a solver.");
    expect(addToastMock).toHaveBeenCalledWith("This address is already registered as a solver.", "error");
  });

  it("surfaces a specific message when the bond is insufficient", async () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });
    registerSolverMock.mockResolvedValue({ registrationId: "reg-5", unsignedXdr: "unsigned-xdr" });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitSolverRegistrationMock.mockRejectedValue(new apiErrorMock("insufficient bond", 400));

    const { result } = renderHook(() => useSolverRegistration());
    await act(async () => {
      await result.current.register("GXYZ999", 50);
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Insufficient bond amount. The bond must meet the minimum required.");
    expect(addToastMock).toHaveBeenCalledWith("Insufficient bond amount. The bond must meet the minimum required.", "error");
  });
});
