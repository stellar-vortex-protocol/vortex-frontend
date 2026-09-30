# Wallet adapters

Wallet integrations implement `WalletAdapter` in `src/lib/wallet/types.ts` and are registered in `src/lib/wallet/index.ts`.

Adapters must expose connect, disconnect, address, network and transaction signing. Signing always receives the configured network; adapters should throw `WalletAdapterError` with `NETWORK_UNSUPPORTED` when they cannot sign that network. Never persist signed payloads or secret material. Add an install URL and capability flags to the registry, then exercise the adapter contract with a fake wallet in tests.
