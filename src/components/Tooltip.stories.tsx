import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Tooltip } from "./Tooltip";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  tags: ["autodocs"],
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component:
          "Accessible WAI-ARIA tooltip. Shown on hover and keyboard focus, " +
          "dismissed with Escape. Associated to its trigger via `aria-describedby`. " +
          "Tap-to-toggle on touch devices.",
      },
    },
  },
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: "This is an explanatory tooltip.",
    placement: "top",
  },
  render: (args) => (
    <Tooltip {...args}>
      <span className="underline decoration-dotted underline-offset-2 cursor-help text-sm">
        Hover or focus me
      </span>
    </Tooltip>
  ),
};

export const PriceImpact: Story = {
  args: {
    content:
      "How much your trade moves the effective price relative to the mid-market rate. " +
      "A high impact means you receive less than the quoted mid-market rate.",
    placement: "top",
  },
  render: (args) => (
    <Tooltip {...args}>
      <span className="underline decoration-dotted underline-offset-2 cursor-help text-xs text-gray-400">
        Price impact
      </span>
    </Tooltip>
  ),
};

export const ProtocolFee: Story = {
  args: {
    content:
      "A small percentage fee charged by the Vortex protocol on each settled swap. " +
      "It is deducted from the destination amount.",
    placement: "top",
  },
  render: (args) => (
    <Tooltip {...args}>
      <span className="underline decoration-dotted underline-offset-2 cursor-help text-xs text-gray-400">
        Protocol fee
      </span>
    </Tooltip>
  ),
};

export const FillTime: Story = {
  args: {
    content:
      "Estimated time for a solver to fill your swap after you submit. " +
      "Actual time may vary.",
    placement: "top",
  },
  render: (args) => (
    <Tooltip {...args}>
      <span className="underline decoration-dotted underline-offset-2 cursor-help text-xs text-gray-400">
        Est. fill time
      </span>
    </Tooltip>
  ),
};

export const PlacementBottom: Story = {
  args: {
    content: "This tooltip opens below the trigger.",
    placement: "bottom",
  },
  render: (args) => (
    <Tooltip {...args}>
      <span className="underline decoration-dotted underline-offset-2 cursor-help text-sm">
        Below placement
      </span>
    </Tooltip>
  ),
};
