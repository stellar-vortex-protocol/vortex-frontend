import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectivityBanner } from "./ConnectivityBanner";

// Mock useConnectivity so we can control state without real events.
const mockConnectivity = vi.hoisted(() => ({
  connectivity: "online" as "online" | "offline",
  reconnectionCount: 0,
}));

vi.mock("@/hooks/useConnectivity", () => ({
  useConnectivity: () => mockConnectivity,
}));

// ── Tests ──────────────────────────────────────────────────────────────────

describe("ConnectivityBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockConnectivity.connectivity = "online";
    mockConnectivity.reconnectionCount = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when the user is online and no prior offline event occurred", () => {
    const { container } = render(<ConnectivityBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("shows an offline banner when connectivity transitions to offline", async () => {
    mockConnectivity.connectivity = "offline";

    render(<ConnectivityBanner />);

    await waitFor(() => {
      expect(screen.getByTestId("connectivity-banner")).toBeInTheDocument();
    });

    expect(screen.getByText(/you appear to be offline/i)).toBeInTheDocument();
    expect(screen.getByTestId("connectivity-banner")).toHaveAttribute("data-connectivity", "offline");
  });

  it("shows a 'back online' message when connectivity is restored", async () => {
    // Start offline.
    mockConnectivity.connectivity = "offline";
    const { rerender } = render(<ConnectivityBanner />);

    await waitFor(() => {
      expect(screen.getByTestId("connectivity-banner")).toBeInTheDocument();
    });

    // Regain connectivity.
    mockConnectivity.connectivity = "online";
    rerender(<ConnectivityBanner />);

    await waitFor(() => {
      expect(screen.getByTestId("connectivity-banner")).toHaveAttribute("data-connectivity", "online");
    });

    expect(screen.getByText(/back online/i)).toBeInTheDocument();
  });

  it("automatically dismisses the banner after the grace period on reconnection", async () => {
    mockConnectivity.connectivity = "offline";
    const { rerender } = render(<ConnectivityBanner />);

    await waitFor(() => {
      expect(screen.getByTestId("connectivity-banner")).toBeInTheDocument();
    });

    mockConnectivity.connectivity = "online";
    rerender(<ConnectivityBanner />);

    // Banner should still be visible immediately after coming back online.
    await waitFor(() => {
      expect(screen.getByTestId("connectivity-banner")).toBeInTheDocument();
    });

    // Fast-forward past the 2500ms auto-dismiss timer.
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.queryByTestId("connectivity-banner")).not.toBeInTheDocument();
  });

  it("has role=status and aria-live=polite for accessibility", async () => {
    mockConnectivity.connectivity = "offline";
    render(<ConnectivityBanner />);

    await waitFor(() => {
      const banner = screen.getByTestId("connectivity-banner");
      expect(banner).toHaveAttribute("role", "status");
      expect(banner).toHaveAttribute("aria-live", "polite");
    });
  });
});
