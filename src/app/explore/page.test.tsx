import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FeedItem } from "@/lib/types";

const { useLiveIntentsMock, downloadCsvMock } = vi.hoisted(() => ({
  useLiveIntentsMock: vi.fn(),
  downloadCsvMock: vi.fn(),
}));
vi.mock("@/hooks/useLiveIntents", () => ({ useLiveIntents: useLiveIntentsMock }));
vi.mock("@/lib/csv", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/csv")>();
  return { ...actual, downloadCsv: downloadCsvMock };
});

import ExplorePage from "./page";

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

function makeIntents(count: number): FeedItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `intent-${i}`,
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: String(i + 1),
    dstToken: "USDC",
    solver: "Alpha",
    status: "filled" as const,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
}

describe("ExplorePage", () => {
  beforeEach(() => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    routerReplaceMock.mockClear();
    Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  });

  it("shows a loading skeleton before the first fetch resolves", () => {
    useLiveIntentsMock.mockReturnValue({ intents: [], isLoading: true, error: undefined, isLive: false });
    const { container } = render(<ExplorePage />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("shows an empty state when there are no intents", () => {
    useLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: undefined, isLive: false });
    render(<ExplorePage />);
    expect(screen.getByText("No intents match your filters.")).toBeInTheDocument();
  });

  it("shows an error state when the fetch fails", () => {
    useLiveIntentsMock.mockReturnValue({ intents: [], isLoading: false, error: new Error("boom"), isLive: false });
    render(<ExplorePage />);
    expect(screen.getByText(/Couldn't load intents/)).toBeInTheDocument();
  });

  it("renders all intents by default and shows a Live indicator when the socket is open", () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: true });
    render(<ExplorePage />);
    expect(screen.getByText("500 USDC → USDC")).toBeInTheDocument();
    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.getByText("2 intents")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("shows a Polling indicator when the socket is not open", () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    render(<ExplorePage />);
    expect(screen.getByText("Polling")).toBeInTheDocument();
  });

  it("filters by status, via its accessible label", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<ExplorePage />);

    await user.selectOptions(screen.getByLabelText("Filter by status"), "pending");

    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.queryByText("500 USDC → USDC")).not.toBeInTheDocument();
    expect(screen.getByText("1 intent")).toBeInTheDocument();
  });

  it("initializes filters from URL query parameters", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("status=pending&chain=base&sort=oldest"));
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    render(<ExplorePage />);

    expect(screen.getByLabelText("Filter by status")).toHaveValue("pending");
    expect(screen.getByLabelText("Filter by chain")).toHaveValue("base");
    expect(screen.getByLabelText("Sort order")).toHaveValue("oldest");
  });

  it("updates the URL when a filter changes", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<ExplorePage />);

    await user.selectOptions(screen.getByLabelText("Filter by status"), "pending");

    expect(routerReplaceMock).toHaveBeenCalledWith("?status=pending", { scroll: false });
  });

  it("filters by chain, via its accessible label", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<ExplorePage />);

    await user.selectOptions(screen.getByLabelText("Filter by chain"), "base");

    expect(screen.getByText("0.14 WETH → USDC")).toBeInTheDocument();
    expect(screen.queryByText("500 USDC → USDC")).not.toBeInTheDocument();
  });

  it("exports CSV for the currently filtered rows", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<ExplorePage />);

    await user.selectOptions(screen.getByLabelText("Filter by status"), "pending");
    await user.click(screen.getByRole("button", { name: "Export CSV" }));

    expect(downloadCsvMock).toHaveBeenCalledWith(
      "vortex-intents.csv",
      [
        "id,srcChain,srcToken,srcAmount,dstToken,solver,status,createdAt",
        "2,base,WETH,0.14,USDC,Beta,pending,2026-07-14T00:05:00Z",
      ].join("\n")
    );
  });

  it("exposes the active sort column via aria-sort, defaulting to newest-first on Time", () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    render(<ExplorePage />);

    expect(screen.getByRole("columnheader", { name: /Time/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute("aria-sort", "none");
  });

  it("sorts by clicking the Time column header, updating aria-sort and row order", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<ExplorePage />);

    expect(screen.getAllByRole("link").filter(a => a.getAttribute("href")?.startsWith("/explore/"))[0]).toHaveTextContent("0.14 WETH → USDC");

    await user.click(screen.getByRole("button", { name: /Time/ }));

    expect(screen.getByRole("columnheader", { name: /Time/ })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getAllByRole("link").filter(a => a.getAttribute("href")?.startsWith("/explore/"))[0]).toHaveTextContent("500 USDC → USDC");
  });

  it("sorts by triggering the Time column header via the keyboard", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<ExplorePage />);

    const timeButton = screen.getByRole("button", { name: /Time/ });
    timeButton.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("columnheader", { name: /Time/ })).toHaveAttribute("aria-sort", "ascending");
    expect(screen.getAllByRole("link").filter(a => a.getAttribute("href")?.startsWith("/explore/"))[0]).toHaveTextContent("500 USDC → USDC");
  });

  it("sorts by the Amount column header", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const user = userEvent.setup();
    render(<ExplorePage />);

    const amountButton = screen.getByRole("button", { name: /Amount/ });
    amountButton.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("columnheader", { name: /Amount/ })).toHaveAttribute("aria-sort", "descending");
    expect(screen.getAllByRole("link").filter(a => a.getAttribute("href")?.startsWith("/explore/"))[0]).toHaveTextContent("500 USDC → USDC");
  });

  it("renders the results within a main landmark", () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    render(<ExplorePage />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });

  it("shows a back-to-top control after scrolling and returns to the top", async () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    Object.defineProperty(window, "scrollY", { configurable: true, value: 401 });
    const user = userEvent.setup();
    render(<ExplorePage />);

    fireEvent.scroll(window);
    await user.click(screen.getByRole("button", { name: "Back to top" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });

  it("links each row to its intent detail page", () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    render(<ExplorePage />);

    expect(screen.getByText("500 USDC → USDC").closest("a")).toHaveAttribute("href", "/explore/1");
  });

  it("does not show pagination controls when everything fits on one page", () => {
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: false });
    render(<ExplorePage />);
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
  });

  it("paginates results at 10 per page and navigates with Next/Previous", async () => {
    useLiveIntentsMock.mockReturnValue({
      intents: makeIntents(15),
      isLoading: false,
      error: undefined,
      isLive: false,
    });
    const user = userEvent.setup();
    render(<ExplorePage />);

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    expect(screen.getAllByText(/USDC → USDC/)).toHaveLength(10);
    expect(screen.getByText("Previous")).toBeDisabled();

    await user.click(screen.getByText("Next"));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getAllByText(/USDC → USDC/)).toHaveLength(5);
    expect(screen.getByText("Next")).toBeDisabled();

    await user.click(screen.getByText("Previous"));
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("resets to page 1 when the sort order changes", async () => {
    useLiveIntentsMock.mockReturnValue({
      intents: makeIntents(15),
      isLoading: false,
      error: undefined,
      isLive: false,
    });
    const user = userEvent.setup();
    render(<ExplorePage />);

    await user.click(screen.getByText("Next"));
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

    await user.selectOptions(screen.getByDisplayValue("Newest first"), "oldest");
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });
});
