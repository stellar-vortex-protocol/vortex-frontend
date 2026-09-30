/**
 * Locally stored set of addresses the user has legitimately interacted with
 * (own wallet, destinations used, solvers viewed). It is the reference set for
 * address-poisoning detection in `addressRisk.ts`. Stored on-device only via
 * the storage facade; purged after the retention in `STORAGE_KEYS`.
 */

import { STORAGE_KEYS, storage } from "./storage";

export type KnownAddressSource = "wallet" | "destination" | "solver";

export interface KnownAddress {
  address: string;
  source: KnownAddressSource;
  lastSeen: number;
}

export const MAX_KNOWN_ADDRESSES = 2000;

const KEY = STORAGE_KEYS.knownAddresses.key;

export function getKnownAddressRecords(): KnownAddress[] {
  const parsed = storage.getJSON<unknown>(KEY);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (e): e is KnownAddress =>
      !!e && typeof e === "object" && typeof (e as KnownAddress).address === "string",
  );
}

export function getKnownAddresses(): string[] {
  return getKnownAddressRecords().map((e) => e.address);
}

export function recordKnownAddress(address: string, source: KnownAddressSource): void {
  if (!address) return;
  const rest = getKnownAddressRecords().filter((e) => e.address !== address);
  const next = [{ address, source, lastSeen: Date.now() }, ...rest].slice(0, MAX_KNOWN_ADDRESSES);
  storage.setJSON(KEY, next);
}
