import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const {
  fetcherMock,
  registerSolverMock,
  submitSolverRegistrationMock,
  signTransactionMock,
} = vi.hoisted(() => ({
  fetcherMock: vi.fn(),
  registerSolverMock: vi.fn(),
  submitSolverRegistrationMock: vi.fn(),
  signTransactionMock: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  fetcher: fetcherMock,
  registerSolver: registerSolverMock,
  submitSolverRegistration: submitSolverRegistrationMock,
}));

vi.mock("@stellar/freighter-api", () => ({
  default: { signTransaction: signTransactionMock },
}));

import { useWalletStore } from "@/store/wallet";
import { ToastViewport } from "@/components/ToastViewport";
import SolvePage from "./page";

const initialWalletState = useWalletStore.getState();
const SOLVER_ADDRESS =
  "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

function renderSolvePage() {
  return render(
    <>
      <SolvePage />
      <ToastViewport />
    </>,
  );
}

describe("solve page solver-registration flow (integration)", () => {
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

  it("registers a solver with a valid address and bond, and shows a success toast", async () => {
    fetcherMock.mockImplementation(async (path: string) => {
      if (path === "/solvers") return [];
      if (path === "/intents/open") return [];
      throw new Error(`Unexpected fetch: ${path}`);
    });
    registerSolverMock.mockResolvedValue({
      registrationId: "reg-1",
      unsignedXdr: "unsigned-xdr",
    });
    signTransactionMock.mockResolvedValue("signed-xdr");
    submitSolverRegistrationMock.mockResolvedValue({
      registrationId: "reg-1",
      status: "pending",
    });

    const user = userEvent.setup();
    renderSolvePage();

    await user.click(screen.getByRole("tab", { name: "register" }));
    await user.type(screen.getByLabelText(/stellar address/i), SOLVER_ADDRESS);
    await user.type(screen.getByLabelText(/bond amount/i), "100");

    await user.click(
      screen.getByRole("button", { name: "Connect Freighter to Register" }),
    );

    await waitFor(() => {
      expect(registerSolverMock).toHaveBeenCalledWith({
        address: SOLVER_ADDRESS,
        bondUsd: 100,
      });
    });
    expect(signTransactionMock).toHaveBeenCalledWith("unsigned-xdr", {
      network: "TESTNET",
    });
    expect(submitSolverRegistrationMock).toHaveBeenCalledWith(
      "reg-1",
      "signed-xdr",
    );

    await waitFor(() => {
      expect(screen.getByText("Registered as a solver.")).toBeInTheDocument();
    });
  });
});
