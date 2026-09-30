import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedbackForm } from "./FeedbackForm";

describe("FeedbackForm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a pre-filled GitHub issue built from the form", async () => {
    const openMock = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    render(<FeedbackForm />);

    await user.click(screen.getByRole("button", { name: "Suggest a feature" }));
    expect(screen.getByText(/You'll need a GitHub account/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Title"), "Price alerts & notifications");
    await user.type(
      screen.getByLabelText("What would you like, and what problem does it solve?"),
      "Notify me when XLM moves",
    );
    await user.click(screen.getByRole("button", { name: "Continue on GitHub" }));

    expect(openMock).toHaveBeenCalledTimes(1);
    const [url, target, features] = openMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe(
      "https://github.com/stellar-vortex-protocol/vortex-frontend/issues/new",
    );
    expect(parsed.searchParams.get("title")).toBe("feat: Price alerts & notifications");
    expect(parsed.searchParams.get("body")).toContain("Notify me when XLM moves");
    expect(target).toBe("_blank");
    expect(features).toContain("noopener");
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("requires a title and description before leaving the app", async () => {
    const openMock = vi.spyOn(window, "open").mockReturnValue(null);
    const user = userEvent.setup();
    render(<FeedbackForm />);

    await user.click(screen.getByRole("button", { name: "Suggest a feature" }));
    await user.type(screen.getByLabelText("Title"), "Only a title");
    await user.click(screen.getByRole("button", { name: "Continue on GitHub" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Add a title and a description.");
    expect(openMock).not.toHaveBeenCalled();
  });

  it("closes without submitting on cancel", async () => {
    const user = userEvent.setup();
    render(<FeedbackForm />);

    const toggle = screen.getByRole("button", { name: "Suggest a feature" });
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText("Title")).not.toBeInTheDocument();
  });
});
