import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

const { fetcherMock, registerMock, registrationState } = vi.hoisted(() => ({
  fetcherMock: vi.fn(),
  registerMock: vi.fn(),
  registrationState: { status: "idle" as string, error: null as string | null },
}));
vi.mock("@/lib/api", () => ({ fetcher: fetcherMock, acceptIntent: vi.fn(), ApiError: Error }));
vi.mock("@/hooks/useSolverRegistration", async () => {
  const React = await import("react");
  return {
    useSolverRegistration: () => {
      const [status, setStatus] = React.useState(registrationState.status);
      return {
        status,
        error: registrationState.error,
        errorStep: null,
        reset: () => setStatus("idle"),
        register: async (address: string, bond: number) => {
          registerMock(address, bond);
          setStatus("success");
        },
      };
    },
  };
});
vi.mock("next/navigation", async () => (await import("@/test/navigationMock")).navigationMock);
vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
// Skeleton.tsx currently has duplicate exports on main; stub it out.
vi.mock("@/components/Skeleton", () => ({ SkeletonCard: () => <div /> }));

import { useWalletStore } from "@/store/wallet";
import { getSearch, setSearch } from "@/test/navigationMock";
import SolvePage from "./page";

const SOLVER = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const initialWalletState = useWalletStore.getState();
let funded = true;

function renderPage() {
  fetcherMock.mockImplementation(async (path: string) => {
    if (path === "/solvers") return [];
    if (path === "/intents/open") return [];
    throw new Error(`Unexpected fetch: ${path}`);
  });
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SolvePage />
    </SWRConfig>,
  );
}

describe("solver registration wizard (integration)", () => {
  beforeEach(() => {
    localStorage.clear();
    funded = true;
    setSearch("tab=register");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("/api/account-status")) {
          return new Response(JSON.stringify({ funded }), { status: 200 });
        }
        return new Response("{}", { status: 404 });
      }),
    );
    useWalletStore.setState(
      { ...initialWalletState, isConnected: true, address: SOLVER, networkMismatch: false },
      true,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
  });

  it("walks eligibility → verify → bond → review and registers", async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getByRole("button", { name: /1\. Eligibility/ })).toHaveAttribute("aria-current", "step");
    await waitFor(() => expect(screen.getByText(/Account funded/).textContent).toContain("passed"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(getSearch().get("step")).toBe("verify");

    await user.click(screen.getByRole("button", { name: "Use connected wallet address" }));
    await user.click(screen.getByRole("button", { name: "Next" }));

    await user.click(screen.getByRole("button", { name: "$100" }));
    expect(screen.getByText("100 USDC")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));

    expect(screen.getByRole("heading", { name: "Review & sign" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Sign & register" }));

    expect(registerMock).toHaveBeenCalledWith(SOLVER, 100);
    expect(await screen.findByText("You're registered as a solver.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your solver dashboard" })).toHaveAttribute("href", `/solve/${SOLVER}`);
  });

  it("blocks progress when the account is unfunded and explains how to fix it", async () => {
    funded = false;
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText(/Fund the account with XLM/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Resolve the failed checks above to continue.");
    expect(screen.getByRole("button", { name: /1\. Eligibility/ })).toHaveAttribute("aria-current", "step");
  });

  it("rejects a bond below the minimum", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText(/Account funded/).textContent).toContain("passed"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.click(screen.getByRole("button", { name: "Use connected wallet address" }));
    await user.click(screen.getByRole("button", { name: "Next" }));
    await user.type(screen.getByLabelText("Bond amount (USD)"), "10");
    expect(screen.getByRole("alert")).toHaveTextContent("The bond must be at least $50.");
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("heading", { name: "Bond" })).toBeInTheDocument();
  });

  it("offers to resume a saved draft for the same wallet", async () => {
    localStorage.setItem(
      "vortex:solver-registration-wizard",
      JSON.stringify({ value: { step: "bond", maxStep: 2, address: SOLVER, bond: "75" }, savedAt: Date.now(), walletAddress: SOLVER }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: "Resume registration" }));
    expect(screen.getByRole("heading", { name: "Bond" })).toBeInTheDocument();
    expect(screen.getByLabelText("Bond amount (USD)")).toHaveValue("75");
  });

  it("restarts with a notice when the wallet changes mid-wizard", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText(/Account funded/).textContent).toContain("passed"));
    await user.click(screen.getByRole("button", { name: "Next" }));
    useWalletStore.setState({ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7" });
    expect(await screen.findByText(/Your wallet changed/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /1\. Eligibility/ })).toHaveAttribute("aria-current", "step");
  });

  it("shows a link to the solver profile page after successful registration", async () => {
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
      expect(screen.getByTestId("solver-profile-link")).toBeInTheDocument();
    });

    const profileLink = screen.getByTestId("solver-profile-link");
    expect(profileLink).toHaveAttribute("href", `/solve/${SOLVER_ADDRESS}`);
    expect(profileLink).toHaveTextContent(/view your solver profile/i);
  });
});
