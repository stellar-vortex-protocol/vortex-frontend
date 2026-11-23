# Persisted State

This page explains how persisted state works in the app and how to store it safely.

## Overview

Persisted state is any data that must survive a page reload or a new session — for example, the selected wallet, user preferences, or cached feature flags. Persisted values are written to browser storage and rehydrated on startup.

## Storage facade and `STORAGE_KEYS`

Direct access to `localStorage` or `sessionStorage` is **lint-enforced** and will fail CI. All persisted state must go through the `storage` facade in [`src/lib/storage.ts`](../src/lib/storage.ts), and every key must be registered in `STORAGE_KEYS` in that same module.

Why:

- Keys are centralized so they can be audited, versioned, and migrated.
- The facade handles serialization, namespacing, and safe access (e.g. SSR / private-mode guards).
- The lint rule in [`.eslintrc.json`](../.eslintrc.json) (`no-restricted-globals` / `no-restricted-properties`) rejects direct `localStorage` / `sessionStorage` calls with a message pointing back to the facade.

### Correct pattern

1. Register the key in `STORAGE_KEYS` in `src/lib/storage.ts` (do not duplicate the module here — see the file for the full list).
2. Read and write through the `storage` facade.

```ts
import { STORAGE_KEYS, storage } from "@/lib/storage";

// Write
storage.set(STORAGE_KEYS.selectedWallet, walletId);

// Read
const walletId = storage.get<string>(STORAGE_KEYS.selectedWallet);
```

### What fails lint

```ts
// ❌ Rejected by the lint rule — use the storage facade instead.
localStorage.setItem("selectedWallet", walletId);
window.sessionStorage.getItem("selectedWallet");
```

If you need a new persisted value, add its key to `STORAGE_KEYS` in [`src/lib/storage.ts`](../src/lib/storage.ts) first, then use the facade. See that module for the exact API surface and existing keys.
