// @ts-nocheck
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { buildTimeline } from "@/lib/timeline";
import { Timeline } from "./Timeline";

const base = {
  id: "intent-demo",
  srcChain: "base",
  srcToken: "USDC",
  srcAmount: "250",
  dstToken: "XLM",
  dstAmount: "2100",
  minOut: "2080",
  dstAddress: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
  solver: "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV",
  status: "pending",
  createdAt: "2026-01-01T00:00:00Z",
  deadline: "2026-01-01T00:10:00Z",
};

const meta = {
  title: "Components/Timeline",
  component: Timeline,
  tags: ["autodocs"],
  decorators: [(Story) => <I18nProvider locale="en"><div className="max-w-md p-4"><Story /></div></I18nProvider>],
} satisfies Meta<typeof Timeline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = { args: { steps: buildTimeline(base) } };

export const Accepted: Story = {
  args: { steps: buildTimeline({ ...base, status: "accepted", acceptedAt: "2026-01-01T00:00:20Z" }) },
};

export const Filled: Story = {
  args: {
    steps: buildTimeline({
      ...base,
      status: "filled",
      acceptedAt: "2026-01-01T00:00:20Z",
      submittedAt: "2026-01-01T00:00:45Z",
      filledAt: "2026-01-01T00:02:10Z",
    }),
  },
};

export const FilledMissingTimestamps: Story = {
  args: { steps: buildTimeline({ ...base, status: "filled", filledAt: "2026-01-01T00:02:10Z" }) },
};

export const FailedBeforeAcceptance: Story = {
  args: { steps: buildTimeline({ ...base, status: "failed", failedAt: "2026-01-01T00:10:00Z" }) },
};
