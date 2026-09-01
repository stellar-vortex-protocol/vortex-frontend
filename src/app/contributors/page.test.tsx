import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import { createElement } from "react";
import ContributorsPage from "./page";

vi.mock("@/components/Nav", () => ({
  Nav: () => <nav aria-label="nav" />,
}));
vi.mock("@/components/Footer", () => ({
  Footer: () => <footer aria-label="footer" />,
}));

function renderPage() {
  const { unmount } = render(
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), shouldRetryOnError: false } },
      createElement(ContributorsPage)
    )
  );
  return { unmount };
}

describe("ContributorsPage", () => {
  const mockContributors = [
    { login: "second-user", avatar_url: "https://example.com/b.png", html_url: "https://github.com/second-user", contributions: 3 },
    { login: "first-user", avatar_url: "https://example.com/a.png", html_url: "https://github.com/first-user", contributions: 12 },
  ];

  beforeAll(() => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [],
    } as unknown as Response);
  });

  beforeEach(() => {
    vi.mocked(global.fetch).mockClear().mockResolvedValue({
      ok: true,
      json: async () => mockContributors,
    } as unknown as Response);
  });

  it("renders the page heading and description", async () => {
    const { unmount } = renderPage();
    expect(await screen.findByText("Contributors")).toBeInTheDocument();
    expect(screen.getByText(/Every person listed here/)).toBeInTheDocument();
    unmount();
  });

  it("sorts contributors alphabetically and links to their profiles", async () => {
    const { unmount } = renderPage();

    expect(await screen.findByText("@first-user")).toBeInTheDocument();
    expect(screen.getByText("@second-user")).toBeInTheDocument();

    const firstLink = screen.getByRole("link", { name: /first-user/i });
    expect(firstLink).toHaveAttribute("href", "https://github.com/first-user");
    expect(firstLink).toHaveAttribute("target", "_blank");
    unmount();
  });

  it("shows contribution counts", async () => {
    const { unmount } = renderPage();

    expect(await screen.findByText("12 contributions")).toBeInTheDocument();
    expect(screen.getByText("3 contributions")).toBeInTheDocument();
    unmount();
  });

  it("renders contributors count label listing alphabetically", async () => {
    const { unmount } = renderPage();

    expect(await screen.findByText(/2 contributors — listed alphabetically/)).toBeInTheDocument();
    unmount();
  });

  it("shows an error state when the fetch fails", async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as unknown as Response);

    const { unmount } = renderPage();

    expect(await screen.findByText("Couldn't load contributors")).toBeInTheDocument();
    unmount();
  });
});
