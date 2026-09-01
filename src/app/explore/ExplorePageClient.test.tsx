import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import type { FeedItem } from "@/lib/types";

const { useLiveIntentsMock } = vi.hoisted(() => ({ useLiveIntentsMock: vi.fn() }));
vi.mock("@/hooks/useLiveIntents", () => ({ useLiveIntents: useLiveIntentsMock }));
// Nav/Footer pull in wallet + i18n context this suite does not set up.
vi.mock("@/components/Nav", () => ({ Nav: () => null }));
vi.mock("@/components/Footer", () => ({ Footer: () => null }));

import ExplorePageClient from "./ExplorePageClient";

const intents: FeedItem[] = [
  {
    id: "1",
    srcChain: "ethereum",
    srcToken: "USDC",
    srcAmount: "500",
    dstToken: "USDC",
    solver: "Alpha",
    status: "filled",
    createdAt: new Date("2026-07-14T00:00:00Z").toISOString(),
  },
];

describe("ExplorePageClient", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-07-14T00:00:30Z"));
    useLiveIntentsMock.mockReturnValue({ intents, isLoading: false, error: undefined, isLive: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders an intent row with a relative timestamp", () => {
    render(<ExplorePageClient />);
    expect(screen.getByText("500 USDC → USDC")).toBeInTheDocument();
    expect(screen.getByText("30s ago")).toBeInTheDocument();
  });

  it("advances the relative timestamp on its own as time passes", () => {
    render(<ExplorePageClient />);
    expect(screen.getByText("30s ago")).toBeInTheDocument();

    act(() => {
      vi.setSystemTime(new Date("2026-07-14T00:02:00Z"));
      vi.advanceTimersByTime(45_000);
    });

    expect(screen.getByText("2m ago")).toBeInTheDocument();
    expect(screen.queryByText("30s ago")).not.toBeInTheDocument();
  });
});
