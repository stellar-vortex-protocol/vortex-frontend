import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OpenIntent, Solver } from "@/lib/types";

const { useSolversMock, useOpenIntentsMock, useAcceptIntentMock, acceptMock } = vi.hoisted(() => ({
  useSolversMock: vi.fn(),
  useOpenIntentsMock: vi.fn(),
  useAcceptIntentMock: vi.fn(),
  acceptMock: vi.fn(),
}));
vi.mock("@/hooks/useSolvers", () => ({ useSolvers: useSolversMock }));
vi.mock("@/hooks/useOpenIntents", () => ({ useOpenIntents: useOpenIntentsMock }));
vi.mock("@/hooks/useAcceptIntent", () => ({ useAcceptIntent: useAcceptIntentMock }));

import SolvePage from "./page";

const solvers: Solver[] = [
  {
    name: "Alpha Market Making",
    address: "GABC...1234",
    bondUsd: 5000,
    fills: 842,
    failed: 3,
    volumeUsd: 4_200_000,
    avgFillTimeSeconds: 47,
    successRatePct: 99.6,
    chains: ["Ethereum", "Base"],
    status: "active",
  },
];

const openIntents: OpenIntent[] = [
  {
    id: "a1b2",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "500",
    dstToken: "USDC",
    minOut: "495",
    deadline: new Date(Date.now() + 18 * 60_000).toISOString(),
  },
];

async function openIntentsTab() {
  const user = userEvent.setup();
  await user.click(screen.getByText("intents"));
  return user;
}

describe("SolvePage", () => {
  beforeEach(() => {
    useOpenIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined });
    useAcceptIntentMock.mockReturnValue({ accept: acceptMock, acceptingId: null, error: null });
  });

  describe("leaderboard tab", () => {
    it("shows a loading skeleton while solvers are being fetched", () => {
      useSolversMock.mockReturnValue({ solvers: [], isLoading: true, error: undefined });
      const { container } = render(<SolvePage />);
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });

    it("shows an error state when the leaderboard fails to load", () => {
      useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: new Error("boom") });
      render(<SolvePage />);
      expect(screen.getByText(/Couldn't load the solver leaderboard/)).toBeInTheDocument();
    });

    it("shows an empty state when there are no active solvers", () => {
      useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: undefined });
      render(<SolvePage />);
      expect(screen.getByText("No active solvers yet.")).toBeInTheDocument();
    });

    it("renders solver rows with formatted volume and rates", () => {
      useSolversMock.mockReturnValue({ solvers, isLoading: false, error: undefined });
      render(<SolvePage />);

      expect(screen.getByText("Alpha Market Making")).toBeInTheDocument();
      expect(screen.getByText("842")).toBeInTheDocument();
      expect(screen.getByText("$4.2M")).toBeInTheDocument();
      expect(screen.getByText("47s")).toBeInTheDocument();
      expect(screen.getByText("99.6%")).toBeInTheDocument();
    });
  });

  describe("open intents tab", () => {
    beforeEach(() => {
      useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: undefined });
    });

    it("shows a loading skeleton while intents are being fetched", async () => {
      useOpenIntentsMock.mockReturnValue({ intents: [], isLoading: true, error: undefined });
      const { container } = render(<SolvePage />);
      await openIntentsTab();
      expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    });

    it("shows an error state when open intents fail to load", async () => {
      useOpenIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: new Error("boom") });
      render(<SolvePage />);
      await openIntentsTab();
      expect(screen.getByText(/Couldn't load open intents/)).toBeInTheDocument();
    });

    it("shows an empty state when there are no open intents", async () => {
      useOpenIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined });
      render(<SolvePage />);
      await openIntentsTab();
      expect(screen.getByText(/No open intents right now/)).toBeInTheDocument();
    });

    it("renders open intents and calls accept() when Accept Intent is clicked", async () => {
      useOpenIntentsMock.mockReturnValue({ intents: openIntents, isLoading: false, error: undefined });
      render(<SolvePage />);
      const user = await openIntentsTab();

      expect(screen.getByText("500 USDC on ethereum")).toBeInTheDocument();
      expect(
        screen.getByText((_, el) => /^Min out: 495 USDC · Expires in \d+m$/.test(el?.textContent ?? ""))
      ).toBeInTheDocument();

      await user.click(screen.getByText("Accept Intent →"));
      expect(acceptMock).toHaveBeenCalledWith("a1b2");
    });

    it("disables the button and shows a busy label while accepting", async () => {
      useOpenIntentsMock.mockReturnValue({ intents: openIntents, isLoading: false, error: undefined });
      useAcceptIntentMock.mockReturnValue({ accept: acceptMock, acceptingId: "a1b2", error: null });
      render(<SolvePage />);
      await openIntentsTab();

      const button = screen.getByText("Accepting…");
      expect(button).toBeDisabled();
    });

    it("shows an inline error when accepting fails", async () => {
      useOpenIntentsMock.mockReturnValue({ intents: openIntents, isLoading: false, error: undefined });
      useAcceptIntentMock.mockReturnValue({ accept: acceptMock, acceptingId: null, error: "Intent already claimed" });
      render(<SolvePage />);
      await openIntentsTab();

      expect(screen.getByText("Intent already claimed")).toBeInTheDocument();
    });
  });
});
