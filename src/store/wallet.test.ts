import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  isConnectedMock,
  requestAccessMock,
  getNetworkMock,
  isAllowedMock,
  getPublicKeyMock,
} = vi.hoisted(() => ({
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

import { PERSIST_KEY, useWalletStore } from "./wallet";

const initialState = useWalletStore.getState();
const VALID_STELLAR_ADDRESS = "GDW4UXK66PDDK4CDDUJGNPFZHBZDWAJNNUE5ZEQYN5S3DISNGXZIVAIV";

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
    requestAccessMock.mockResolvedValue(VALID_STELLAR_ADDRESS);
    getNetworkMock.mockResolvedValue("TESTNET");

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.isConnecting).toBe(false);
    expect(state.address).toBe(VALID_STELLAR_ADDRESS);
    expect(state.lastKnownAddress).toBe(VALID_STELLAR_ADDRESS);
    expect(state.network).toBe("TESTNET");
    expect(state.wasSessionCleared).toBe(false);
    expect(state.error).toBeNull();
    expect(state.networkMismatch).toBe(false);
  });

  // ── Issue #1: network mismatch ───────────────────────────────────────────

  it("sets networkMismatch when the wallet network differs from NEXT_PUBLIC_NETWORK", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue(VALID_STELLAR_ADDRESS);
    // Freighter reports MAINNET but the app expects TESTNET
    getNetworkMock.mockResolvedValue("MAINNET");

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(VALID_STELLAR_ADDRESS);
    expect(state.networkMismatch).toBe(true);
    expect(state.error).toBeNull();
  });

  it("does not set networkMismatch when networks match (case-insensitive)", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockResolvedValue(VALID_STELLAR_ADDRESS);
    getNetworkMock.mockResolvedValue("TESTNET");

    await useWalletStore.getState().connect();

    expect(useWalletStore.getState().networkMismatch).toBe(false);
  });

  it("sets networkMismatch on hydrate when the restored network differs", async () => {
    vi.stubEnv("NEXT_PUBLIC_NETWORK", "testnet");
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, network: "MAINNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(true);
    getPublicKeyMock.mockResolvedValue(VALID_STELLAR_ADDRESS);
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
    requestAccessMock.mockResolvedValue(VALID_STELLAR_ADDRESS);
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
    requestAccessMock.mockResolvedValue(VALID_STELLAR_ADDRESS);
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
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(true);
    getPublicKeyMock.mockResolvedValue(VALID_STELLAR_ADDRESS);
    getNetworkMock.mockResolvedValue("TESTNET");

    await useWalletStore.getState().hydrate();

    expect(requestAccessMock).not.toHaveBeenCalled();
    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(VALID_STELLAR_ADDRESS);
    expect(state.networkMismatch).toBe(false);
  });

  it("hydrate() clears a stale session the extension no longer allows", async () => {
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, lastKnownAddress: VALID_STELLAR_ADDRESS, network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(false);

    await useWalletStore.getState().hydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.lastKnownAddress).toBe(VALID_STELLAR_ADDRESS);
    expect(state.wasSessionCleared).toBe(true);
  });

  // ── Issue #302: multi-tab reconciliation ────────────────────────────────

  it("syncFromStorage() disconnects this tab when another tab disconnected", () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });

    useWalletStore.getState().syncFromStorage({
      address: null,
      lastKnownAddress: "GABC123",
      network: null,
      isConnected: false,
    });

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(isConnectedMock).not.toHaveBeenCalled();
  });

  it("syncFromStorage() re-verifies with the extension when another tab switched account", async () => {
    useWalletStore.setState({ isConnected: true, address: "GOLD123", network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(true);
    getPublicKeyMock.mockResolvedValue("GNEW456");
    getNetworkMock.mockResolvedValue("TESTNET");

    useWalletStore.getState().syncFromStorage({
      address: "GNEW456",
      lastKnownAddress: "GNEW456",
      network: "TESTNET",
      isConnected: true,
    });
    await Promise.resolve();
    await Promise.resolve();

    const state = useWalletStore.getState();
    expect(state.address).toBe("GNEW456");
    expect(state.isConnected).toBe(true);
    expect(getPublicKeyMock).toHaveBeenCalled();
  });

  it("syncFromStorage() is a no-op when already in sync (no reconciliation loop)", () => {
    useWalletStore.setState({ isConnected: true, address: "GABC123", network: "TESTNET" });

    useWalletStore.getState().syncFromStorage({
      address: "GABC123",
      lastKnownAddress: "GABC123",
      network: "TESTNET",
      isConnected: true,
    });

    expect(isConnectedMock).not.toHaveBeenCalled();
    expect(useWalletStore.getState().address).toBe("GABC123");
  });

  // ── Transitions documented in docs/wallet-hydration.md ──────────────────

  it("connect() uses the translated connectFailed key when the wallet rejects with a non-Error", async () => {
    isConnectedMock.mockResolvedValue(true);
    requestAccessMock.mockRejectedValue("opaque failure");

    await useWalletStore.getState().connect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.errorKey).toBe("wallet.error.connectFailed");
    expect(state.error).toBe("Failed to connect wallet.");
  });

  it("disconnect() flags the cleared session and keeps the last known address", async () => {
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, lastKnownAddress: VALID_STELLAR_ADDRESS });

    useWalletStore.getState().disconnect();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.wasSessionCleared).toBe(true);
    expect(state.lastKnownAddress).toBe(VALID_STELLAR_ADDRESS);
  });

  it("hydrate() clears the session, keeping the last address, when the extension is unreachable", async () => {
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, network: "TESTNET" });
    isConnectedMock.mockRejectedValue(new Error("extension removed"));

    await useWalletStore.getState().hydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    expect(state.lastKnownAddress).toBe(VALID_STELLAR_ADDRESS);
    expect(state.wasSessionCleared).toBe(true);
  });

  it("hydrate() does not overwrite a user-initiated connect that started meanwhile", async () => {
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, network: "TESTNET" });
    isConnectedMock.mockImplementation(async () => {
      // The user clicks Connect while hydrate is waiting on the extension.
      useWalletStore.setState({ isConnecting: true });
      return true;
    });
    isAllowedMock.mockResolvedValue(false);

    await useWalletStore.getState().hydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(VALID_STELLAR_ADDRESS);
    expect(state.wasSessionCleared).toBe(false);
  });

  it("checkForChanges() picks up an account and network switch made in the extension", async () => {
    const OTHER_ADDRESS = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(true);
    getPublicKeyMock.mockResolvedValue(OTHER_ADDRESS);
    getNetworkMock.mockResolvedValue("PUBLIC");

    await useWalletStore.getState().checkForChanges();

    const state = useWalletStore.getState();
    expect(state.address).toBe(OTHER_ADDRESS);
    expect(state.lastKnownAddress).toBe(OTHER_ADDRESS);
    expect(state.network).toBe("PUBLIC");
    expect(state.networkMismatch).toBe(true);
    expect(requestAccessMock).not.toHaveBeenCalled();
  });

  it("checkForChanges() leaves the session alone while the extension is locked", async () => {
    useWalletStore.setState({ isConnected: true, address: VALID_STELLAR_ADDRESS, network: "TESTNET" });
    isConnectedMock.mockResolvedValue(true);
    isAllowedMock.mockResolvedValue(false);

    await useWalletStore.getState().checkForChanges();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(VALID_STELLAR_ADDRESS);
  });

  it("ignores a corrupted persisted payload on rehydrate", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ state: { address: "not-a-stellar-key", isConnected: true }, version: 0 }),
    );

    await useWalletStore.persist.rehydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(false);
    expect(state.address).toBeNull();
    localStorage.removeItem(PERSIST_KEY);
  });

  it("restores a valid persisted payload on rehydrate", async () => {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        state: {
          address: VALID_STELLAR_ADDRESS,
          lastKnownAddress: VALID_STELLAR_ADDRESS,
          network: "TESTNET",
          isConnected: true,
        },
        version: 0,
      }),
    );

    await useWalletStore.persist.rehydrate();

    const state = useWalletStore.getState();
    expect(state.isConnected).toBe(true);
    expect(state.address).toBe(VALID_STELLAR_ADDRESS);
    localStorage.removeItem(PERSIST_KEY);
  });
});
