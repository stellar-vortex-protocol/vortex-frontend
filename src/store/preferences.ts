import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
type Preferences = { confirmationUsd: number; idleMinutes: number; setConfirmationUsd: (value: number) => void; setIdleMinutes: (value: number) => void };
export const usePreferences = create<Preferences>()(persist((set) => ({ confirmationUsd: 1000, idleMinutes: 30, setConfirmationUsd: (confirmationUsd) => set({ confirmationUsd: Math.max(0, confirmationUsd) }), setIdleMinutes: (idleMinutes) => set({ idleMinutes: Math.max(0, idleMinutes) }) }), { name: "vortex-preferences-v1", storage: createJSONStorage(() => localStorage), version: 1 }));
export function requiresSwapConfirmation(usdValue: number | null | undefined, threshold: number) { return usdValue == null || threshold === 0 || usdValue >= threshold; }
