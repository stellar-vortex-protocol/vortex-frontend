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
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
  });

  afterEach(() => {
    useWalletStore.setState(initialState, true);
    vi.unstubAllEnvs();
  });

  it("starts disconnected with no address or network", () => {
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.network).toBeNull();
    expect(state.error).toBeNull();
    expect(state.networkMismatch).toBe(false);
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
    expect(state.lastKnownAddress).toBe("GABC123");
    expect(state.network).toBe("TESTNET");
    expect(state.wasSessionCleared).toBe(false);
    expect(state.error).toBeNull();
    expect(state.networkMismatch).toBe(false);
  });

  // ── Issue #1: network mismatch ───────────────────────────────────────────

  it("sets networkMismatch when the wallet network differs from NEXT_PUBLIC_NETWORK", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABC123");
    // Freighter reports MAINNET but the app expects TESTNET
    getNetworkMock.mockResolvedValue("MAINNET");

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe("GABC123");
    expect(state.networkMismatch).toBe(true);
    expect(state.error).toBeNull();
  });

  it("does not set networkMismatch when networks match (case-insensitive)", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABC123");
    getNetworkMock.mockResolvedValue("TESTNET");

    await useWalletStore.getState().connect();

    expect(useWalletStore.getState().networkMismatch).toBe(false);
  });

  it("sets networkMismatch on hydrate when the restored network differs", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    useWalletStore.setState({ isConnected: true, address: "GOLD123", network: "MAINNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(true);
    getPublicKeyMock.mockResolvedValue("GOLD123");
    // Freighter still reports MAINNET
    getNetworkMock.mockResolvedValue("MAINNET");

    await useWalletStore.getState().hydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.networkMismatch).toBe(true);
  });

  it("clears networkMismatch on disconnect", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue("GABC123");
    getNetworkMock.mockResolvedValue("MAINNET");
    await useWalletStore.getState().connect();
    expect(useWalletStore.getState().networkMismatch).toBe(true);

    useWalletStore.getState().disconnect();

    expect(useWalletStore.getState().networkMismatch).toBe(false);
  });

  // ── Pre-existing behaviour (regression guard) ────────────────────────────

  it("sets an error and stays disconnected when Freighter is not installed", async () => {
    isConnectedMock.mockResolvedValue(false);

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.isConnecting).toBe(false);
    expect(state.address).toBeNull();
    expect(state.error).toMatch(/not installed/i);
    expect(state.errorKey).toBe("wallet.error.freighterUnavailable");
  });

  // ── Issue #2: not-installed ──────────────────────────────────────────────

  it("sets notInstalled=true and a specific error when Freighter is not installed", async () => {
    isConnectedMock.mockResolvedValue(false);

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.notInstalled).toBe(true);
    expect(state.isConnected).toBe(false);
    expect(state.error).toMatch(/not installed/i);
  });

  it("does NOT set notInstalled for a generic requestAccess rejection", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockRejectedValue(new Error("User declined access"));

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.notInstalled).toBe(false);
    expect(state.error).toBe("User declined access");
  });  it("sets an error when requestAccess rejects", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockRejectedValue(new Error("User declined access"));

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.error).toBe("User declined access");
    expect(state.errorKey).toBeNull();
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
    expect(state.networkMismatch).toBe(false);
  });

  it("hydrate() clears a stale session the extension no longer allows", async () => {
    useWalletStore.setState({ isConnected: true, address: "GOLD123", network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(false);

    await useWalletStore.getState().hydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.lastKnownAddress).toBe("GOLD123");
    expect(state.wasSessionCleared).toBe(true);
  });
});
