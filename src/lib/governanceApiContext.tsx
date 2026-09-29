"use client";

/**
 * GovernanceApiContext — issue #469.
 *
 * Provides the active `GovernanceApi` adapter via React context so that
 * components are decoupled from the concrete implementation and tests can
 * inject fakes without monkey-patching module state.
 */

import { createContext, useContext, type ReactNode } from "react";
import { createGovernanceApi, type GovernanceApi } from "@/lib/governanceApi";

// Default to the adapter chosen by env config so the provider is optional in
// production code (pages don't need to wrap every tree).
const defaultApi = createGovernanceApi();

const GovernanceApiContext = createContext<GovernanceApi>(defaultApi);

export function GovernanceApiProvider({
  api,
  children,
}: {
  api?: GovernanceApi;
  children: ReactNode;
}) {
  return (
    <GovernanceApiContext.Provider value={api ?? defaultApi}>
      {children}
    </GovernanceApiContext.Provider>
  );
}

export function useGovernanceApi(): GovernanceApi {
  return useContext(GovernanceApiContext);
}
