# Toast Notification System

Usage docs for [`src/store/toast.ts`](../src/store/toast.ts), the shared toast
notification store. If a feature needs to surface a transient success/error/info
message, use this rather than adding a new notification mechanism.

## Adding a toast

`useToastStore` is a plain [Zustand](https://github.com/pmndrs/zustand) store —
call its actions directly, no provider or context needed:

```ts
import { useToastStore } from "@/store/toast";

useToastStore.getState().addToast("Wallet connected", "success");
```

or, inside a component, via the hook:

```tsx
const addToast = useToastStore((s) => s.addToast);
addToast("Intent submitted");
```

`addToast(message, variant?)` returns the generated toast `id` and auto-dismisses
the toast after `TOAST_DURATION_MS` (4000ms). Call `dismissToast(id)` yourself
only if you need to dismiss early — see the manual close button in
[`ToastViewport`](../src/components/ToastViewport.tsx).

A real example, from [`ConnectWalletButton`](../src/components/ConnectWalletButton.tsx):

```ts
await connect();
const latestError = useWalletStore.getState().error;
if (latestError) {
  useToastStore.getState().addToast(latestError, "error");
}
```

## Supported types

The `variant` argument is a `ToastVariant`, defaulting to `"info"` when omitted:

| variant   | when to use                               |
| --------- | ----------------------------------------- |
| `success` | an action completed as expected           |
| `error`   | an action failed and the user should know |
| `info`    | neutral/default notification              |

Each variant maps to a style in `VARIANT_STYLES` inside
[`ToastViewport`](../src/components/ToastViewport.tsx) — add new visual treatment
there if you add a new variant, and extend the `ToastVariant` union in
[`src/store/toast.ts`](../src/store/toast.ts) first.

## Rendering

Toasts render via [`ToastViewport`](../src/components/ToastViewport.tsx), mounted
once in [`src/app/layout.tsx`](../src/app/layout.tsx). You don't need to render
anything yourself — just call `addToast` and the fixed-position viewport
(bottom-right) picks it up.

## Notes

- The store is **not** persisted — toasts are intentionally ephemeral and do not
  survive a reload.
- `id` is generated with `crypto.randomUUID()`; don't rely on it being
  human-readable or sequential.

## Notification preferences (#446)

Status-change alerts from `useIntentStatusWatcher` are routed through a pure
decision function, `decideChannels()` in `src/lib/notifications/dispatcher.ts`,
using preferences from `src/store/notificationPreferences.ts` (persisted to
`localStorage` under `vortex-notification-prefs`, schema version 1 - unknown
versions reset to defaults).

| Preference | Default | Notes |
| --- | --- | --- |
| Per-status (`accepted`, `filled`, `failed`) | on | `pending` never notifies |
| In-app toast | on | |
| Browser notification | off | Permission is requested only from the settings checkbox (user gesture) |
| Sound | off | Short WebAudio chime; muted during quiet hours |
| Show details | off | When off, notification bodies show only a short intent id and status - no amounts/tokens/addresses |
| Quiet hours | none | `HH:MM`-`HH:MM` local, may wrap midnight; mutes browser + sound |
| Batching window | 1 s | Transitions within the window are grouped into one alert |

Rules:

- **Visible tab:** toast (+ sound) only - never a duplicate browser notification.
- **Hidden tab:** browser notification if enabled, permission is `granted`, and
  this tab is the leader; otherwise the toast is queued as a fallback.
- **Multiple tabs:** a `BroadcastChannel` heartbeat election
  (`src/lib/notifications/leader.ts`) ensures only one tab raises browser
  notifications. Without `BroadcastChannel` every tab acts as leader.
- Denied/unsupported permission disables the browser checkbox with an
  explanatory hint. Service-worker push is out of scope.

Table tests live in `src/lib/notifications/dispatcher.test.ts`. Settings UI:
`src/components/NotificationSettings.tsx` (inside `SettingsPanel`).
