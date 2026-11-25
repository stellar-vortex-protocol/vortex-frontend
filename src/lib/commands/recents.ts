import { getRegisteredCommandIds } from "./registry";
import { STORAGE_KEYS } from "../storage";
import { storage } from "../storage";

const MAX_RECENTS = 5;

function readStored(): string[] {
  const raw = storage.get<string[]>(STORAGE_KEYS.commandRecents);
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string");
}

/**
 * Returns recently used command ids that are still present in the registry.
 * Stored entries are never deleted, so a command that returns later is remembered.
 */
export function getRecentCommandIds(): string[] {
  const registered = getRegisteredCommandIds();
  return readStored().filter((id) => registered.has(id));
}

/** Records a command id as recently used. */
export function recordRecentCommand(id: string): void {
  const next = [id, ...readStored().filter((existing) => existing !== id)].slice(0, MAX_RECENTS);
  storage.set(STORAGE_KEYS.commandRecents, next);
}
