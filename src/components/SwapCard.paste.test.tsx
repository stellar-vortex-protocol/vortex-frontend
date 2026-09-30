/**
 * Clipboard-content confirmation for destination-address paste (#314):
 * a paste is held for explicit confirmation instead of being written straight
 * into the field; typed input is unaffected.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SWRConfig } from "swr";

vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: vi.fn(),
    requestAccess: vi.fn(),
    getNetwork: vi.fn(),
    isAllowed: vi.fn(),
    getPublicKey: vi.fn(),
    signTransaction: vi.fn(),
  },
}));

import { SwapCard } from "./SwapCard";

const PASTED = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";

function renderSwapCard() {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <SwapCard />
    </SWRConfig>,
  );
  return screen.getByLabelText("Destination address") as HTMLInputElement;
}

function paste(input: HTMLInputElement, text: string) {
  fireEvent.paste(input, { clipboardData: { getData: () => text } });
}

describe("SwapCard - destination paste confirmation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("holds a pasted address for confirmation instead of filling the field", () => {
    const input = renderSwapCard();

    paste(input, PASTED);

    expect(input.value).toBe("");
    expect(screen.getByText(/Address pasted from clipboard/)).toBeInTheDocument();
  });

  it("shows the full pasted address so every character can be checked", () => {
    const input = renderSwapCard();

    paste(input, `  ${PASTED}  `);

    expect(screen.getByText(PASTED)).toBeInTheDocument();
  });

  it("fills the field when the paste is confirmed", async () => {
    const input = renderSwapCard();

    paste(input, PASTED);
    await userEvent.click(screen.getByRole("button", { name: "Use this address" }));

    expect(input.value).toBe(PASTED);
    expect(screen.queryByText(/Address pasted from clipboard/)).not.toBeInTheDocument();
  });

  it("leaves the field untouched when the paste is dismissed", async () => {
    const input = renderSwapCard();

    paste(input, PASTED);
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(input.value).toBe("");
    expect(screen.queryByText(/Address pasted from clipboard/)).not.toBeInTheDocument();
  });

  it("does not ask for confirmation when the address is typed", async () => {
    const input = renderSwapCard();

    await userEvent.type(input, "GABC");

    expect(input.value).toBe("GABC");
    expect(screen.queryByText(/Address pasted from clipboard/)).not.toBeInTheDocument();
  });

  it("ignores an empty paste", () => {
    const input = renderSwapCard();

    paste(input, "   ");

    expect(screen.queryByText(/Address pasted from clipboard/)).not.toBeInTheDocument();
  });
});
