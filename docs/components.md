# Components

Shared UI components are documented in Storybook, not in this file. Component
docs are generated from TSDoc and prop types through Storybook's `autodocs`
tag, so they track the code. Components without a story are not yet covered;
see `npm run check:stories`.

## Browsing

```sh
npm run build:storybook   # outputs storybook-static/
npx http-server storybook-static --port 6006
```

Open `http://127.0.0.1:6006` and pick a component under **Components** or
**Charts** in the sidebar. The toolbar switches theme, locale, and viewport.

## Authoring stories

- Stories live next to the component as `<Name>.stories.tsx` and use CSF3.
- Interaction tests go in a `play` function using `storybook/test`. They run
  under the Storybook test runner in CI (`npm run test:storybook`).
- Story files are excluded from the app build and from the strict
  `tsconfig.json`. They are typechecked with `npm run typecheck:storybook`.
- Run `npm run check:stories` to list shared components that still lack a
  story file.

## DataTable (`src/components/ui/DataTable.tsx`)

`DataTable` renders a typed, sortable table from a column definition array.
Each column may declare a `rowKey` accessor that returns a stable identifier
for the row it belongs to. When provided, `rowKey` is used for React keys so
selection and sorting follow the row when data reorders. Callers that omit
`rowKey` still render, falling back to the array index as the key.

```tsx
const columns: DataTableColumn<Request>[] = [
  { header: 'ID', rowKey: (row) => row.id, cell: (row) => row.id },
  { header: 'Title', cell: (row) => row.title },
];
```

## Charts (`src/components/charts/*`)

The chart primitives (`LineChart`, `AreaChart`, `BarChart`, `DonutChart`,
`Sparkline`, `Legend`, `ChartTooltip`) are documented under **Charts** in
Storybook. Their shared accessibility contract is:

- Every data point is keyboard-focusable and navigable with the arrow keys.
- Each chart offers a "View as table" fallback and a text summary referenced by
  `aria-describedby`.
- Patterns and markers supplement colour (WCAG 1.4.1), with 3:1 contrast in
  both palettes defined in `src/app/globals.css`.

The shared status palette lives in `src/lib/analytics.ts`
(`getStatusChartColors`).
