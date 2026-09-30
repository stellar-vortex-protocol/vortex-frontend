import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { useViewsStore } from "@/store/views";
import { SavedViews } from "./SavedViews";

function setup(currentParams: Record<string, string> = { status: "failed" }) {
  const onApply = vi.fn();
  render(
    <I18nProvider locale="en">
      <SavedViews scope="explore" currentParams={currentParams} onApply={onApply} />
    </I18nProvider>,
  );
  return { onApply };
}

describe("SavedViews", () => {
  beforeEach(() => {
    useViewsStore.setState({ views: [] });
  });

  it("applies a built-in view", () => {
    const { onApply } = setup({});
    fireEvent.click(screen.getByRole("button", { name: "Large fills" }));
    expect(onApply).toHaveBeenCalledWith({ status: "filled", sort: "largest" });
  });

  it("saves the current params under a name and applies it", () => {
    const { onApply } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.change(screen.getByLabelText("View name"), { target: { value: "Ops" } });
    fireEvent.submit(screen.getByLabelText("View name").closest("form")!);
    expect(screen.getByRole("status")).toHaveTextContent("View saved.");
    fireEvent.click(screen.getByRole("button", { name: "Ops" }));
    expect(onApply).toHaveBeenCalledWith({ status: "failed" });
  });

  it("renames, reorders with buttons, and deletes", () => {
    useViewsStore.getState().saveView("explore", "A", {});
    useViewsStore.getState().saveView("explore", "B", {});
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Move B up" }));
    expect(useViewsStore.getState().views.map((v) => v.name)).toEqual(["B", "A"]);

    fireEvent.click(screen.getByRole("button", { name: "Rename view A" }));
    const input = screen.getByLabelText("Rename view");
    fireEvent.change(input, { target: { value: "Alpha" } });
    fireEvent.submit(input.closest("form")!);
    expect(useViewsStore.getState().views.map((v) => v.name)).toEqual(["B", "Alpha"]);

    fireEvent.click(screen.getByRole("button", { name: "Delete view B" }));
    expect(useViewsStore.getState().views.map((v) => v.name)).toEqual(["Alpha"]);
  });

  it("shows a notice when a view references removed filters", () => {
    useViewsStore.setState({
      views: [{ id: "x", name: "Old", scope: "explore", params: { chain: "gone", status: "failed" } }],
    });
    const { onApply } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Old" }));
    expect(onApply).toHaveBeenCalledWith({ status: "failed" });
    expect(screen.getByRole("status")).toHaveTextContent("no longer available");
  });
});
