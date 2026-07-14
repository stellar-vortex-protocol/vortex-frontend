import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Footer } from "./Footer";

describe("Footer", () => {
  it("renders copyright and social links", () => {
    render(<Footer />);
    expect(screen.getByText(/Vortex Protocol/)).toBeInTheDocument();
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Discord")).toBeInTheDocument();
  });
});
