import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { isConnectedMock, requestAccessMock, getNetworkMock, isAllowedMock, getPublicKeyMock } = vi.hoisted(() => ({
  isConnectedMock: vi.fn(),
  requestAccessMock: vi.fn(),
  getNetworkMock: vi.fn(),
  isAllowedMock: vi.fn(),
  getPublicKeyMock: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({
  default: {
    isConnected: isConnectedMock,
    requestAccess: requestAccessMock,
    getNetwork: getNetworkMock,
    isAllowed: isAllowedMock,
    getPublicKey: getPublicKeyMock,
  },
}));

import { useWalletStore } from "./wallet";

const initialState = useWalletStore.getState();

describe("useWalletStore", () => {
  beforeEach(() => {
    useWalletStore.setState(initialState, true);
    vi.clearAllMocks();
  });

  afterEach(() => {
    useWalletStore.setState(initialState, true);
  });

  it("starts disconnected with no address or network", () => {
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.network).toBeNull();
    expect(state.error).toBeNull();
  });

  it("connects successfully and stores address + network", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABC123");
    getNetworkMock.mockResolvedValue("TESTNET");

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.isConnecting).toBe(false);
    expect(state.address).toBe("GABC123");
    expect(state.network).toBe("TESTNET");
    expect(state.error).toBeNull();
  });

  it("sets an error and stays disconnected when Freighter is not installed", async () => {
    isConnectedMock.mockResolvedValue(false);

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.address).toBeNull();
    expect(state.error).toMatch(/not installed/i);
  });

  it("sets an error when requestAccess rejects", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockRejectedValue(new Error("User declined access"));

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.error).toBe("User declined access");
  });

  it("clears wallet state on disconnect", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABC123");
    getNetworkMock.mockResolvedValue("TESTNET");
    await useWalletStore.getState().connect();

    useWalletStore.getState().disconnect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.network).toBeNull();
  });

  it("hydrate() is a no-op when there is no persisted session", async () => {
    await useWalletStore.getState().hydrate();

    expect(isConnectedMock).not.toHaveBeenCalled();
    expect(useWalletStore.getState().isConnected).toBe(false);
  });

  it("hydrate() silently restores a session the extension still allows", async () => {
    useWalletStore.setState({ isConnected: true, address: "GOLD123", network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(true);
    getPublicKeyMock.mockResolvedValue("GOLD123");
    getNetworkMock.mockResolvedValue("TESTNET");

    await useWalletStore.getState().hydrate();

    expect(requestAccessMock).not.toHaveBeenCalled();
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe("GOLD123");
  });

  it("hydrate() clears a stale session the extension no longer allows", async () => {
    useWalletStore.setState({ isConnected: true, address: "GOLD123", network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(false);

    await useWalletStore.getState().hydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
  });
});
