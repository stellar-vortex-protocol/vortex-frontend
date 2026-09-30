# Command palette

The palette (`Cmd/Ctrl+K`, [`CommandPalette.tsx`](../src/components/CommandPalette.tsx)) renders commands from a
module-level Zustand registry ([`src/lib/commands/registry.ts`](../src/lib/commands/registry.ts)).

- **Groups:** `Recent`, `Navigation`, `Wallet`, `Preferences`, `Solvers`. With an empty query only `Recent` and
  `Navigation` are listed; typing searches every visible command.
- **Ranking:** fuzzy subsequence match on the title (matched characters are highlighted) and keywords; prefixes
  and contiguous runs score higher, ties keep registration order.
- **`when()`** hides a command when it returns `false` (e.g. "Disconnect wallet" only while connected).
- **`dangerous: true`** requires a second Enter/click; the row reads "Press Enter again to confirm".
- **Recents:** the last 10 intents viewed on `/explore/[id]` (stored locally under `vortex-recent-intents`).
- The result count is announced via a polite live region; IME composition is ignored for navigation keys.

Built-ins live in [`BuiltinCommands.tsx`](../src/components/BuiltinCommands.tsx): connect/disconnect wallet, copy
address, switch language, reduce/enable motion (shares `vortex-motion-preference` with the settings panel), open
My Intents, and "View solver …" for up to 50 solvers from `useSolvers`.

## How to add a command

1. Build the command list in a client component, memoised so registration only reruns when inputs change.
2. Put every user-facing `title` through `t()` and add the keys to **both** `en.ts` and `es.ts`.
3. Call `useRegisterCommands(commands)`; commands are removed automatically on unmount.

```tsx
const { t } = useTranslation();
const commands = useMemo<CommandDefinition[]>(
  () => [
    {
      id: "explore-export-csv",
      title: t("commands.explore.exportCsv"),
      keywords: ["download", "csv"],
      group: "Navigation",
      when: () => rows.length > 0,
      run: exportCsv,
    },
  ],
  [t, rows.length, exportCsv],
);
useRegisterCommands(commands);
```

Outside React, `registerCommand(definition)` returns an unregister function. Ids must be unique; a later
registration with the same id replaces the earlier one.
