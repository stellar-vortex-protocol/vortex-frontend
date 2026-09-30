import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { Solver } from "@/lib/types";

const { fetcherMock, downloadCsvMock } = vi.hoisted(() => ({
  fetcherMock: vi.fn(),
  downloadCsvMock: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ fetcher: fetcherMock, acceptIntent: vi.fn(), ApiError: Error }));
vi.mock("@/lib/csv", async (orig) => ({ ...(await orig<typeof import("@/lib/csv")>()), downloadCsv: downloadCsvMock }));
vi.mock("next/navigation", async () => (await import("@/test/navigationMock")).navigationMock);
vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
// Skeleton.tsx currently has duplicate exports on main; stub it out.
vi.mock("@/components/Skeleton", () => ({ SkeletonCard: () => <div /> }));

import SolvePage from "./SolvePageClient";
import { messages } from "@/i18n/messages";
import { useWalletStore } from "@/store/wallet";
import { getSearch, setSearch } from "@/test/navigationMock";

const solver = (over: Partial<Solver>): Solver => ({
  name: "Solver",
  address: "GA",
  bondUsd: 100,
  fills: 10,
  failed: 0,
  volumeUsd: 1_000,
  avgFillTimeSeconds: 12,
  successRatePct: 100,
  chains: ["ethereum"],
  status: "active",
  ...over,
});

const solvers: Solver[] = [
  solver({ name: "Alpha", address: "GALPHA", volumeUsd: 5_000, fills: 3, previousRank: 1 }),
  solver({ name: "Beta‮", address: "GBETA", volumeUsd: 9_000, fills: 1, chains: ["base"], verified: true, homeDomain: "beta.example" }),
  solver({ name: "Gamma", address: "GGAMMA", volumeUsd: 100, fills: 0, failed: 0, status: "inactive", bondUsd: 10 }),
];

function renderPage() {
  fetcherMock.mockImplementation(async (path: string) => {
    if (path.startsWith("/solvers")) return solvers;
    if (path === "/intents/open") return [];
    throw new Error(`Unexpected fetch: ${path}`);
  });
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SolvePage />
    </SWRConfig>,
  );
}

const bodyRows = () => within(screen.getByRole("table")).getAllByRole("row").slice(1);
const names = () => bodyRows().map((r) => within(r).getByRole("rowheader").querySelector("a")?.textContent);

describe("Solve page — leaderboard", () => {
  beforeEach(() => {
    localStorage.clear();
    setSearch("");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ domain: "beta.example", domainUnicode: "beta.example", accounts: ["GBETA"], orgName: "Beta Org", orgUrl: null }))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders a ranked, accessible table with sanitised names, rank deltas and identity chips", async () => {
    renderPage();
    expect(await screen.findByRole("table", { name: /Active Solvers/ })).toBeInTheDocument();
    expect(names()).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(screen.getByText("Down 1 places", { exact: false })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Domain verified/ })).toBeInTheDocument();
  });

  it("sorts via header buttons and mirrors the sort in the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: /^Fills/ }));
    expect(getSearch().get("sort")).toBe("fills:asc");
    expect(names()).toEqual(["Gamma", "Beta", "Alpha"]);
    expect(screen.getByRole("columnheader", { name: /Fills/ })).toHaveAttribute("aria-sort", "ascending");
  });

  it("filters by status, min bond and verified-only through the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table");
    await user.selectOptions(screen.getByLabelText("Status"), "active");
    expect(getSearch().get("status")).toBe("active");
    expect(names()).toEqual(["Beta", "Alpha"]);
    await user.click(screen.getByLabelText("Verified only"));
    expect(names()).toEqual(["Beta"]);
  });

  it("switches time window and requests window-scoped metrics", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "7d" }));
    expect(getSearch().get("window")).toBe("7d");
    expect(fetcherMock).toHaveBeenCalledWith("/solvers?window=7d");
  });

  it("exports the visible table to CSV", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    const [filename, csv] = downloadCsvMock.mock.calls[0] as [string, string];
    expect(filename).toBe("vortex-solvers-all.csv");
    expect(csv.split("\n")[0]).toBe("Rank,Solver,Fills,Volume,Success %,Avg fill time,Bond,address");
    expect(csv).toContain("GBETA");
  });

  it("switches tabs via the URL", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Open intents" }));
    expect(getSearch().get("tab")).toBe("intents");
    expect(screen.getByRole("tab", { name: "Open intents" })).toHaveAttribute("aria-selected", "true");
  });

  describe("registration wizard", () => {
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

    it("shows a visible focus ring on the address and bond inputs", async () => {
      render(<SolvePage />);
      await registerTab();

      expect(screen.getByLabelText("Stellar Address")).toHaveClass(
        "focus:ring-2",
        "focus:ring-vx-sage",
      );
      expect(screen.getByLabelText("Bond Amount (USDC)")).toHaveClass(
        "focus:ring-2",
        "focus:ring-vx-sage",
      );
    });

    it("shows a validation error for a malformed Stellar address", async () => {
      render(<SolvePage />);
      const user = await registerTab();

      await user.type(
        screen.getByLabelText("Stellar Address"),
        "not-a-valid-address",
      );
      expect(
        screen.getByText(/Enter a valid Stellar address/),
      ).toBeInTheDocument();
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

    it("shows a profile link after successful registration", async () => {
      useSolverRegistrationMock.mockReturnValue({
        status: "success",
        error: null,
        register: registerMock,
        reset: resetMock,
      });
      render(<SolvePage />);
      const user = await registerTab();

      // Pre-fill the address field so the link has a target
      await user.type(screen.getByLabelText("Stellar Address"), VALID_ADDRESS);

      const profileLink = screen.getByTestId("solver-profile-link");
      expect(profileLink).toBeInTheDocument();
      expect(profileLink).toHaveAttribute("href", `/solve/${VALID_ADDRESS}`);
      expect(profileLink).toHaveTextContent(/view your solver profile/i);
    });
  });

  // ── Registered-solver banner ──────────────────────────────────────────────

  describe("registered solver banner", () => {
    const REGISTERED_ADDRESS =
      "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

    const registeredSolver: Solver = {
      name: "My Solver",
      address: REGISTERED_ADDRESS,
      bondUsd: 1000,
      fills: 10,
      failed: 0,
      volumeUsd: 50_000,
      avgFillTimeSeconds: 8,
      successRatePct: 100,
      chains: ["ethereum"],
      status: "active",
    };

    beforeEach(() => {
      useOpenIntentsMock.mockReturnValue({
        intents: [],
        isLoading: false,
        error: undefined,
      });
      useSolverRegistrationMock.mockReturnValue({
        status: "idle",
        error: null,
        register: registerMock,
        reset: resetMock,
      });
    });

    it("shows the banner when the connected wallet is a registered solver", () => {
      useWalletStore.setState({ address: REGISTERED_ADDRESS } as any, false);
      useSolversMock.mockReturnValue({
        solvers: [registeredSolver],
        isLoading: false,
        error: undefined,
      });

      render(<SolvePage />);

      expect(
        screen.getByRole("status", { name: /you are a registered solver/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/My Solver/)).toBeInTheDocument();
    });

    it("banner links to the solver detail page", () => {
      useWalletStore.setState({ address: REGISTERED_ADDRESS } as any, false);
      useSolversMock.mockReturnValue({
        solvers: [registeredSolver],
        isLoading: false,
        error: undefined,
      });

      render(<SolvePage />);

      const link = screen.getByRole("link", { name: /view your profile/i });
      expect(link).toHaveAttribute("href", `/solve/${REGISTERED_ADDRESS}`);
    });

    it("hides the banner when the connected wallet is not a registered solver", () => {
      useWalletStore.setState({ address: "GDIFFERENT000000000000000000000000000000000000000000000000" } as any, false);
      useSolversMock.mockReturnValue({
        solvers: [registeredSolver],
        isLoading: false,
        error: undefined,
      });

      render(<SolvePage />);

      expect(
        screen.queryByRole("status", { name: /you are a registered solver/i }),
      ).not.toBeInTheDocument();
    });

    it("hides the banner when no wallet is connected", () => {
      useWalletStore.setState({ address: null } as any, false);
      useSolversMock.mockReturnValue({
        solvers: [registeredSolver],
        isLoading: false,
        error: undefined,
      });

      render(<SolvePage />);

      expect(
        screen.queryByRole("status", { name: /you are a registered solver/i }),
      ).not.toBeInTheDocument();
    });

    it("matches solver address case-insensitively", () => {
      // Wallet address is lowercase — solver list has uppercase
      useWalletStore.setState(
        { address: REGISTERED_ADDRESS.toLowerCase() } as any,
        false,
      );
      useSolversMock.mockReturnValue({
        solvers: [registeredSolver],
        isLoading: false,
        error: undefined,
      });

      render(<SolvePage />);

      expect(
        screen.getByRole("status", { name: /you are a registered solver/i }),
      ).toBeInTheDocument();
    });
  });
  });
});
