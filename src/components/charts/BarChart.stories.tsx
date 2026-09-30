// @ts-nocheck
import { BarChart } from "./BarChart";

const labels = { valueLabel: "Fills", showTableLabel: "Show data table", hideTableLabel: "Hide data table", emptyLabel: "No data in this period." };

const meta = {
  title: "Charts/BarChart",
  component: BarChart,
  tags: ["autodocs"],
  args: {
    title: "Fills per period",
    ...labels,
    data: [3, 5, 0, 8, 2, 6, 4].map((value, i) => ({ label: `2025-06-0${i + 1}`, value })),
  },
} satisfies Meta<typeof BarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {};
export const WithGaps: Story = {
  args: { data: [0, 0, 4, 0, 0, 1, 0].map((value, i) => ({ label: `2025-06-0${i + 1}`, value })) },
};
export const Empty: Story = { args: { data: [0, 0, 0].map((value, i) => ({ label: `d${i}`, value })) } };
export const SuccessRateWithNulls: Story = {
  args: {
    title: "Success rate per period",
    formatValue: (v) => `${v}%`,
    data: [100, null, 80, null, 95].map((value, i) => ({ label: `2025-06-0${i + 1}`, value })),
  },
};
