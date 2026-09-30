/**
 * Renders the routed pages under the Spanish locale and checks that their
 * copy comes from the es catalog, not English fallbacks (#402).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nProvider } from "./I18nProvider";
import { en } from "./messages/en";
import { es } from "./messages/es";
import type { MessageKey } from ".";

vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));
vi.mock("@/components/Footer", () => ({ Footer: () => <footer /> }));
vi.mock("@/hooks/useLiveIntents", () => ({
  useLiveIntents: () => ({ intents: [], isLoading: false, error: undefined, isLive: false }),
}));
vi.mock("@/hooks/useMyLiveIntents", () => ({
  useMyLiveIntents: () => ({ intents: [], isLoading: false, error: undefined, isLive: false, mutate: vi.fn() }),
}));
vi.mock("@/hooks/useSolvers", () => ({
  useSolvers: () => ({ solvers: [], isLoading: false, error: undefined }),
}));
vi.mock("@/hooks/useOpenIntents", () => ({
  useOpenIntents: () => ({ intents: [], isLoading: false, error: undefined }),
}));
vi.mock("@/hooks/useAcceptIntent", () => ({
  useAcceptIntent: () => ({ accept: vi.fn(), acceptingId: null, error: null }),
}));
vi.mock("@/hooks/useSolverRegistration", () => ({
  useSolverRegistration: () => ({ status: "idle", error: null, errorStep: null, register: vi.fn(), reset: vi.fn() }),
}));
vi.mock("swr", async (importOriginal) => ({
  ...(await importOriginal<typeof import("swr")>()),
  default: () => ({ data: [], isLoading: false, error: undefined }),
}));

import ExplorePageClient from "@/app/explore/ExplorePageClient";
import AnalyticsPageClient from "@/app/analytics/AnalyticsPageClient";
import SolvePageClient from "@/app/solve/SolvePageClient";
import GovernancePageClient from "@/app/governance/GovernancePageClient";
import MyIntentsPage from "@/app/my-intents/page";
import ContributorsPage from "@/app/contributors/page";

const inSpanish = (ui: ReactNode) => render(<I18nProvider locale="es">{ui}</I18nProvider>);

const pages: [string, () => ReactNode, MessageKey][] = [
  ["/explore", () => <ExplorePageClient />, "explore.title"],
  ["/analytics", () => <AnalyticsPageClient />, "analytics.empty.title"],
  ["/solve", () => <SolvePageClient />, "solve.hero.title"],
  ["/governance", () => <GovernancePageClient />, "governance.title"],
  ["/my-intents", () => <MyIntentsPage />, "myIntents.title"],
  ["/contributors", () => <ContributorsPage />, "contributors.title"],
];

describe("pages under the es locale", () => {
  it.each(pages)("%s renders its heading in Spanish", (_route, page, headingKey) => {
    inSpanish(page());
    expect(es[headingKey]).not.toBe(en[headingKey]);
    expect(screen.getByRole("heading", { level: 1, name: es[headingKey] })).toBeInTheDocument();
    expect(screen.queryByText(en[headingKey])).not.toBeInTheDocument();
  });
});
