import { sanitizeDisplayText } from "./textSafety";

/**
 * Domain-backed solver identity (SEP-0001 stellar.toml).
 *
 * DISPLAY ONLY: an identity state must never be used to authorize anything —
 * it is derived from third-party content fetched at display time.
 */
export type SolverIdentityState = "verified" | "unverified" | "mismatch" | "unavailable";

/** Normalised response of `GET /api/verify-solver?domain=`. */
export type VerifySolverResponse = {
  domain: string;
  /** Unicode form of an IDN domain (equal to `domain` for ASCII domains). */
  domainUnicode: string;
  accounts: string[];
  orgName: string | null;
  orgUrl: string | null;
};

export type SolverIdentity = {
  state: SolverIdentityState;
  domain: string | null;
  domainUnicode: string | null;
  orgName: string | null;
};

export function evaluateSolverIdentity(
  address: string | null | undefined,
  domain: string | null | undefined,
  toml: VerifySolverResponse | null,
  failed: boolean,
): SolverIdentity {
  if (!address || !domain) {
    return { state: "unverified", domain: null, domainUnicode: null, orgName: null };
  }
  if (failed || !toml) {
    return { state: "unavailable", domain, domainUnicode: null, orgName: null };
  }
  const listed = toml.accounts.includes(address);
  return {
    state: listed ? "verified" : "mismatch",
    domain: toml.domain,
    domainUnicode: toml.domainUnicode,
    // Org name is third-party text: strip spoofing characters before display.
    orgName: listed && toml.orgName ? sanitizeDisplayText(toml.orgName) : null,
  };
}
