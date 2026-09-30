import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { DataTable, type DataTableColumn } from "./DataTable";
import { rankSolvers, sortRankedSolvers, toggleSort, type LeaderboardSortKey, type RankedSolver, type SortSpec } from "@/lib/solverRanking";
import type { Solver } from "@/lib/types";

const base = (i: number, over: Partial<Solver> = {}): Solver => ({
  name: `Solver ${i}`,
  address: `G${String(i).padStart(55, "A")}`,
  bondUsd: 50 + (i % 7) * 100,
  fills: (i * 37) % 500,
  failed: i % 5,
  volumeUsd: (i * 7919) % 2_000_000,
  avgFillTimeSeconds: 5 + (i % 40),
  successRatePct: 0,
  chains: ["ethereum", "base"].slice(0, 1 + (i % 2)),
  status: i % 9 === 0 ? "inactive" : "active",
  ...over,
});

/** Edge cases: ties, zero fills, spoofing characters, a very long name. */
const EDGE_CASES: Solver[] = [
  base(1, { volumeUsd: 1_000, fills: 10 }),
  base(2, { volumeUsd: 1_000, fills: 10 }),
  base(3, { fills: 0, failed: 0, volumeUsd: 0 }),
  base(4, { name: "Evil‮roslov" }),
  base(5, { name: "A very long solver name that should truncate gracefully in narrow layouts" }),
];

const COLUMNS: DataTableColumn<RankedSolver, LeaderboardSortKey>[] = [
  { id: "rank", header: "Rank", sortable: true, cell: (s) => s.rank },
  { id: "name", header: "Solver", sortable: true, isRowHeader: true, cell: (s) => s.name },
  { id: "fills", header: "Fills", sortable: true, align: "right", cell: (s) => s.fills },
  { id: "volumeUsd", header: "Volume", sortable: true, align: "right", cell: (s) => `$${s.volumeUsd.toLocaleString()}` },
  { id: "successRate", header: "Success %", sortable: true, align: "right", cell: (s) => `${s.successRate.toFixed(1)}%` },
];

function Demo({ solvers }: { solvers: Solver[] }) {
  const [sorts, setSorts] = useState<SortSpec<LeaderboardSortKey>[]>([]);
  const rows = sortRankedSolvers(rankSolvers(solvers), sorts);
  return (
    <DataTable
      caption="Solver leaderboard"
      sortHint="Hold Shift to sort by several columns"
      columns={COLUMNS}
      rows={rows}
      getRowKey={(s) => s.address}
      sorts={sorts}
      onSort={(key, multi) => setSorts((s) => toggleSort(s, key, multi))}
    />
  );
}

const meta = {
  title: "Components/DataTable",
  component: Demo,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Accessible sortable table: `aria-sort`, sticky header, shift-click multi-sort, " +
          "card layout below 640 px, and virtualisation above 200 rows.",
      },
    },
  },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const EdgeCases: Story = { args: { solvers: EDGE_CASES } };
export const Empty: Story = { args: { solvers: [] } };
export const FiveHundredRowsVirtualised: Story = {
  args: { solvers: Array.from({ length: 500 }, (_, i) => base(i + 10)) },
};
export const Mobile: Story = {
  args: { solvers: EDGE_CASES },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
