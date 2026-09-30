import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { DataTable, type DataTableColumn } from "./DataTable";

type Row = { id: string; name: string; n: number };
const rows: Row[] = [
  { id: "a", name: "Alpha", n: 2 },
  { id: "b", name: "Beta", n: 1 },
];
const columns: DataTableColumn<Row, "name" | "n">[] = [
  { id: "name", header: "Name", sortable: true, isRowHeader: true, cell: (r) => r.name },
  { id: "n", header: "Count", sortable: true, align: "right", cell: (r) => r.n },
];

describe("DataTable", () => {
  it("renders a captioned table with row headers and data-labels for the card layout", () => {
    render(<DataTable caption="Solvers" columns={columns} rows={rows} getRowKey={(r) => r.id} />);
    const table = screen.getByRole("table", { name: "Solvers" });
    expect(within(table).getAllByRole("rowheader").map((c) => c.textContent)).toEqual(["Alpha", "Beta"]);
    expect(within(table).getAllByRole("cell")[0]).toHaveAttribute("data-label", "Count");
  });

  it("exposes aria-sort on the primary sorted column only", () => {
    render(
      <DataTable
        caption="Solvers"
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        sorts={[{ key: "n", dir: "desc" }, { key: "name", dir: "asc" }]}
        onSort={() => {}}
      />,
    );
    const [nameHeader, countHeader] = screen.getAllByRole("columnheader");
    expect(countHeader).toHaveAttribute("aria-sort", "descending");
    expect(nameHeader).toHaveAttribute("aria-sort", "none");
  });

  it("requests single sort on click and multi sort on shift-click or Shift+Enter", () => {
    const onSort = vi.fn();
    render(<DataTable caption="Solvers" columns={columns} rows={rows} getRowKey={(r) => r.id} onSort={onSort} />);
    const button = screen.getByRole("button", { name: /Count/ });
    fireEvent.click(button);
    fireEvent.click(button, { shiftKey: true });
    fireEvent.keyDown(button, { key: "Enter", shiftKey: true });
    expect(onSort.mock.calls).toEqual([
      ["n", false],
      ["n", true],
      ["n", true],
    ]);
  });
});
