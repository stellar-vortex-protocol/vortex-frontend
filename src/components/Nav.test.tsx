import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("does not render a mobile menu toggle for the breadcrumb variant", () => {
    render(<Nav variant="breadcrumb" label="Solver Portal" />);
    expect(screen.queryByLabelText("Open menu")).not.toBeInTheDocument();
  });

  describe("mobile menu (home variant)", () => {
    it("is closed by default and opens on toggle", async () => {
      const user = userEvent.setup();
      render(<Nav variant="home" />);

      const toggle = screen.getByLabelText("Open menu");
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.getAllByText("Explore")).toHaveLength(1);

      await user.click(toggle);

      expect(screen.getByLabelText("Close menu")).toHaveAttribute("aria-expanded", "true");
      expect(screen.getAllByText("Explore")).toHaveLength(2);
    });

    it("closes when a link in the panel is clicked", async () => {
      const user = userEvent.setup();
      render(<Nav variant="home" />);

      await user.click(screen.getByLabelText("Open menu"));
      const links = screen.getAllByText("Explore");
      await user.click(links[links.length - 1]);

      expect(screen.getByLabelText("Open menu")).toBeInTheDocument();
      expect(screen.getAllByText("Explore")).toHaveLength(1);
    });
  });
});
