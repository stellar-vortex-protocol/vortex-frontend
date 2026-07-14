import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import NotFound from "./not-found";

describe("NotFound", () => {
  it("renders a branded 404 message with a link back home", () => {
    render(<NotFound />);

    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByText("← Back to Vortex")).toHaveAttribute("href", "/");
  });

  it("renders within a main landmark", () => {
    render(<NotFound />);
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
  });
});
