import { useEffect } from "react";
import { create } from "zustand";

export type CommandGroup = "Navigation" | "Wallet" | "Preferences" | "Recent" | "Solvers";

export const GROUP_ORDER: CommandGroup[] = ["Recent", "Navigation", "Wallet", "Preferences", "Solvers"];

export type CommandDefinition = {
  id: string;
  title: string;
  keywords?: string[];
  group: CommandGroup;
  /** Short right-aligned hint (route, shortcut, …). */
  hint?: string;
  /** Hide the command when this returns false (e.g. "Disconnect" while disconnected). */
  when?: () => boolean;
  /** Dangerous commands require a second Enter to confirm. */
  dangerous?: boolean;
  run: () => void | Promise<void>;
};

type RegistryState = {
  commands: Record<string, CommandDefinition>;
  register: (commands: CommandDefinition[]) => () => void;
};

export const useCommandRegistry = create<RegistryState>()((set) => ({
  commands: {},
  register: (commands) => {
    set((state) => {
      const next = { ...state.commands };
      for (const command of commands) next[command.id] = command;
      return { commands: next };
    });
    return () =>
      set((state) => {
        const next = { ...state.commands };
        // Only drop entries still owned by this registration.
        for (const command of commands) if (next[command.id] === command) delete next[command.id];
        return { commands: next };
      });
  },
}));

/** Registers commands outside React. Returns an unregister function. */
export function registerCommand(command: CommandDefinition): () => void {
  return useCommandRegistry.getState().register([command]);
}

/** Registers commands for the lifetime of the calling component. */
export function useRegisterCommands(commands: CommandDefinition[]): void {
  useEffect(() => useCommandRegistry.getState().register(commands), [commands]);
}
