import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { useGlobalErrorCaptureMock } = vi.hoisted(() => ({
  useGlobalErrorCaptureMock: vi.fn(),
}));

// Stub out the global error capture hook — we test it in isolation
vi.mock("@/hooks/useGlobalErrorCapture", () => ({
  useGlobalErrorCapture: useGlobalErrorCaptureMock,
}));

// Stub the other global client components so this test only checks that the
// layout mounts them.
vi.mock("@/components/CommandPalette", () => ({
  CommandPalette: () => <div data-testid="command-palette" />,
}));
vi.mock("@/components/ConnectivityBanner", () => ({
  ConnectivityBanner: () => <div data-testid="connectivity-banner" />,
}));

import RootLayout from "./layout";

describe("RootLayout", () => {
  it("renders its children", () => {
    render(
      <RootLayout>
        <p>Child content</p>
      </RootLayout>,
    );

    expect(screen.getByText("Child content")).toBeInTheDocument();
  });

  it("renders a skip-to-content link targeting main content", () => {
    render(
      <RootLayout>
        <div />
      </RootLayout>,
    );

    expect(screen.getByText("Skip to main content")).toHaveAttribute(
      "href",
      "#main-content",
    );
  });

  it("mounts the global error capture hook", () => {
    render(
      <RootLayout>
        <div />
      </RootLayout>
    );
    expect(useGlobalErrorCaptureMock).toHaveBeenCalled();
  });

  it("mounts the global error capture, command palette and connectivity banner", () => {
    render(
      <RootLayout>
        <div />
      </RootLayout>,
    );
    expect(useGlobalErrorCaptureMock).toHaveBeenCalled();
    expect(screen.getByTestId("command-palette")).toBeInTheDocument();
    expect(screen.getByTestId("connectivity-banner")).toBeInTheDocument();
  });
});
