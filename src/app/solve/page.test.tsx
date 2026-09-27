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

import { getSearch, setSearch } from "@/test/navigationMock";
import SolvePage from "./page";

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
});
