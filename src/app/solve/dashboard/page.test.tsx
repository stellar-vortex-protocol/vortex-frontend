import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const state = vi.hoisted(() => ({
  address: null as string | null,
  solver: { solver: undefined as unknown, isLoading: false, error: undefined as unknown },
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    constructor(message: string, public status: number) {
      super(message);
    }
  },
}));
vi.mock("@/store/wallet", () => ({
  useWalletStore: (sel: (s: { address: string | null }) => unknown) => sel({ address: state.address }),
}));
vi.mock("@/store/toast", () => ({
  useToastStore: (sel: (s: { addToast: () => void }) => unknown) => sel({ addToast: vi.fn() }),
}));
vi.mock("@/hooks/useSolver", () => ({ useSolver: () => state.solver }));
vi.mock("@/hooks/useIntentFeed", () => ({ useIntentFeed: () => ({ items: [] }) }));
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/ConnectWalletButton", () => ({ ConnectWalletButton: () => <button>connect</button> }));

import SolverDashboardPage from "./page";
import { ApiError } from "@/lib/api";

const ADDRESS = "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB";

describe("SolverDashboardPage gating", () => {
  beforeEach(() => {
    state.address = null;
    state.solver = { solver: undefined, isLoading: false, error: undefined };
  });

  it("asks to connect a wallet", () => {
    render(<SolverDashboardPage />);
    expect(screen.getByText("Connect your wallet")).toBeTruthy();
  });

  it("onboards wallets that are not registered solvers", () => {
    state.address = ADDRESS;
    state.solver.error = new ApiError("not found", 404);
    render(<SolverDashboardPage />);
    expect(screen.getByText("Not a registered solver")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Register as a solver" }).getAttribute("href")).toBe("/solve");
  });

  it("renders panels and inactive warnings for a solver", () => {
    state.address = ADDRESS;
    state.solver.solver = {
      name: "Me",
      address: ADDRESS,
      bondUsd: 20,
      fills: 0,
      failed: 0,
      volumeUsd: 0,
      avgFillTimeSeconds: 0,
      successRatePct: 0,
      chains: [],
      status: "inactive",
    };
    render(<SolverDashboardPage />);
    expect(screen.getByRole("alert").textContent).toContain("Bond is below the 50 USDC minimum.");
    expect(screen.getByText("Bond health")).toBeTruthy();
    expect(screen.getByText("No accepted intents in progress.")).toBeTruthy();
  });
});
