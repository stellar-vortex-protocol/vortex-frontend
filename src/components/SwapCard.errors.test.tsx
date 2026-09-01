import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SwapErrorKind } from "@/hooks/useSwapSubmission";

const { submissionMock } = vi.hoisted(() => ({ submissionMock: vi.fn() }));

vi.mock("@/hooks/useSwapSubmission", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useSwapSubmission")>();
  return { ...actual, useSwapSubmission: submissionMock };
});
vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: vi.fn(),
    requestAccess: vi.fn(),
    getNetwork: vi.fn(),
    isAllowed: vi.fn(),
    getPublicKey: vi.fn(),
    signTransaction: vi.fn(),
  },
}));

import { SwapCard } from "./SwapCard";

function mockErrorState(errorKind: SwapErrorKind | null, error = "raw backend message") {
  submissionMock.mockReturnValue({
    status: "error",
    error,
    errorKind,
    intentId: null,
    submit: vi.fn(),
    reset: vi.fn(),
  });
}

describe("SwapCard error guidance (#301)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    submissionMock.mockReset();
  });

  it("always shows the raw error message", () => {
    mockErrorState("generic", "intent rejected: deadline in the past");
    render(<SwapCard />);
    expect(screen.getByRole("alert")).toHaveTextContent("intent rejected: deadline in the past");
  });

  it("offers an expandable troubleshooting panel for a generic failure", async () => {
    mockErrorState("generic");
    render(<SwapCard />);

    const summary = screen.getByText("Why did this happen?");
    expect(screen.queryByText(/enough balance on the source chain/)).not.toBeVisible();

    await userEvent.click(summary);
    expect(screen.getByText(/enough balance on the source chain/)).toBeVisible();
  });

  it("shows specific one-line guidance (not the panel) for a classified failure", () => {
    mockErrorState("no-solver");
    render(<SwapCard />);

    expect(screen.getByText(/No solver is available to fill this swap/)).toBeInTheDocument();
    expect(screen.queryByText("Why did this happen?")).not.toBeInTheDocument();
  });

  it("shows the user-rejected guidance for a declined signature", () => {
    mockErrorState("user-rejected");
    render(<SwapCard />);

    expect(screen.getByText(/declined in Freighter/)).toBeInTheDocument();
  });
});
