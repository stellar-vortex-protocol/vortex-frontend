# Wallet adapters

Wallet integrations implement `WalletAdapter` in `src/lib/wallet/types.ts` and are registered in `src/lib/wallet/index.ts`.

Adapters must expose connect, disconnect, address, network and transaction signing. Signing always receives the configured network; adapters should throw `WalletAdapterError` with `NETWORK_UNSUPPORTED` when they cannot sign that network. Never persist signed payloads or secret material. Add an install URL and capability flags to the registry, then exercise the adapter contract with a fake wallet in tests.

## Reconnect flow

Reconnection is driven by the hydration entry point, not by the adapter itself. On load, hydration reads the persisted wallet selection, asks the registered adapter to reconnect, and only then restores the address and network. Adapters do not auto-reconnect on their own; they expose the connect/disconnect surface and hydration decides when to call it. See [wallet-hydration.md](./wallet-hydration.md) for the full sequence and the persisted-state contract.

## Message signing never uses a raw `Keypair`

Production message signing always goes through `buildAuthTransaction` plus a wallet adapter's `signTransaction`; the app never constructs a `Keypair` from a secret. The former `signComment(keypair, payload)` helper in `signMessage.ts` was audited (2026-10-22): it had no call sites outside its own module (`ProposalDetailClient` only imports `signCommentMessage` and `verifySignedComment`), so it was dead code and has been removed. `Keypair.fromPublicKey` remains for signature verification only, which handles no secret material.
