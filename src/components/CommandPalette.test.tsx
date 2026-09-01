import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import { CommandPalette } from "./CommandPalette";

// A well-formed Stellar Ed25519 public key (checksum valid).
const VALID_ADDRESS = "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

function openPalette() {
  fireEvent.keyDown(window, { key: "k", metaKey: true });
}

describe("CommandPalette", () => {
  beforeEach(() => {
    pushMock.mockReset();
  });

  afterEach(() => {
    // Ensure a lingering open palette from one test can't leak into the next.
    fireEvent.keyDown(window, { key: "Escape" });
  });

  it("is closed until the Cmd/Ctrl+K shortcut is pressed", () => {
    render(<CommandPalette />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    openPalette();
    expect(screen.getByRole("dialog", { name: "Command palette" })).toBeInTheDocument();
  });

  it("toggles closed on a second shortcut press and on Escape", () => {
    render(<CommandPalette />);

    openPalette();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    openPalette();
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("lists the four top-level routes by default", () => {
    render(<CommandPalette />);
    openPalette();

    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining("Swap"),
      expect.stringContaining("Explore intents"),
      expect.stringContaining("Become a solver"),
      expect.stringContaining("My Intents"),
    ]);
  });

  it("filters routes by the typed query", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    await user.type(screen.getByRole("combobox"), "solver");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("Become a solver");
  });

  it("moves the active option with the arrow keys and activates it with Enter", async () => {
    render(<CommandPalette />);
    openPalette();

    const combobox = screen.getByRole("combobox");
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(combobox, { key: "ArrowDown" });
    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(combobox, { key: "Enter" });
    expect(pushMock).toHaveBeenCalledWith("/explore");
  });

  it("navigates directly to a solver page when a valid address is entered", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    await user.type(screen.getByRole("combobox"), VALID_ADDRESS);
    const lookup = screen.getByRole("option", { name: /Go to solver/ });
    await user.click(lookup);

    expect(pushMock).toHaveBeenCalledWith(`/solve/${VALID_ADDRESS}`);
  });

  it("treats a non-address token as an intent id lookup", async () => {
    const user = userEvent.setup();
    render(<CommandPalette />);
    openPalette();

    await user.type(screen.getByRole("combobox"), "intent-42");
    const lookup = screen.getByRole("option", { name: /Open intent/ });
    await user.click(lookup);

    expect(pushMock).toHaveBeenCalledWith("/explore/intent-42");
  });

  it("closes and restores focus after activating a command", async () => {
    render(<CommandPalette />);
    openPalette();

    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Enter" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
