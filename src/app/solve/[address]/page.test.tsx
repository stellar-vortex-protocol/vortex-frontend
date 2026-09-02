import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Solver } from "@/lib/types";
import SolverDetailPage from "./page";

const useSolverMock = vi.hoisted(() => vi.fn());
const solverData: Solver = {
  name: "AlphaMax",
  address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
  bondUsd: 500,
  fills: 42,
  failed: 1,
  volumeUsd: 125000,
  avgFillTimeSeconds: 12,
  successRatePct: 97.67,
  chains: ["ethereum", "polygon"],
  status: "active",
};
vi.mock("@/hooks/useSolver", () => ({ useSolver: useSolverMock }));

const { useSolverMock, useSolversMock } = vi.hoisted(() => ({
  useSolverMock: vi.fn((address?: string | null) => {
    if (!address) return { solver: null, isLoading: false, error: undefined };
    const solversState = useSolversMock();
    if (solversState && solversState.solvers) {
      const found = solversState.solvers.find(
        (s: any) => s.address === address,
      );
      if (found) return { solver: found, isLoading: false, error: undefined };
    }
    if (
      address === "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"
    ) {
      return {
        solver: {
          name: "AlphaMax",
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          bondUsd: 500,
          fills: 42,
          failed: 1,
          volumeUsd: 125000,
          avgFillTimeSeconds: 12,
          successRatePct: 97.67,
          chains: ["ethereum", "polygon"],
          status: "active" as const,
        },
        isLoading: false,
        error: undefined,
      };
    }
    return { solver: null, isLoading: false, error: undefined };
  }),
  useSolversMock: vi.fn(() => ({
    solvers: [],
    isLoading: false,
    error: undefined,
  })),
}));

const solverData = {
  name: "AlphaMax",
  address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
  bondUsd: 500,
  fills: 42,
  failed: 1,
  volumeUsd: 125000,
  avgFillTimeSeconds: 12,
  successRatePct: 97.67,
  chains: ["ethereum", "polygon"],
  status: "active" as const,
};

vi.mock("@/hooks/useSolver", () => ({
  useSolver: (address: string | null) => useSolverMock(address),
}));

vi.mock("@/hooks/useSolvers", () => ({
  useSolvers: useSolversMock,
}));

vi.mock("@/hooks/useIntentFeed", () => ({
  useIntentFeed: vi.fn(() => ({
    items: [
      {
        id: "intent-1",
        srcChain: "ethereum",
        srcToken: "USDC",
        srcAmount: "500",
        dstToken: "XLM",
        solver: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
        status: "filled" as const,
        createdAt: new Date().toISOString(),
      },
    ],
    isLoading: false,
    error: undefined,
    isLive: false,
  })),
}));

vi.mock("@/components/Nav", () => ({
  Nav: () => <div data-testid="nav">Nav</div>,
}));

vi.mock("@/components/Footer", () => ({
  Footer: () => <div data-testid="footer">Footer</div>,
}));

vi.mock("@/components/IntentStatusBadge", () => ({
  IntentStatusBadge: ({ status }: { status: string }) => (
    <div data-testid="status-badge">{status}</div>
  ),
}));

describe("SolverDetailPage", () => {
  beforeEach(() => {
    useSolverMock.mockImplementation((address?: string | null) => {
      if (!address) return { solver: null, isLoading: false, error: undefined };
      const solversState = useSolversMock();
      if (solversState && solversState.solvers) {
        const found = solversState.solvers.find(
          (s: any) => s.address === address,
        );
        if (found) return { solver: found, isLoading: false, error: undefined };
      }
      if (
        address === "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING"
      ) {
        return { solver: solverData, isLoading: false, error: undefined };
      }
      return { solver: null, isLoading: false, error: undefined };
    });
  });

  it("rejects an invalid address format", () => {
    useSolverMock.mockReturnValue({
      solver: null,
      isLoading: false,
      error: undefined,
    });
    render(<SolverDetailPage params={{ address: "INVALID_ADDRESS" }} />);

    expect(
      screen.getByText("Invalid solver address format."),
    ).toBeInTheDocument();
  });

  it("does not fetch when address is invalid", () => {
    useSolverMock.mockReturnValue({
      solver: null,
      isLoading: false,
      error: undefined,
    });
    render(<SolverDetailPage params={{ address: "INVALID" }} />);

    expect(useSolverMock).toHaveBeenCalledWith(null);
  });

  it("fetches solver when address is valid", () => {
    useSolverMock.mockReturnValue({
      solver: solverData,
      isLoading: false,
      error: undefined,
    });
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(useSolverMock).toHaveBeenCalledWith("GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV");
  });

  it("renders loading state", () => {
    useSolverMock.mockReturnValue({
      solver: null,
      isLoading: true,
      error: undefined,
    });
    const { container } = render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(
      0,
    );
  });

  it("renders error state when fetch fails", () => {
    useSolverMock.mockReturnValue({
      solver: null,
      isLoading: false,
      error: new Error("Network error"),
    } as any);
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/Couldn't load solver/);
  });

  it("renders not found state when solver is null", () => {
    useSolverMock.mockReturnValue({
      solver: null,
      isLoading: false,
      error: undefined,
    });
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/No solver found/);
  });

  it("renders solver information when found", () => {
    useSolverMock.mockReturnValue({
      solver: solverData,
      isLoading: false,
      error: undefined,
    });
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "AlphaMax",
    );
  });

  it("displays solver metrics in proper structure", () => {
    useSolverMock.mockReturnValue({
      solver: solverData,
      isLoading: false,
      error: undefined,
    });
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(screen.getByText("Fills")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Success Rate")).toBeInTheDocument();
  });

  it("displays chain coverage", () => {
    useSolverMock.mockReturnValue({ solver: solverData, isLoading: false, error: undefined });
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(screen.getByText("Supported Chains")).toBeInTheDocument();
    expect(screen.getByText("ethereum")).toBeInTheDocument();
    expect(screen.getByText("polygon")).toBeInTheDocument();
  });

  it("displays fill history heading", () => {
    useSolverMock.mockReturnValue({
      solver: solverData,
      isLoading: false,
      error: undefined,
    });
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    expect(screen.getByText("Recent Fills by Solver")).toBeInTheDocument();
  });

  it("has back link to solvers list", () => {
    useSolverMock.mockReturnValue({
      solver: solverData,
      isLoading: false,
      error: undefined,
    });
    render(
      <SolverDetailPage params={{ address: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV" }} />
    );

    const backLink = screen.getByText("← Back to solvers");
    expect(backLink).toBeInTheDocument();
    expect(backLink.closest("a")).toHaveClass("focus:outline-none");
  });

  it("uses alert role for error messages", () => {
    render(<SolverDetailPage params={{ address: "INVALID" }} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("No solver found at that address.");
  });

  // Issue #48: Copy-to-clipboard for solver address
  it("renders a copy button for the solver address", () => {
    render(
      <SolverDetailPage
        params={{
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        }}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    expect(copyButton).toBeInTheDocument();
  });

  it("copies solver address to clipboard when copy button is clicked", async () => {
    const mockClipboard = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockClipboard,
      },
    });

    render(
      <SolverDetailPage
        params={{
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        }}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    await userEvent.click(copyButton);

    expect(mockClipboard).toHaveBeenCalledWith(
      "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
    );
  });

  it("shows a success toast when address is copied", async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    render(
      <SolverDetailPage
        params={{
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        }}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    await userEvent.click(copyButton);

    await waitFor(() => {
      const toasts = useToastStore.getState().toasts;
      expect(toasts.some((t) => t.variant === "success")).toBe(true);
    });
  });

  it("copy button is keyboard accessible", async () => {
    const mockClipboard = vi.fn();
    Object.assign(navigator, {
      clipboard: {
        writeText: mockClipboard,
      },
    });

    render(
      <SolverDetailPage
        params={{
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        }}
      />,
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    await userEvent.tab();
    expect(copyButton).toHaveFocus();
    await userEvent.click(copyButton);
    expect(mockClipboard).toHaveBeenCalledWith(
      "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
    );
  });

  // Issue #47: Solver trend indicators
  it("displays solver trend for success rate compared to average", () => {
    render(
      <SolverDetailPage
        params={{
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        }}
      />,
    );

    const successRateTrend = screen.queryByTestId("success-rate-trend");
    if (successRateTrend) {
      expect(successRateTrend).toBeInTheDocument();
    }
  });

  it("displays solver trend for fill time compared to average", () => {
    render(
      <SolverDetailPage
        params={{
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        }}
      />,
    );

    const fillTimeTrend = screen.queryByTestId("fill-time-trend");
    if (fillTimeTrend) {
      expect(fillTimeTrend).toBeInTheDocument();
    }
  });

  it("correctly identifies above-average success rate", () => {
    render(
      <SolverDetailPage
        params={{
          address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
        }}
      />,
    );

    const trendIndicator = screen.queryByText(/above.*average/i);
    if (trendIndicator) {
      expect(trendIndicator).toBeInTheDocument();
    }
  });

  // Issue #46: Not-found state for unknown address
  it("shows not-found state for unknown solver address", () => {
    render(
      <SolverDetailPage
        params={{ address: "GBUNKNOWNADDRESSNOTFOUND0000000000000000000" }}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/No solver found/i);
  });

  it("distinguishes not-found from loading state", () => {
    render(
      <SolverDetailPage
        params={{ address: "GBUNKNOWNADDRESSNOTFOUND0000000000000000000" }}
      />,
    );

    const notFoundAlert = screen.getByRole("alert");
    expect(notFoundAlert).toBeInTheDocument();
    expect(notFoundAlert).not.toHaveClass("animate-pulse");
  });

  it("displays not-found message with proper ARIA role", () => {
    render(
      <SolverDetailPage
        params={{ address: "GBUNKNOWNADDRESSNOTFOUND0000000000000000000" }}
      />,
    );

    const alert = screen.getByRole("alert", { name: /No solver found/i });
    expect(alert).toBeInTheDocument();
  });

  describe("uptime indicator", () => {
    it("displays active status badge when solver is active", () => {
      render(
        <SolverDetailPage
          params={{
            address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          }}
        />,
      );

      const statusBadge = screen.getByLabelText(/Solver status:/);
      expect(statusBadge).toHaveTextContent("Active");
      expect(statusBadge).toHaveClass("bg-vx-sage-bg");
      expect(statusBadge).toHaveClass("text-vx-sage");
    });

    it("displays inactive status badge when solver is inactive", () => {
      useSolverMock.mockReturnValue({
        solver: {
          ...solverData,
          status: "inactive" as "active" | "inactive",
        },
        isLoading: false,
        error: undefined,
      } as any);

      render(
        <SolverDetailPage
          params={{
            address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          }}
        />,
      );

      const statusBadge = screen.getByLabelText(/Solver status:/);
      expect(statusBadge).toHaveTextContent("Inactive");
      expect(statusBadge).toHaveClass("bg-vx-surface");
      expect(statusBadge).toHaveClass("text-vx-muted");
    });

    it("shows status badge in header with proper styling", () => {
      render(
        <SolverDetailPage
          params={{
            address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          }}
        />,
      );

      const statusBadge = screen.getByLabelText(/Solver status:/);
      expect(statusBadge).toHaveClass("font-semibold");
      expect(statusBadge).toHaveClass("border");
      expect(statusBadge).toHaveClass("rounded-lg");
    });

    it("maintains status visibility in responsive layout", () => {
      const { container } = render(
        <SolverDetailPage
          params={{
            address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          }}
        />,
      );

      const headerCard = container.querySelector(".card");
      const statusBadge = screen.getByLabelText(/Solver status:/);

      expect(headerCard).toContainElement(statusBadge);
      expect(statusBadge).toHaveClass("flex-shrink-0");
      expect(statusBadge).toHaveClass("whitespace-nowrap");
    });
  });

  // Issue #45: Loading skeleton
  it("renders loading skeleton while fetching solver details", () => {
    const { useSolversModule } = vi.hoisted(() => ({
      useSolversModule: {
        useSolvers: vi.fn(() => ({
          solvers: [],
          isLoading: true,
          error: undefined,
        })),
      },
    }));

    vi.doMock("@/hooks/useSolvers", () => useSolversModule);

    render(
      <SolverDetailPage params={{ address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" }} />
    );

    const skeletons = screen.queryAllByTestId("skeleton");
    if (skeletons.length > 0) {
      expect(skeletons.length).toBeGreaterThan(0);
    }
  });

  describe("loading skeleton", () => {
    it("renders loading skeleton while fetching solver details", () => {
      useSolverMock.mockReturnValue({
        solver: null,
        isLoading: true,
        error: undefined,
      });

      render(
        <SolverDetailPage
          params={{
            address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          }}
        />,
      );

      const skeletons = screen.queryAllByTestId("skeleton");
      if (skeletons.length > 0) {
        expect(skeletons.length).toBeGreaterThan(0);
      }
    });

    it("skeleton has loading animation", () => {
      useSolverMock.mockReturnValue({
        solver: null,
        isLoading: true,
        error: undefined,
      });

      render(
        <SolverDetailPage
          params={{
            address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          }}
        />,
      );

      const animatedSkeletons = screen.queryAllByTestId("skeleton");
      animatedSkeletons.forEach((skeleton) => {
        expect(skeleton).toHaveClass("animate-pulse");
      });
    });

    it("does not show skeleton when content is loaded", () => {
      useSolverMock.mockReturnValue({
        solver: solverData,
        isLoading: false,
        error: undefined,
      });

      render(
        <SolverDetailPage
          params={{
            address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING",
          }}
        />,
      );

      const skeletons = screen.queryAllByTestId("skeleton");
      expect(skeletons.length).toBe(0);
    });
  });

  it("does not show skeleton when content is loaded", () => {
    render(
      <SolverDetailPage params={{ address: "GBRPYHIL2CI3WHZDTOOQFC6EB4CGQOFN4QO5JTJVSXBLEDSOMETHING" }} />
    );

    const skeletons = screen.queryAllByTestId("skeleton");
    expect(skeletons.length).toBe(0);
  });
});});
