import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OriginTrustBanner } from "./OriginTrustBanner";

const mockEvaluateOrigin = vi.hoisted(() => vi.fn());
const mockGetTrustedOrigins = vi.hoisted(() => vi.fn());

vi.mock("@/lib/config", () => ({
  evaluateOrigin: (...args: unknown[]) => mockEvaluateOrigin(...args),
  getTrustedOrigins: () => mockGetTrustedOrigins(),
}));

const mockUseOriginTrust = vi.hoisted(() => ({
  trustLevel: "untrusted" as const,
  hostname: "evil-vortex.app",
  isFramed: false,
}));

vi.mock("@/hooks/useOriginTrust", () => ({
  useOriginTrust: () => mockUseOriginTrust,
}));

vi.mock("@/lib/i18n/I18nProvider", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      if (key === "originTrust.banner.canonicalUrl") {
        return `Visit the canonical site: ${values?.url ?? ""}`;
      }
      return key;
    },
  }),
}));

describe("OriginTrustBanner", () => {
  beforeEach(() => {
    mockEvaluateOrigin.mockReturnValue("untrusted");
    mockGetTrustedOrigins.mockReturnValue(["localhost"]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when the origin is trusted", () => {
    mockUseOriginTrust.trustLevel = "trusted";
    const { container } = render(<OriginTrustBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the origin is unknown", () => {
    mockUseOriginTrust.trustLevel = "unknown";
    const { container } = render(<OriginTrustBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a banner when the origin is untrusted", () => {
    const { getByTestId } = render(<OriginTrustBanner />);
    expect(getByTestId("origin-trust-banner")).toBeInTheDocument();
  });

  it("includes a link to the canonical site", () => {
    render(<OriginTrustBanner />);
    const link = screen.getByRole("link", { name: /visit the canonical site/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://vortexprotocol.org");
  });

  it("has the correct ARIA attributes for an alert", () => {
    const { getByTestId } = render(<OriginTrustBanner />);
    const banner = getByTestId("origin-trust-banner");
    expect(banner).toHaveAttribute("role", "alert");
    expect(banner).toHaveAttribute("aria-live", "assertive");
  });

  it("is non-dismissible (no close button)", () => {
    render(<OriginTrustBanner />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
