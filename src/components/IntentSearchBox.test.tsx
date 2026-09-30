import { beforeEach, describe, expect, it } from "vitest";
import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { useRecentSearchesStore } from "@/store/recentSearches";
import { HighlightedText, IntentSearchBox } from "./IntentSearchBox";

function Harness() {
  const [value, setValue] = useState("");
  return (
    <I18nProvider locale="en">
      <IntentSearchBox value={value} onChange={setValue} />
    </I18nProvider>
  );
}

describe("IntentSearchBox", () => {
  beforeEach(() => {
    useRecentSearchesStore.setState({ recent: [] });
  });

  it("exposes combobox semantics and suggests structured tokens", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Search intents" });
    fireEvent.change(input, { target: { value: "stat" } });
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toContain("status:pending Status");
  });

  it("navigates with arrows and accepts with Enter", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "chain:ba" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = screen.getByRole("option", { selected: true });
    expect(input).toHaveAttribute("aria-activedescendant", active.id);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("chain:base ");
  });

  it("Escape closes the list, then clears the input", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "stat" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveAttribute("aria-expanded", "false");
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
  });

  it("records a recent search on Enter and caps/dedupes the list", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "my query" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(useRecentSearchesStore.getState().recent).toEqual(["my query"]);
    for (let i = 0; i < 12; i += 1) useRecentSearchesStore.getState().addRecent(`q${i}`);
    useRecentSearchesStore.getState().addRecent("q11");
    expect(useRecentSearchesStore.getState().recent).toHaveLength(8);
    expect(useRecentSearchesStore.getState().recent[0]).toBe("q11");
  });

  it("ignores Enter during IME composition", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "にほ" } });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(useRecentSearchesStore.getState().recent).toEqual([]);
  });
});

describe("HighlightedText", () => {
  it("wraps matches in <mark> without interpreting HTML", () => {
    const { container } = render(<HighlightedText text="<img src=x>USDC" terms={["usdc"]} />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("mark")).toHaveTextContent("USDC");
  });
});
