"use client";

import { useWalletStore } from "@/store/wallet";
import { useIntentStatusWatcher } from "@/hooks/useIntentStatusWatcher";

// Mounted once app-wide (src/app/layout.tsx), alongside WalletHydrator and
// ToastViewport, so intent status-change alerts fire regardless of which
// page the user is on.
export function IntentStatusWatcher() {
  const address = useWalletStore((s) => s.address);
  useIntentStatusWatcher(address);
  return null;
}
