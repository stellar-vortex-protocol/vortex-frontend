// @ts-nocheck
import { SlashEventFeed, ReasonChip } from "./SlashEventFeed";
import { REASON_CODES } from "@/lib/slashEvents";

const SOLVER = "GDR4FJGZFDFHXGDM66DLF4GNMNKR4BF7BFAKEA6URFRHWAPLFL3REFRB";
const events = [...REASON_CODES, "unregistered_code"].map((reasonCode, i) => ({
  id: `story-${i}`,
  solver: SOLVER,
  reasonCode,
  amountUsd: `${(i + 1) * 100}.00`,
  resultingBondUsd: `${5000 - (i + 1) * 100}.00`,
  intentId: i % 2 ? `intent-${i}` : null,
  createdAt: new Date(Date.UTC(2025, 5, 10 - i, 12)).toISOString(),
}));

const meta = {
  title: "Components/SlashEventFeed",
  component: SlashEventFeed,
  tags: ["autodocs"],
  args: { events },
} satisfies Meta<typeof SlashEventFeed>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllReasonCodes: Story = {};

export const ReasonChips: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {[...REASON_CODES, "unregistered_code"].map((code) => (
        <ReasonChip key={code} code={code} />
      ))}
    </div>
  ),
};

export const Empty: Story = { args: { events: [] } };
export const Loading: Story = { args: { events: [], isLoading: true } };
export const Error: Story = { args: { events: [], error: new Error("offline") } };
export const WithMorePages: Story = { args: { hasMore: true } };
