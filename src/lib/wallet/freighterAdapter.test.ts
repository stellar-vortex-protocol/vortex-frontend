import { describe, expect, it, vi } from "vitest";

const freighterApiMock = vi.hoisted(() => ({
  isConnected: vi.fn(),
  isAllowed: vi.fn(),
  requestAccess: vi.fn(),
  getPublicKey: vi.fn(),
  getNetwork: vi.fn(),
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/freighter-api", () => ({ default: freighterApiMock }));

import { freighterAdapter } from "./freighterAdapter";

describe("freighterAdapter", () => {
  it("delegates connect() to freighter's requestAccess()", async () => {
    freighterApiMock.requestAccess.mockResolvedValue("GABC123");
    await expect(freighterAdapter.connect()).resolves.toBe("GABC123");
  });

  it("delegates isConnected(), isAllowed(), getPublicKey(), and getNetwork()", async () => {
    freighterApiMock.isConnected.mockResolvedValue(true);
    freighterApiMock.isAllowed.mockResolvedValue(true);
    freighterApiMock.getPublicKey.mockResolvedValue("GABC123");
    freighterApiMock.getNetwork.mockResolvedValue("TESTNET");

    await expect(freighterAdapter.isConnected()).resolves.toBe(true);
    await expect(freighterAdapter.isAllowed()).resolves.toBe(true);
    await expect(freighterAdapter.getPublicKey()).resolves.toBe("GABC123");
    await expect(freighterAdapter.getNetwork()).resolves.toBe("TESTNET");
  });

  it("delegates signTransaction() with the xdr and options", async () => {
    freighterApiMock.signTransaction.mockResolvedValue("SIGNED_XDR");
    await expect(freighterAdapter.signTransaction("XDR", { network: "TESTNET" })).resolves.toBe("SIGNED_XDR");
    expect(freighterApiMock.signTransaction).toHaveBeenCalledWith("XDR", { network: "TESTNET" });
  });

  it("disconnect() resolves without calling freighter (no programmatic disconnect exists)", async () => {
    await expect(freighterAdapter.disconnect()).resolves.toBeUndefined();
  });
});
