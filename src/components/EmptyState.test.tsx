import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders title, message, icon, and optional action", () => {
    render(
      <EmptyState
        icon={<span aria-label="empty">∅</span>}
        title="Nothing here"
        message="Try changing your filters."
        action={<button type="button">Reset filters</button>}
      />,
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByText("Try changing your filters.")).toBeInTheDocument();
    expect(screen.getByLabelText("empty")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reset filters" }),
    ).toBeInTheDocument();
  });
});
