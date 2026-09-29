import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrustedDomainIndicator } from "./TrustedDomainIndicator";

const mockUseOriginTrust = vi.hoisted(() => ({
  trustLevel: "trusted" as const,
  hostname: "localhost",
  isFramed: false,
}));

vi.mock("@/hooks/useOriginTrust", () => ({
  useOriginTrust: () => mockUseOriginTrust,
}));

vi.mock("@/lib/i18n/I18nProvider", () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) => {
      if (values) {
        return key.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ""));
      }
      return key;
    },
  }),
}));

describe("TrustedDomainIndicator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUseOriginTrust.trustLevel = "trusted";
    mockUseOriginTrust.hostname = "localhost";
    mockUseOriginTrust.isFramed = false;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders the hostname and network", () => {
    render(<TrustedDomainIndicator />);
    expect(screen.getByTestId("trusted-domain-indicator")).toBeInTheDocument();
    expect(screen.getByText(/hostname:/i)).toBeInTheDocument();
    expect(screen.getByText(/network:/i)).toBeInTheDocument();
  });

  it("shows trusted state in green", () => {
    render(<TrustedDomainIndicator />);
    expect(screen.getByText("trusted")).toHaveClass("text-vx-sage");
  });

  it("shows untrusted state in red", () => {
    mockUseOriginTrust.trustLevel = "untrusted";
    render(<TrustedDomainIndicator />);
    expect(screen.getByText("untrusted")).toHaveClass("text-rose-400");
  });

  it("shows unknown state in muted color", () => {
    mockUseOriginTrust.trustLevel = "unknown";
    render(<TrustedDomainIndicator />);
    expect(screen.getByText("unknown")).toHaveClass("text-vx-muted");
  });

  it("shows a framing warning when the page is framed", () => {
    mockUseOriginTrust.isFramed = true;
    render(<TrustedDomainIndicator />);
    expect(screen.getByText(/this page is being loaded inside a frame/i)).toBeInTheDocument();
  });

  it("shows an untrusted warning when the origin is untrusted", () => {
    mockUseOriginTrust.trustLevel = "untrusted";
    render(<TrustedDomainIndicator />);
    expect(screen.getByText(/this signing request was initiated from an untrusted origin/i)).toBeInTheDocument();
  });
});
