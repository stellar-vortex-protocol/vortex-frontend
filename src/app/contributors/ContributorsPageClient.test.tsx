import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseIssuesMarkdown } from "@/lib/issuesParser";

vi.mock("@/components/Nav", () => ({ Nav: () => <nav /> }));

import ContributorsPageClient from "./ContributorsPageClient";

const metrics = parseIssuesMarkdown(`
## Solver Network
- #28 Active Solver Uptime Indicator (Complexity: Trivial, Points: 50, Status: Open, Contributor: None, Good first issue: yes)
- #29 Solver Performance Graph (Complexity: Medium, Points: 150, Status: Open, Contributor: None)
`);

describe("ContributorsPageClient good-first-issue filter", () => {
  it("badges curated issues and can filter down to them", async () => {
    const user = userEvent.setup();
    render(<ContributorsPageClient metrics={metrics} />);

    const uptimeRow = screen.getByText("Active Solver Uptime Indicator").closest("tr")!;
    expect(within(uptimeRow).getByText("Good first issue")).toBeInTheDocument();
    expect(screen.getByText("Solver Performance Graph")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Good first issues only"));

    expect(screen.getByText("Active Solver Uptime Indicator")).toBeInTheDocument();
    expect(screen.queryByText("Solver Performance Graph")).not.toBeInTheDocument();
  });
});
