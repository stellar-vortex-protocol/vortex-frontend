import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";

const { hydrateMock, syncFromStorageMock } = vi.hoisted(() => ({
  hydrateMock: vi.fn(),
  syncFromStorageMock: vi.fn(),
}));

vi.mock("@/store/wallet", () => ({
  PERSIST_KEY: "vortex-wallet",
  useWalletStore: {
    getState: () => ({ hydrate: hydrateMock, syncFromStorage: syncFromStorageMock }),
  },
}));

import { WalletHydrator } from "./WalletHydrator";

function fireStorage(key: string | null, newValue: string | null) {
  window.dispatchEvent(new StorageEvent("storage", { key: key ?? undefined, newValue }));
}

describe("WalletHydrator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("triggers a wallet session hydration on mount and renders nothing", () => {
    const { container } = render(<WalletHydrator />);
    expect(hydrateMock).toHaveBeenCalledTimes(1);
    expect(container).toBeEmptyDOMElement();
  });

  it("reconciles the store when another tab writes the persisted wallet key", () => {
    render(<WalletHydrator />);

    const persisted = { address: null, lastKnownAddress: "GABC", network: null, isConnected: false };
    fireStorage("vortex-wallet", JSON.stringify({ state: persisted, version: 0 }));

    expect(syncFromStorageMock).toHaveBeenCalledWith(persisted);
  });

  it("ignores storage events for other keys, key removal, and malformed JSON", () => {
    render(<WalletHydrator />);

    fireStorage("some-other-key", JSON.stringify({ state: {} }));
    fireStorage("vortex-wallet", null);
    fireStorage("vortex-wallet", "{not json");

    expect(syncFromStorageMock).not.toHaveBeenCalled();
  });

  it("removes the storage listener on unmount", () => {
    const { unmount } = render(<WalletHydrator />);
    unmount();

    fireStorage("vortex-wallet", JSON.stringify({ state: { isConnected: false } }));
    expect(syncFromStorageMock).not.toHaveBeenCalled();
  });
});
