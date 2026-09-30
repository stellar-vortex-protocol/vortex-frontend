import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";
import { createSyncedPersist, isSyncMessage, runMigrations } from "./persist";
import { WALLET_MIGRATIONS, WALLET_PERSIST_VERSION } from "@/store/wallet";

// In-memory BroadcastChannel: delivers to every *other* instance with the same name.
class MockChannel {
  static instances: MockChannel[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  constructor(public name: string) {
    MockChannel.instances.push(this);
  }
  postMessage(data: unknown) {
    for (const other of MockChannel.instances) {
      if (other !== this && other.name === this.name) {
        other.onmessage?.({ data } as MessageEvent);
      }
    }
  }
  close() {
    MockChannel.instances = MockChannel.instances.filter((c) => c !== this);
  }
}

type Prefs = { motion: "full" | "reduced"; count: number; bump: () => void; setMotion: (m: Prefs["motion"]) => void };
type PersistedPrefs = { motion: "full" | "reduced" };

const isPrefs = (v: unknown): v is PersistedPrefs =>
  typeof v === "object" && v !== null && ((v as PersistedPrefs).motion === "full" || (v as PersistedPrefs).motion === "reduced");

function makeStore(opts: { version?: number; migrations?: ((s: unknown) => unknown)[]; onReset?: () => void } = {}) {
  return create<Prefs>()(
    createSyncedPersist(
      (set) => ({
        motion: "full",
        count: 0,
        bump: () => set((s) => ({ count: s.count + 1 })),
        setMotion: (motion) => set({ motion }),
      }),
      {
        name: "test-prefs",
        version: opts.version ?? 1,
        migrations: opts.migrations ?? [(s) => s],
        partialize: (s) => ({ motion: s.motion }),
        validate: isPrefs,
        ...(opts.onReset ? { onReset: opts.onReset } : {}),
      },
    ),
  );
}

describe("runMigrations", () => {
  const steps = [(s: unknown) => ({ ...(s as object), a: 1 }), (s: unknown) => ({ ...(s as object), b: 2 })];

  it.each([
    [0, 2, { a: 1, b: 2 }],
    [1, 2, { b: 2 }],
    [2, 2, {}],
  ])("migrates v%i -> v%i", (from, to, expected) => {
    expect(runMigrations({}, from, to, steps)).toEqual(expected);
  });

  it.each([
    ["newer than current", 3],
    ["negative", -1],
    ["non-integer", 1.5],
  ])("rejects a %s version", (_label, from) => {
    expect(runMigrations({}, from, 2, steps)).toBeNull();
  });

  it("rejects a gap in the migration list", () => {
    expect(runMigrations({}, 0, 3, steps)).toBeNull();
  });
});

describe("wallet migrations", () => {
  it("has one step per shipped version", () => {
    expect(WALLET_MIGRATIONS).toHaveLength(WALLET_PERSIST_VERSION);
  });

  it("v0 -> v1 backfills lastKnownAddress from address", () => {
    const v0 = { address: "GABC", network: "TESTNET", isConnected: true };
    expect(runMigrations(v0, 0, 1, WALLET_MIGRATIONS)).toEqual({ ...v0, lastKnownAddress: "GABC" });
  });

  it("v0 -> v1 keeps an existing lastKnownAddress and tolerates garbage", () => {
    expect(runMigrations({ address: null, lastKnownAddress: "GX" }, 0, 1, WALLET_MIGRATIONS)).toMatchObject({
      lastKnownAddress: "GX",
    });
    expect(runMigrations(null, 0, 1, WALLET_MIGRATIONS)).toEqual({ lastKnownAddress: null });
  });
});

describe("createSyncedPersist", () => {
  beforeEach(() => {
    localStorage.clear();
    MockChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", MockChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("propagates persisted-slice changes to another tab", () => {
    const tabA = makeStore();
    const tabB = makeStore();
    tabA.getState().setMotion("reduced");
    expect(tabB.getState().motion).toBe("reduced");
  });

  it("does not broadcast changes outside the persisted slice", () => {
    const tabA = makeStore();
    const tabB = makeStore();
    tabA.getState().bump();
    expect(tabA.getState().count).toBe(1);
    expect(tabB.getState().count).toBe(0);
  });

  it("does not echo a remote change back (loop protection)", () => {
    const tabA = makeStore();
    makeStore();
    const post = vi.spyOn(MockChannel.prototype, "postMessage");
    tabA.getState().setMotion("reduced");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("ignores messages from other versions and invalid payloads", () => {
    const tabA = makeStore();
    const raw = new MockChannel("vortex-sync:test-prefs");
    raw.postMessage({ tabId: "x", version: 99, state: { motion: "reduced" } });
    raw.postMessage({ tabId: "x", version: 1, state: { motion: "sideways" } });
    raw.postMessage("garbage");
    expect(tabA.getState().motion).toBe("full");
  });

  it("migrates an older persisted payload on rehydrate", () => {
    localStorage.setItem("test-prefs", JSON.stringify({ state: { legacy: true }, version: 0 }));
    const store = makeStore({ migrations: [() => ({ motion: "reduced" })] });
    expect(store.getState().motion).toBe("reduced");
  });

  it("resets and notifies once for an unknown (newer) version", () => {
    localStorage.setItem("test-prefs", JSON.stringify({ state: { motion: "reduced" }, version: 7 }));
    const onReset = vi.fn();
    const store = makeStore({ onReset });
    expect(store.getState().motion).toBe("full");
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledWith("unknown-version");
  });

  it("resets when the stored payload fails validation", () => {
    localStorage.setItem("test-prefs", JSON.stringify({ state: { motion: 42 }, version: 1 }));
    const onReset = vi.fn();
    const store = makeStore({ onReset });
    expect(store.getState().motion).toBe("full");
    expect(onReset).toHaveBeenCalledWith("invalid");
  });

  it("falls back to the storage event without BroadcastChannel", () => {
    vi.stubGlobal("BroadcastChannel", undefined);
    const store = makeStore();
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "test-prefs",
        newValue: JSON.stringify({ state: { motion: "reduced" }, version: 1 }),
      }),
    );
    expect(store.getState().motion).toBe("reduced");
  });

  it("keeps working when writes throw (quota exceeded)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation((key) => {
      if (key === "test-prefs") throw new DOMException("full", "QuotaExceededError");
    });
    const store = makeStore();
    expect(() => store.getState().setMotion("reduced")).not.toThrow();
    expect(store.getState().motion).toBe("reduced");
    setItem.mockRestore();
  });
});

describe("isSyncMessage", () => {
  it.each([
    [{ tabId: "a", version: 1, state: {} }, true],
    [{ tabId: "a", version: "1", state: {} }, false],
    [{ version: 1, state: {} }, false],
    [null, false],
  ])("%j -> %s", (value, expected) => {
    expect(isSyncMessage(value)).toBe(expected);
  });
});
