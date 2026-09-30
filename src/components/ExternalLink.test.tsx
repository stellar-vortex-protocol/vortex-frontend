import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("@/lib/inputs", () => ({
  parseExternalUrl: vi.fn(),
}));

import { parseExternalUrl } from "@/lib/inputs";
import { ExternalLink } from "./ExternalLink";

const mockedParseExternalUrl = parseExternalUrl as ReturnType<typeof vi.fn>;

describe("ExternalLink", () => {
  beforeEach(() => {
    mockedParseExternalUrl.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children as a link when href is valid", () => {
    mockedParseExternalUrl.mockReturnValue("https://github.com/vortex-protocol");

    render(
      <ExternalLink href="https://github.com/vortex-protocol">
        GitHub
      </ExternalLink>,
    );

    const link = screen.getByRole("link", { name: "GitHub" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://github.com/vortex-protocol");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows the external link indicator", () => {
    mockedParseExternalUrl.mockReturnValue("https://github.com/vortex-protocol");

    render(
      <ExternalLink href="https://github.com/vortex-protocol">
        GitHub
      </ExternalLink>,
    );

    expect(screen.getByText("↗")).toBeInTheDocument();
  });

  it("shows the host label when showHostLabel is true", () => {
    mockedParseExternalUrl.mockReturnValue("https://github.com/vortex-protocol");

    render(
      <ExternalLink
        href="https://github.com/vortex-protocol"
        showHostLabel
      >
        GitHub
      </ExternalLink>,
    );

    expect(screen.getByText("(github.com)")).toBeInTheDocument();
  });

  it("renders children as plain text when href is invalid", () => {
    mockedParseExternalUrl.mockReturnValue(null);

    render(
      <ExternalLink href="https://evil.com/phishing">
        Untrusted Link
      </ExternalLink>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Untrusted Link")).toBeInTheDocument();
  });

  it("passes className to the link element", () => {
    mockedParseExternalUrl.mockReturnValue("https://github.com/vortex-protocol");

    render(
      <ExternalLink
        href="https://github.com/vortex-protocol"
        className="custom-class"
      >
        GitHub
      </ExternalLink>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveClass("custom-class");
  });

  it("passes additional anchor props through", () => {
    mockedParseExternalUrl.mockReturnValue("https://github.com/vortex-protocol");

    render(
      <ExternalLink
        href="https://github.com/vortex-protocol"
        aria-label="Open GitHub"
      >
        GitHub
      </ExternalLink>,
    );

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("aria-label", "Open GitHub");
  });

  it("uses custom allowedOrigins", () => {
    mockedParseExternalUrl.mockReturnValue("https://example.com/page");

    render(
      <ExternalLink
        href="https://example.com/page"
        allowedOrigins={["https://example.com"]}
      >
        Example
      </ExternalLink>,
    );

    expect(screen.getByRole("link")).toBeInTheDocument();
  });

  it("rejects non-whitelisted origins even with custom allowedOrigins", () => {
    mockedParseExternalUrl.mockReturnValue(null);

    render(
      <ExternalLink href="https://evil.com" allowedOrigins={["https://safe.com"]}>
        Evil
      </ExternalLink>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
