"use client";

import { useId, useState } from "react";

export type BarDatum = { label: string; value: number | null };

type BarChartProps = {
  title: string;
  data: BarDatum[];
  formatValue?: (value: number) => string;
  /** Label of the value column in the accessible table fallback. */
  valueLabel: string;
  showTableLabel: string;
  hideTableLabel: string;
  emptyLabel: string;
  height?: number;
};

// Minimal SVG bar chart. The SVG is decorative; the data is always available
// to assistive tech through the table, which sighted users can toggle.
export function BarChart({
  title,
  data,
  formatValue = String,
  valueLabel,
  showTableLabel,
  hideTableLabel,
  emptyLabel,
  height = 64,
}: BarChartProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const values = data.map((d) => d.value ?? 0);
  const max = Math.max(...values, 0);
  const width = 280;
  const barW = data.length > 0 ? width / data.length : width;

  return (
    <figure className="space-y-2">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-vx-muted uppercase tracking-wide">{title}</span>
        <button
          type="button"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((v) => !v)}
          className="text-[10px] text-vx-sage hover:underline rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-vx-sage"
        >
          {showTable ? hideTableLabel : showTableLabel}
        </button>
      </figcaption>

      {max === 0 ? (
        <p className="text-xs text-vx-muted py-2">{emptyLabel}</p>
      ) : (
        <svg aria-hidden="true" viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
          {data.map((d, i) => {
            const h = ((d.value ?? 0) / max) * (height - 2);
            return (
              <rect
                key={d.label}
                x={i * barW + barW * 0.15}
                y={height - h}
                width={barW * 0.7}
                height={h}
                rx={1}
                fill="var(--color-vx-sage, #4ade80)"
              />
            );
          })}
        </svg>
      )}

      <table id={tableId} className={showTable ? "w-full text-xs" : "sr-only"}>
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left text-vx-muted font-normal" />
            <th scope="col" className="text-right text-vx-muted font-normal">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th scope="row" className="text-left font-normal num text-vx-muted">{d.label}</th>
              <td className="text-right num text-vx-text">{d.value === null ? "—" : formatValue(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
