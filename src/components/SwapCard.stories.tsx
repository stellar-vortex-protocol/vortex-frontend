// @ts-nocheck
import { SwapCard } from "./SwapCard";

const meta = {
  title: "Components/SwapCard",
  component: SwapCard,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="mx-auto w-[460px] max-w-full">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "The preview quote and submit handler keep this story interactive without a backend or wallet.",
      },
    },
  },
  args: {
    initialAmount: "1",
    previewQuote: {
      dstAmount: "3241.53",
      solver: "Northstar",
      fillTimeSeconds: 12,
      priceImpactPct: 0.08,
      protocolFeePct: 0.2,
      rate: "1 ETH = 3,241.53 USDC",
    },
    onPreviewSubmit: () => undefined,
  },
} satisfies Meta<typeof SwapCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    initialAmount: "",
    previewQuote: undefined,
  },
};
