// @ts-nocheck
import { IntentTrackerView } from "./IntentTracker";
import { deriveTrackerSteps } from "@/lib/intentLifecycle";

const NOW = Date.parse("2026-01-01T12:00:00Z");
const make = (status, deadline = "2026-01-01T12:10:00Z") => {
  const intent = {
    id: "demo-intent",
    srcChain: "base",
    srcToken: "USDC",
    srcAmount: "25",
    dstToken: "XLM",
    solver: "solver-1",
    status,
    createdAt: "2026-01-01T11:55:00Z",
    deadline,
    dstAmount: "211.5",
    minOut: "210.4",
    dstAddress: "GDEST",
  };
  const observed = { accepted: "2026-01-01T11:57:00Z", filled: "2026-01-01T11:58:30Z", failed: "2026-01-01T11:58:30Z" };
  return { intent, view: deriveTrackerSteps(intent, NOW, observed) };
};

const meta = {
  title: "Components/IntentTracker",
  component: IntentTrackerView,
  tags: ["autodocs"],
} satisfies Meta<typeof IntentTrackerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = { args: make("pending") };
export const Accepted: Story = { args: make("accepted") };
export const Filled: Story = { args: { ...make("filled"), onDismiss: () => {} } };
export const Failed: Story = { args: { ...make("failed"), onDismiss: () => {} } };
export const Expired: Story = { args: { ...make("pending", "2026-01-01T11:59:00Z"), onDismiss: () => {} } };
