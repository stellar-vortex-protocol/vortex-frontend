import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Nav } from "./Nav";

describe("Nav", () => {
  it("renders the full link nav for the home variant", () => {
    render(<Nav variant="home" />);
    expect(screen.getByText("Explore")).toBeInTheDocument();
    expect(screen.getByText("Become a Solver")).toBeInTheDocument();
    expect(screen.getByText("Connect Freighter")).toBeInTheDocument();
  });

  it("renders a breadcrumb for non-home variants", () => {
    render(<Nav variant="breadcrumb" label="Solver Portal" />);
    expect(screen.getByText("Solver Portal")).toBeInTheDocument();
    expect(screen.queryByText("Explore")).not.toBeInTheDocument();
  });
});
