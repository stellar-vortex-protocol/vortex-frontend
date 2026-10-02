# Components

This document describes the shared UI components used across the application.

## Charts (`src/components/charts/*`)

A small, dependency-free toolkit of accessible SVG chart primitives. All
components are typed generics, use Tailwind palette tokens (light + dark), and
share consistent scales, tooltips, legends, responsive sizing, reduced-motion
support, and accessible alternatives.

### Available components

| Component | Description |
| --- | --- |
| `LineChart` | Line series with focusable, arrow-key navigable data points. |
| `AreaChart` | Filled area series built on the same scale helpers as `LineChart`. |
| `BarChart` | Band-scaled bars with pattern/marker supplements to colour. |
| `DonutChart` | Categorical donut with a legend and per-slice markers. |
| `Sparkline` | Compact inline trend line for dense layouts. |
| `Legend` | Shared legend that pairs each series with a colour **and** a pattern/marker. |
| `ChartTooltip` | Tooltip surface announced through an `aria-live` region. |

### Accessibility

- **Keyboard:** every data point is focusable and navigable with the arrow
  keys. The active point's tooltip content is announced through an `aria-live`
  region.
- **Data-table fallback:** each chart exposes a "View as table" toggle that
  renders the underlying data as an accessible `<table>`.
- **Text summary:** each chart renders a short text summary referenced by
  `aria-describedby`.
- **Non-colour encodings:** patterns and markers supplement colour so states
  are distinguishable without relying on colour alone (WCAG 1.4.1). Colours
  meet 3:1 contrast against both the light and dark palettes.

### Responsiveness and data handling

- Charts measure their container with `ResizeObserver` and are SSR-safe.
- Empty, single-point, and very large series (up to 10k points) are supported;
  large series are downsampled with the LTTB algorithm.
- Scale helpers (linear, time, band) are pure functions, separated from
  rendering for testability.

### Usage

```tsx
import { LineChart, Legend } from "@/components/charts";

<LineChart
  data={series}
  xAccessor={(d) => d.date}
  yAccessor={(d) => d.value}
  ariaLabel="Volume over time"
/>
```

See `src/lib/analytics.ts` (`getStatusChartColors`) for the shared status
palette, which pairs each state with a distinct pattern/marker in addition to
its colour.
