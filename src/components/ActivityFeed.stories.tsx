// Storybook is optional in the application dependency graph.
// @ts-nocheck
import * as React from "react";
import { ActivityFeedView } from "./ActivityFeed";
import type { FeedItem } from "@/lib/types";

const now = Date.now();
const items: FeedItem[] = [
  {
    id: "intent-1",
    srcChain: "ethereum",
    srcToken: "ETH",
    srcAmount: "1.25",
    dstToken: "USDC",
    solver: "Northstar",
    status: "filled",
    createdAt: new Date(now - 18_000).toISOString(),
  },
  {
    id: "intent-2",
    srcChain: "base",
    srcToken: "USDC",
    srcAmount: "850",
    dstToken: "XLM",
    solver: "Orbit",
    status: "filled",
    createdAt: new Date(now - 72_000).toISOString(),
  },
  {
    id: "intent-3",
    srcChain: "arbitrum",
    srcToken: "ETH",
    srcAmount: "0.42",
    dstToken: "USDC",
    solver: "Meridian",
    status: "filled",
    createdAt: new Date(now - 180_000).toISOString(),
  },
];

const meta = {
  title: "Components/ActivityFeed",
  component: ActivityFeedView,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="w-[420px] max-w-full">
        <Story />
      </div>
    ),
  ],
  args: {
    items,
    isLoading: false,
    error: null,
    isLive: true,
  },
} satisfies Meta<typeof ActivityFeedView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Live: Story = {};

export const Polling: Story = {
  args: {
    isLive: false,
  },
};

export const Loading: Story = {
  args: {
    items: [],
    isLoading: true,
  },
};

export const Empty: Story = {
  args: {
    items: [],
  },
};

export const Error: Story = {
  args: {
    items: [],
    error: new Error("Feed unavailable"),
  },
};

/**
 * Buffered live updates: new fills arrive every 2 s. Hover or focus the feed
 * (or press "Live — pause updates") and they queue behind a "N new intents"
 * pill instead of shifting the rows under the cursor.
 */
export const BufferedLiveUpdates: Story = {
  render: (args) => {
    const [feed, setFeed] = React.useState(args.items);
    React.useEffect(() => {
      let n = 0;
      const timer = setInterval(() => {
        n += 1;
        setFeed((current) => [
          { ...items[n % items.length], id: `live-${n}`, createdAt: new Date().toISOString() },
          ...current,
        ]);
      }, 2000);
      return () => clearInterval(timer);
    }, []);
    return <ActivityFeedView {...args} items={feed} />;
  },
};
