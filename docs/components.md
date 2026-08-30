# Shared Component Usage

Short usage docs for the components under `src/components/` that other
contributors are most likely to reuse. Keep these in sync with the actual props
if they change.

## `IntentStatusBadge`

[`src/components/IntentStatusBadge.tsx`](../src/components/IntentStatusBadge.tsx)

Renders a pill badge for an intent's lifecycle status, with a distinct icon per
status (not just color) so it doesn't rely on color alone to differentiate.

```tsx
import { IntentStatusBadge } from "@/components/IntentStatusBadge";

<IntentStatusBadge status="filled" />
```

**Props**

| prop     | type           | required | notes                                            |
| -------- | -------------- | -------- | ------------------------------------------------- |
| `status` | `IntentStatus` | yes      | one of `"pending" \| "accepted" \| "filled" \| "failed"` (see `src/lib/types`) |

No other configuration — styling and icon are derived entirely from `status` via
the internal `STATUS_STYLES` / `STATUS_ICONS` maps. To support a new status,
add an entry to both maps and to the `IntentStatus` type.

## `ToastViewport`

[`src/components/ToastViewport.tsx`](../src/components/ToastViewport.tsx)

Fixed-position (bottom-right) container that renders the current toast queue
from [`useToastStore`](../src/store/toast.ts) and handles dismissal. See
[`docs/toast-system.md`](./toast-system.md) for the full API on how to push
toasts.

```tsx
import { ToastViewport } from "@/components/ToastViewport";

<ToastViewport />
```

**Props**: none. Mount it once, near the root of the tree — it's already mounted
in [`src/app/layout.tsx`](../src/app/layout.tsx), so you should not need to mount
it again in a page or feature component. It renders `null` when there are no
active toasts.

## `ConnectWalletButton`

[`src/components/ConnectWalletButton.tsx`](../src/components/ConnectWalletButton.tsx)

Self-contained wallet connect/disconnect button. Reads and drives
[`useWalletStore`](../src/store/wallet.ts) directly — no props are needed to wire
it up to wallet state.

```tsx
import { ConnectWalletButton } from "@/components/ConnectWalletButton";

<ConnectWalletButton />
<ConnectWalletButton compact />
```

**Props**

| prop      | type      | required | default | notes                                                                 |
| --------- | --------- | -------- | ------- | ---------------------------------------------------------------------- |
| `compact` | `boolean` | no       | `false` | tighter padding/layout for constrained spaces (e.g. mobile nav/header) |

**Behavior**

- Not connected: shows "Connect Freighter" (or "Retry Connection" if a previous
  attempt errored, with the error message as the `title` tooltip). Disabled with
  a "Connecting..." label while `isConnecting`.
- Connected: shows the truncated address, swapping to "Disconnect" on hover/focus.
- On a failed `connect()` call, it also pushes an error toast via
  [`useToastStore`](../src/store/toast.ts) — you don't need to handle connection
  errors yourself when using this component.

## `CommandPalette`

[`src/components/CommandPalette.tsx`](../src/components/CommandPalette.tsx)

Global `Cmd/Ctrl+K` command palette for keyboard-driven navigation. Mounted once
in [`src/app/layout.tsx`](../src/app/layout.tsx) so the shortcut works on every
route — you do not render it yourself.

```tsx
import { CommandPalette } from "@/components/CommandPalette";

<CommandPalette />
```

**Props**

None. State (open/closed, query, active option) is entirely internal.

**Behavior**

- `Cmd/Ctrl+K` toggles the palette open/closed from anywhere. `Escape` or a
  click on the backdrop closes it.
- Lists the four top-level routes (`/`, `/explore`, `/solve`, `/my-intents`),
  filtered by the typed query against each route's label/path.
- If the query is a valid Stellar public key it offers a direct jump to
  `/solve/[address]`; otherwise a whitespace-free token that matches no route is
  offered as an `/explore/[id]` lookup.
- Fully keyboard-operable: `ArrowUp`/`ArrowDown` move the active option (wrapping),
  `Enter` activates it, following the WAI-ARIA combobox/listbox pattern
  (`role="combobox"` input + `role="listbox"` with `aria-activedescendant`).
- On activate it calls `router.push(href)` and restores focus to the element that
  was focused before the palette opened.
