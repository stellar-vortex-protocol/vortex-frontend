import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { useSolversMock } = vi.hoisted(() => ({ useSolversMock: vi.fn() }));

vi.mock("@/hooks/useSolvers", () => ({ useSolvers: useSolversMock }));
vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("@/components/ConnectWalletButton", () => ({ ConnectWalletButton: () => <button type="button">Connect</button> }));

import ProposalDetailClient from "./ProposalDetailClient";

const solver = (bondUsd: number) => ({
  name: `S${bondUsd}`,
  address: `G${bondUsd}`,
  bondUsd,
  fills: 0,
  failed: 0,
  volumeUsd: 0,
  avgFillTimeSeconds: 0,
  successRatePct: 0,
  chains: [],
  status: "active" as const,
});

describe("ProposalDetailClient impact preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSolversMock.mockReturnValue({ solvers: [solver(60), solver(80), solver(500)], isLoading: false, error: undefined });
  });

  it("shows how many current solvers a bond increase would disqualify", () => {
    render(<ProposalDetailClient proposalId="VIP-1" />);

    expect(screen.getByRole("heading", { name: "Impact preview" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Raising the minimum bond from $50 to $100 would disqualify 2 of the 3 current solvers at their present bond.",
      ),
    ).toBeInTheDocument();
  });

  it("says no preview is available for a proposal that isn't a bond change", () => {
    render(<ProposalDetailClient proposalId="VIP-3" />);

    expect(
      screen.getByText("No automated impact preview is available for this proposal type."),
    ).toBeInTheDocument();
    expect(useSolversMock).not.toHaveBeenCalled();
  });

  it("says so when every solver already meets the raised minimum", () => {
    useSolversMock.mockReturnValue({ solvers: [solver(150), solver(900)], isLoading: false, error: undefined });
    render(<ProposalDetailClient proposalId="VIP-1" />);

    expect(screen.getByText(/all 2 current solvers already meet it/)).toBeInTheDocument();
  });

  it("does not guess when solver data can't be loaded", () => {
    useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: new Error("down") });
    render(<ProposalDetailClient proposalId="VIP-1" />);

    expect(screen.getByText(/Couldn't load solver data/)).toBeInTheDocument();
  });
});
