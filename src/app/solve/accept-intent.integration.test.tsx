import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";
import type { OpenIntent, Solver } from "@/lib/types";

const { fetcherMock, acceptIntentMock, ApiErrorCtor } = vi.hoisted(() => {
  class ApiErrorCtor extends Error {
    status: number;
    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }
  return { fetcherMock: vi.fn(), acceptIntentMock: vi.fn(), ApiErrorCtor };
});
vi.mock("@/lib/api", () => ({
  fetcher: fetcherMock,
  acceptIntent: acceptIntentMock,
  ApiError: ApiErrorCtor,
}));
vi.mock("next/navigation", async () => (await import("@/test/navigationMock")).navigationMock);
vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
// Skeleton.tsx currently has duplicate exports on main; stub it out.
vi.mock("@/components/Skeleton", () => ({ SkeletonCard: () => <div /> }));

import { useWalletStore } from "@/store/wallet";
import { ToastViewport } from "@/components/ToastViewport";
import { setSearch } from "@/test/navigationMock";
import SolvePage from "./page";

const SOLVER = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
const registered: Solver = {
  name: "Me",
  address: SOLVER,
  bondUsd: 100,
  fills: 1,
  failed: 0,
  volumeUsd: 1,
  avgFillTimeSeconds: 1,
  successRatePct: 100,
  chains: ["ethereum"],
  status: "active",
};

const intent = (over: Partial<OpenIntent>): OpenIntent => ({
  id: "a1b2",
  srcChain: "ethereum",
  srcToken: "USDC",
  srcAmount: "500",
  dstToken: "USDC",
  minOut: "495",
  deadline: new Date(Date.now() + 18 * 60_000).toISOString(),
  ...over,
});

const initialWalletState = useWalletStore.getState();

function renderSolvePage(open: () => OpenIntent[]) {
  fetcherMock.mockImplementation(async (path: string) => {
    if (path === "/solvers") return [registered];
    if (path === "/intents/open") return open();
    throw new Error(`Unexpected fetch: ${path}`);
  });
  return render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SolvePage />
      <ToastViewport />
    </SWRConfig>,
  );
}

describe("solve page open-intents board (integration)", () => {
  beforeEach(() => {
    setSearch("tab=intents");
    useWalletStore.setState(
      { ...initialWalletState, isConnected: true, address: SOLVER, networkMismatch: false },
      true,
    );
  });

  afterEach(() => {
    useWalletStore.setState(initialWalletState, true);
    vi.clearAllMocks();
  });

  it("accepts an intent, announces it and keeps the row as 'Accepted by you'", async () => {
    acceptIntentMock.mockResolvedValue({ intentId: "a1b2", status: "accepted" });
    const user = userEvent.setup();
    renderSolvePage(() => (acceptIntentMock.mock.calls.length > 0 ? [] : [intent({})]));

    await user.click(await screen.findByRole("button", { name: "Accept Intent" }));

    expect(await screen.findByText("Intent accepted — you have exclusive fill rights.")).toBeInTheDocument();
    expect(acceptIntentMock).toHaveBeenCalledWith("a1b2", SOLVER);
    expect(await screen.findByText("Accepted by you")).toBeInTheDocument();
    expect(screen.getAllByRole("status").some((el) => el.textContent === "Intent a1b2 accepted by you.")).toBe(true);
  });

  it("marks a row 'Taken by another solver' on a 409 race and removes it", async () => {
    acceptIntentMock.mockImplementation(async () => {
      throw new ApiErrorCtor("already accepted", 409);
    });
    const user = userEvent.setup();
    renderSolvePage(() => [intent({ id: "race" })]);

    await user.click(await screen.findByRole("button", { name: "Accept Intent" }));

    expect(await screen.findByText("Taken by another solver")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Accept Intent" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("status").some((el) => el.textContent?.includes("race was taken by another solver"))).toBe(true);
  });

  it("disables Accept for expired intents and sorts by soonest deadline", async () => {
    renderSolvePage(() => [
      intent({ id: "later", srcAmount: "2" }),
      intent({ id: "gone", srcAmount: "1", deadline: new Date(Date.now() - 1_000).toISOString() }),
    ]);

    const items = await screen.findAllByRole("listitem");
    expect(within(items[0]!).getByText("1 USDC on ethereum")).toBeInTheDocument();
    expect(within(items[0]!).getByRole("button", { name: "Accept Intent" })).toBeDisabled();
    expect(within(items[0]!).getAllByText("Expired").length).toBeGreaterThan(0);
    expect(within(items[1]!).getByRole("button", { name: "Accept Intent" })).toBeEnabled();
  });

  it("blocks accepting when the wallet is not a registered solver", async () => {
    useWalletStore.setState({ address: "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN7" });
    renderSolvePage(() => [intent({})]);
    expect(await screen.findByText(/not a registered solver/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Accept Intent" })).toBeDisabled());
  });
});
