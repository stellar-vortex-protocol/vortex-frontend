import { evaluateOrigin, getTrustedOrigins } from "@/lib/config";
import { useWalletStore } from "@/store/wallet";

export class UntrustedOriginError extends Error {
  constructor(hostname: string) {
    super(
      `Signing is not allowed on untrusted origin "${hostname}". Please visit the canonical site to continue.`,
    );
    this.name = "UntrustedOriginError";
  }
}

/**
 * Precondition check before any wallet signing operation.
 *
 * Verifies that:
 *  1. The wallet is connected and has an address.
 *  2. The current origin is on the trusted list.
 *
 * Throws `UntrustedOriginError` when the origin is not trusted,
 * and a generic `Error` when the wallet is not connected.
 */
export function assertWalletReady(): { address: string; network: string } {
  const state = useWalletStore.getState();

  if (!state.isConnected || !state.address) {
    throw new Error(state.error ?? "Connect a wallet to continue.");
  }

  const hostname = window.location.hostname;
  const protocol = window.location.protocol.replace(":", "");
  const trusted = getTrustedOrigins();
  const trustLevel = evaluateOrigin(hostname, protocol, trusted);

  if (trustLevel === "untrusted") {
    throw new UntrustedOriginError(hostname);
  }

  return { address: state.address, network: state.network ?? "" };
}
