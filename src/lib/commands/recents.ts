import { STORAGE_KEYS } from "@/lib/storage";
import { storage } from "@/lib/storage";
import { isRegisteredCommand } from "./registry";

const MAX_RECENTS = 8;

function readRaw(): string[] {
  const raw = storage.get<string[]>(STORAGE_KEYS.commandRecents);
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string");
}

/** Returns recent command ids, dropping any that no longer exist in the registry. */
export function getRecentCommandIds(): string[] {
  return readRaw().filter((id) => isRegisteredCommand(id));
}

/** Records a command id as most-recently used. Persisted format is unchanged. */
export function pushRecentCommandId(id: string): void {
  const next = [id, ...readRaw().filter((existing) => existing !== id)].slice(0, MAX_RECENTS);
  storage.set(STORAGE_KEYS.commandRecents, next);
}
