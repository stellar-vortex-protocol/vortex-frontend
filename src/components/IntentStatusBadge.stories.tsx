// @ts-nocheck
import { IntentStatusBadge } from "./IntentStatusBadge";

const meta = {
  title: "Components/IntentStatusBadge",
  component: IntentStatusBadge,
  tags: ["autodocs"],
  args: {
    status: "pending",
  },
  argTypes: {
    status: {
      control: "select",
      options: ["pending", "accepted", "filled", "failed"],
    },
  },
} satisfies Meta<typeof IntentStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const AllStatuses: Story = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <IntentStatusBadge status="pending" />
      <IntentStatusBadge status="accepted" />
      <IntentStatusBadge status="filled" />
      <IntentStatusBadge status="failed" />
    </div>
  ),
};
