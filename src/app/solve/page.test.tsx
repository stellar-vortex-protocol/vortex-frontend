import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { OpenIntent, Solver } from "@/lib/types";

const { useSolversMock, useOpenIntentsMock, useAcceptIntentMock, acceptMock, useSolverRegistrationMock, registerMock, resetMock } =
  vi.hoisted(() => ({
    useSolversMock: vi.fn(),
    useOpenIntentsMock: vi.fn(),
    useAcceptIntentMock: vi.fn(),
    acceptMock: vi.fn(),
    useSolverRegistrationMock: vi.fn(),
    registerMock: vi.fn(),
    resetMock: vi.fn(),
  }));
vi.mock("@/hooks/useSolvers", () => ({ useSolvers: useSolversMock }));
vi.mock("@/hooks/useOpenIntents", () => ({ useOpenIntents: useOpenIntentsMock }));
vi.mock("@/hooks/useAcceptIntent", () => ({ useAcceptIntent: useAcceptIntentMock }));
vi.mock("@/hooks/useSolverRegistration", () => ({ useSolverRegistration: useSolverRegistrationMock }));

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

const VALID_ADDRESS = "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

async function openIntentsTab() {
  const user = userEvent.setup();
  await user.click(screen.getByText("intents"));
  return user;
}

async function registerTab() {
  const user = userEvent.setup();
  await user.click(screen.getByText("register"));
  return user;
}

describe("SolvePage", () => {
  beforeEach(() => {
    useOpenIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined });
    useAcceptIntentMock.mockReturnValue({ accept: acceptMock, acceptingId: null, error: null });
    useSolverRegistrationMock.mockReturnValue({
      status: "idle",
      error: null,
      register: registerMock,
      reset: resetMock,
    });
  });

  it("renders content within a main landmark", () => {
    useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: undefined });
    render(<SolvePage />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("exposes the tabs with correct ARIA roles and selected state", async () => {
    useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: undefined });
    render(<SolvePage />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "leaderboard" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "intents" })).toHaveAttribute("aria-selected", "false");

    const user = userEvent.setup();
    await user.click(screen.getByRole("tab", { name: "intents" }));

    expect(screen.getByRole("tab", { name: "intents" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "panel-intents");
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

  describe("register tab", () => {
    beforeEach(() => {
      useSolversMock.mockReturnValue({ solvers: [], isLoading: false, error: undefined });
    });

    it("disables submit until both fields are valid", async () => {
      render(<SolvePage />);
      const user = await registerTab();

      const button = screen.getByText("Connect Freighter to Register");
      expect(button).toBeDisabled();

      await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS);
      expect(button).toBeDisabled();

      await user.type(screen.getByLabelText("Bond Amount (USDC)"), "50");
      expect(button).toBeEnabled();
    });

    it("shows a validation error for a malformed Stellar address", async () => {
      render(<SolvePage />);
      const user = await registerTab();

      await user.type(screen.getByLabelText("Stellar Address"), "not-a-valid-address");
      expect(screen.getByText(/Enter a valid Stellar address/)).toBeInTheDocument();
    });

    it("shows a validation error for a bond below the minimum", async () => {
      render(<SolvePage />);
      const user = await registerTab();

      await user.type(screen.getByLabelText("Bond Amount (USDC)"), "10");
      expect(screen.getByText(/Minimum bond is 50 USDC/)).toBeInTheDocument();
    });

    it("calls register() with the entered address and bond amount", async () => {
      render(<SolvePage />);
      const user = await registerTab();

      await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS);
      await user.type(screen.getByLabelText("Bond Amount (USDC)"), "100");
      await user.click(screen.getByText("Connect Freighter to Register"));

      expect(registerMock).toHaveBeenCalledWith(VALID_ADDRESS, 100);
    });

    it("shows a busy label while registering", async () => {
      useSolverRegistrationMock.mockReturnValue({
        status: "awaiting-signature",
        error: null,
        register: registerMock,
        reset: resetMock,
      });
      render(<SolvePage />);
      await registerTab();

      expect(screen.getByText("Confirm in Freighter…")).toBeInTheDocument();
    });

    it("shows a success state and resets the form when clicked again", async () => {
      useSolverRegistrationMock.mockReturnValue({
        status: "success",
        error: null,
        register: registerMock,
        reset: resetMock,
      });
      render(<SolvePage />);
      const user = await registerTab();

      const button = screen.getByText("Registered ✓ — register another");
      await user.click(button);
      expect(resetMock).toHaveBeenCalled();
    });

    it("shows a registration error", async () => {
      useSolverRegistrationMock.mockReturnValue({
        status: "error",
        error: "Bond deposit failed",
        register: registerMock,
        reset: resetMock,
      });
      render(<SolvePage />);
      await registerTab();

      expect(screen.getByText("Bond deposit failed")).toBeInTheDocument();
    });
  });
});
