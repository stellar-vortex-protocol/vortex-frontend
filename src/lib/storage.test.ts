import { describe, it, expect, beforeEach } from "vitest";
import {
  STORAGE_KEYS,
  __resetStorageForTests,
  clearAll,
  clearKey,
  describeKey,
  enforceRetention,
  exportData,
  isPrivateMode,
  listEntries,
  setPrivateMode,
  storage,
} from "./storage";

const DAY = 24 * 60 * 60 * 1000;

describe("storage facade", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    __resetStorageForTests();
  });

  it("round-trips values and records last-updated metadata", () => {
    expect(storage.setItem(STORAGE_KEYS.motionPreference.key, "reduce")).toBe(true);
    expect(storage.getItem(STORAGE_KEYS.motionPreference.key)).toBe("reduce");
    const entry = listEntries().find((e) => e.key === STORAGE_KEYS.motionPreference.key);
    expect(entry?.updatedAt).toBeTypeOf("number");
    expect(entry?.def?.owner).toBe("src/components/SettingsPanel.tsx");
  });

  it("round-trips JSON and tolerates malformed values", () => {
    storage.setJSON(STORAGE_KEYS.recentChains.key, ["a"]);
    expect(storage.getJSON(STORAGE_KEYS.recentChains.key)).toEqual(["a"]);
    storage.setItem(STORAGE_KEYS.recentChains.key, "{bad");
    expect(storage.getJSON(STORAGE_KEYS.recentChains.key)).toBeNull();
  });

  it("resolves prefix keys and marks unknown app keys as legacy", () => {
    expect(describeKey("vortex:columns:intents")?.purpose).toBe("privacy.purpose.columns");
    localStorage.setItem("vortex-old-thing", "1");
    localStorage.setItem("unrelated", "1");
    const keys = listEntries().map((e) => [e.key, e.def]);
    expect(keys).toContainEqual(["vortex-old-thing", null]);
    expect(keys.find(([k]) => k === "unrelated")).toBeUndefined();
  });

  it("purges values older than their retention", () => {
    storage.setItem(STORAGE_KEYS.recentChains.key, "[]");
    storage.setItem(STORAGE_KEYS.motionPreference.key, "reduce");
    const purged = enforceRetention(Date.now() + 31 * DAY);
    expect(purged).toEqual([STORAGE_KEYS.recentChains.key]);
    expect(storage.getItem(STORAGE_KEYS.motionPreference.key)).toBe("reduce");
  });

  it("private mode keeps personal data in sessionStorage only", () => {
    storage.setItem(STORAGE_KEYS.knownAddresses.key, "[]");
    setPrivateMode(true);
    expect(isPrivateMode()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEYS.knownAddresses.key)).toBeNull();

    storage.setItem(STORAGE_KEYS.solverRegistrationDraft.key, "{}");
    expect(localStorage.getItem(STORAGE_KEYS.solverRegistrationDraft.key)).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEYS.solverRegistrationDraft.key)).toBe("{}");

    storage.setItem(STORAGE_KEYS.motionPreference.key, "allow");
    expect(localStorage.getItem(STORAGE_KEYS.motionPreference.key)).toBe("allow");
  });

  it("exports app data without the metadata key", () => {
    storage.setJSON(STORAGE_KEYS.recentChains.key, ["x"]);
    const out = exportData();
    expect(out.entries[STORAGE_KEYS.recentChains.key]).toEqual(["x"]);
    expect(out.entries[STORAGE_KEYS.meta.key]).toBeUndefined();
  });

  it("clears one key or everything app-owned", () => {
    storage.setItem(STORAGE_KEYS.motionPreference.key, "reduce");
    storage.setItem(STORAGE_KEYS.onboardingSeen.key, "1");
    localStorage.setItem("unrelated", "keep");
    clearKey(STORAGE_KEYS.motionPreference.key);
    expect(storage.getItem(STORAGE_KEYS.motionPreference.key)).toBeNull();
    clearAll();
    expect(listEntries()).toEqual([]);
    expect(localStorage.getItem("unrelated")).toBe("keep");
  });
});
