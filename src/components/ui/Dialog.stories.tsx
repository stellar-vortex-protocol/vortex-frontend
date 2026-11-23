import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, within } from "storybook/test";
import { Dialog, type DialogProps } from "./Dialog";

function DialogDemo(props: Omit<DialogProps, "open" | "onClose"> & { triggerLabel: string }) {
  const [open, setOpen] = useState(false);
  const { triggerLabel, children, ...dialogProps } = props;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-sm rounded-md border border-vx-border text-vx-text"
      >
        {triggerLabel}
      </button>
      <Dialog {...dialogProps} open={open} onClose={() => setOpen(false)}>
        <div className="p-6 max-w-sm bg-vx-card text-vx-text rounded-xl">
          {children}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-4 px-3 py-1.5 text-sm rounded-md border border-vx-border"
          >
            Close
          </button>
        </div>
      </Dialog>
    </>
  );
}

const meta = {
  title: "Components/Dialog",
  component: DialogDemo,
  tags: ["autodocs"],
  args: {
    triggerLabel: "Open dialog",
    "aria-label": "Confirm swap",
    children: <p className="text-sm">Review the details before you confirm.</p>,
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Modal dialog with a focus trap, focus restoration on close, and Escape / " +
          "outside-press dismissal. Use `disableEscape` for destructive confirmations.",
      },
    },
  },
} satisfies Meta<typeof DialogDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    await step("open the dialog", async () => {
      await user.click(canvas.getByRole("button", { name: "Open dialog" }));
      await expect(canvas.getByRole("dialog", { name: "Confirm swap" })).toBeInTheDocument();
    });

    await step("Escape dismisses it and restores focus to the trigger", async () => {
      await user.keyboard("{Escape}");
      await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
      await expect(canvas.getByRole("button", { name: "Open dialog" })).toHaveFocus();
    });
  },
};

export const EscapeDisabled: Story = {
  args: {
    "aria-label": "Confirm irreversible action",
    disableEscape: true,
    children: <p className="text-sm">This action cannot be undone.</p>,
  },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();

    await step("open the dialog", async () => {
      await user.click(canvas.getByRole("button", { name: "Open dialog" }));
      await expect(canvas.getByRole("dialog")).toBeInTheDocument();
    });

    await step("Escape does not dismiss a destructive confirmation", async () => {
      await user.keyboard("{Escape}");
      await expect(canvas.getByRole("dialog")).toBeInTheDocument();
    });
  },
};

export const RestoresFocusToTrigger: Story = {
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const user = userEvent.setup();
    const trigger = canvas.getByRole("button", { name: "Open dialog" });

    await step("open the dialog with the keyboard", async () => {
      trigger.focus();
      await user.keyboard("{Enter}");
      await expect(canvas.getByRole("dialog", { name: "Confirm swap" })).toBeInTheDocument();
    });

    await step("close via the Close button and confirm focus returns to the trigger", async () => {
      await user.click(within(canvas.getByRole("dialog")).getByRole("button", { name: "Close" }));
      await expect(canvas.queryByRole("dialog")).not.toBeInTheDocument();
      await expect(trigger).toHaveFocus();
    });
  },
};
