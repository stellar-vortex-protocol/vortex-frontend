import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FeedItem } from "@/lib/types";

const { useWalletStoreMock, useMyLiveIntentsMock } = vi.hoisted(() => ({
  useWalletStoreMock: vi.fn(),
  useMyLiveIntentsMock: vi.fn(),
}));

vi.mock("@/store/wallet", () => ({ useWalletStore: useWalletStoreMock }));
vi.mock("@/store/toast", () => ({ useToastStore: vi.fn(() => ({ addToast: vi.fn() })) }));
vi.mock("@/hooks/useMyLiveIntents", () => ({ useMyLiveIntents: useMyLiveIntentsMock }));
// Nav/Footer are unrelated chrome here and pull in wallet/i18n context this
// suite does not set up - stub them so the page's own content is what's tested.
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));
vi.mock("@/components/ConnectWalletButton", () => ({
  ConnectWalletButton: () => <button type="button">Connect Freighter</button>,
}));

import MyIntentsPage from "./page";

type WalletState = {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
};

function mockWallet(partial: Partial<WalletState> = {}) {
  const state: WalletState = {
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...partial,
  };
  useWalletStoreMock.mockImplementation((sel?: (s: WalletState) => unknown) =>
    typeof sel === "function" ? sel(state) : state
  );
}

const intents: FeedItem[] = [
  {
    id: "1",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "500",
    dstToken: "USDC",
    solver: "Alpha",
    status: "filled",
    createdAt: "2026-07-14T00:00:00Z",
  },
  {
    id: "2",
    srcChain: "base",
    srcToken: "WETH",
    srcAmount: "0.14",
    dstToken: "USDC",
    solver: "Beta",
    status: "pending",
    createdAt: "2026-07-14T00:05:00Z",
  },
];

const manyIntents: FeedItem[] = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  srcChain: i % 5 === 0 ? "base" : "ethereum",
  srcToken: "USDC",
  srcAmount: String(100 + i),
  dstToken: "USDC",
  solver: "Solver" + i,
  status: (i % 3 === 0 ? "pending" : i % 3 === 1 ? "filled" : "accepted") as const,
  createdAt: new Date(2026, 6, 14, i, 0).toISOString(),
}));

describe("MyIntentsPage", () => {
  it("renders the main landmark with the correct id", () => {
    mockWallet();
    useMyLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined, isLive: false });
    render(<MyIntentsPage />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("shows a connect prompt with ConnectWalletButton when wallet is not connected", () => {
    mockWallet({ address: null, isConnected: false });
    useMyLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined, isLive: false });
    render(<MyIntentsPage />);
    expect(screen.getByText(/Connect your wallet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect Freighter/i })).toBeInTheDocument();
    expect(screen.queryByTestId("intents-list")).not.toBeInTheDocument();
  });

  it("renders the page heading", () => {
    mockWallet();
    useMyLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined, isLive: false });
    render(<MyIntentsPage />);
    expect(screen.getByRole("heading", { name: "My Intents" })).toBeInTheDocument();
  });

  it("renders the intents list container when wallet is connected", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    render(<MyIntentsPage />);
    expect(screen.getByTestId("intents-list")).toBeInTheDocument();
  });

  it("shows filter controls when connected", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    render(<MyIntentsPage />);
    expect(screen.getByLabelText("Filter by status")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter by chain")).toBeInTheDocument();
  });

  it("filters by status via its accessible label", async () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    const user = userEvent.setup();
    render(<MyIntentsPage />);

    await user.selectOptions(screen.getByLabelText("Filter by status"), "pending");

    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.queryByText("500 USDC → USDC")).not.toBeInTheDocument();
    expect(screen.getByText("1 intent")).toBeInTheDocument();
  });

  it("filters by chain via its accessible label", async () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    const user = userEvent.setup();
    render(<MyIntentsPage />);

    await user.selectOptions(screen.getByLabelText("Filter by chain"), "base");

    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.queryByText("500 USDC → USDC")).not.toBeInTheDocument();
  });

  it("shows empty state when no intents match the filter", async () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    const user = userEvent.setup();
    render(<MyIntentsPage />);

    await user.selectOptions(screen.getByLabelText("Filter by status"), "accepted");

    expect(screen.getByText("No intents match your filters.")).toBeInTheDocument();
  });

  it("renders loading skeleton with aria-hidden and status announcement", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents: [], isLoading: true, error: undefined });
    const { container } = render(<MyIntentsPage />);

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    const skeletonContainer = container.querySelector('[aria-hidden="true"]');
    expect(skeletonContainer).toBeInTheDocument();
    expect(screen.getByText("Loading your intents...")).toHaveAttribute("role", "status");
  });

  it("shows error state with retry button when fetch fails", async () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: new Error("boom") });
    render(<MyIntentsPage />);

    expect(screen.getByText(/Couldn't load intents/)).toBeInTheDocument();
    const retryButton = screen.getByRole("button", { name: /Retry/i });
    expect(retryButton).toBeInTheDocument();

    await user.click(retryButton);
    expect(mutateMock).toHaveBeenCalled();
  });

  it("shows intent count", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    render(<MyIntentsPage />);
    expect(screen.getByText("2 intents")).toBeInTheDocument();
  });

  it("shows the empty state with a CTA when the wallet has no swaps", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined, isLive: false });
    render(<MyIntentsPage />);
    expect(screen.getByText(/haven't submitted any swaps/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /make your first swap/i })).toHaveAttribute("href", "/");
  });

  it("shows a relative 'submitted ... ago' timestamp on each row", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    const recent: FeedItem[] = [
      { ...intents[0]!, id: "9", createdAt: new Date(Date.now() - 90_000).toISOString() },
    ];
    useMyLiveIntentsMock.mockReturnValue({ intents: recent, isLoading: false, error: undefined });
    render(<MyIntentsPage />);
    expect(screen.getByText(/submitted 1m ago/)).toBeInTheDocument();
  });

  it("links each intent row to the intent detail page", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    render(<MyIntentsPage />);
    const detailLinks = screen.getAllByRole("link").filter((link) =>
      link.getAttribute("href")?.startsWith("/explore/")
    );
    expect(detailLinks).toHaveLength(2);
    expect(detailLinks[0]).toHaveAttribute("href", "/explore/1");
    expect(detailLinks[1]).toHaveAttribute("href", "/explore/2");
  });

  it("renders responsive layout with flex-col on mobile", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined });
    const { container } = render(<MyIntentsPage />);
    const rows = container.querySelectorAll('[data-testid="intents-list"] a');
    rows.forEach((row) => {
      expect(row).toHaveClass("flex-col", "sm:flex-row");
    });
  });

  it("shows filter-empty state (not the no-swaps CTA) when filters exclude all results", async () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<MyIntentsPage />);

    await user.selectOptions(screen.getByLabelText("Filter by status"), "accepted");

    expect(screen.getByText("No intents match your filters.")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /make your first swap/i })).not.toBeInTheDocument();
  });

  it("shows Live indicator when WebSocket is connected", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: true });
    render(<MyIntentsPage />);
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows Polling indicator when WebSocket is not connected", () => {
    mockWallet({ address: "GABC123", isConnected: true });
    useMyLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    render(<MyIntentsPage />);
    expect(screen.getByText("Polling")).toBeInTheDocument();
  });

  it("does not show Live indicator when wallet is not connected", () => {
    mockWallet({ address: null, isConnected: false });
    useMyLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined, isLive: true });
    render(<MyIntentsPage />);
    expect(screen.queryByText(/Live/)).not.toBeInTheDocument();
  });
});
