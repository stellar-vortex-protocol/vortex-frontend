import { afterEach, describe, expect, it } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Tooltip } from "./Tooltip";

afterEach(cleanup);

describe("Tooltip", () => {
  it("does not render tooltip content initially", () => {
    render(
      <Tooltip content="Hello tooltip">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the tooltip on mouse hover", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Hover tooltip content">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    await user.hover(screen.getByRole("button", { name: "Trigger" }));
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Hover tooltip content");
  });

  it("hides the tooltip when the mouse leaves", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Hover tooltip content">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    await user.hover(trigger);
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    await user.unhover(trigger);
    // Small delay for the hide timeout.
    await new Promise(r => setTimeout(r, 200));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the tooltip on keyboard focus", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Focus tooltip content">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    await user.tab(); // focus the button
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    expect(screen.getByRole("tooltip")).toHaveTextContent("Focus tooltip content");
  });

  it("hides the tooltip when the trigger loses focus (blur)", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Tooltip content="Focus tooltip content">
          <button type="button">Trigger</button>
        </Tooltip>
        <button type="button">Other</button>
      </>
    );
    await user.tab(); // focus trigger
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    await user.tab(); // move to next element
    await new Promise(r => setTimeout(r, 200));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dismisses the tooltip with the Escape key", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Escape test">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    await user.hover(screen.getByRole("button", { name: "Trigger" }));
    expect(await screen.findByRole("tooltip")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("sets aria-describedby on the trigger element while the tooltip is visible", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="ARIA test">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    expect(trigger).not.toHaveAttribute("aria-describedby");

    await user.hover(trigger);
    const tooltip = await screen.findByRole("tooltip");

    expect(trigger).toHaveAttribute("aria-describedby", tooltip.id);
  });

  it("removes aria-describedby from the trigger when the tooltip closes", async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="ARIA test">
        <button type="button">Trigger</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Trigger" });
    await user.hover(trigger);
    await screen.findByRole("tooltip");
    await user.unhover(trigger);
    await new Promise(r => setTimeout(r, 200));
    expect(trigger).not.toHaveAttribute("aria-describedby");
  });
});
