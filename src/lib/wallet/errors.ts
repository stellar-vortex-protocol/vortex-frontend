import { secureLogger } from "@/lib/secureLogging";

/**
 * Stable failure categories every wallet adapter (and the wallet store) maps
 * raw extension failures onto, so UI and hooks can react on `kind` instead of
 * string-matching extension messages.
 */
export type WalletErrorKind =
  | "not-installed"
  | "locked"
  | "user-rejected"
  | "wrong-network"
  | "unsupported-method"
  | "timeout"
  | "unknown";

export const WALLET_ERROR_KINDS: readonly WalletErrorKind[] = [
  "not-installed",
  "locked",
  "user-rejected",
  "wrong-network",
  "unsupported-method",
  "timeout",
  "unknown",
];

export class WalletError extends Error {
  readonly kind: WalletErrorKind;
  override readonly cause?: unknown;

  constructor(kind: WalletErrorKind, cause?: unknown) {
    // The message is the kind only: raw extension text may carry internals or
    // addresses and must never reach the UI. Keep it on `cause` for diagnostics.
    super(`wallet:${kind}`);
    this.name = "WalletError";
    this.kind = kind;
    this.cause = cause;
  }
}

export function isWalletError(err: unknown): err is WalletError {
  return err instanceof WalletError;
}

/** Default time to wait for the extension before giving up. */
export const WALLET_TIMEOUT_MS = 60_000;

// Ordered: first match wins. Patterns cover Freighter's thrown strings (v1/v2),
// thrown Errors, and `{ error: string | { message } }` result objects (v3+).
const MESSAGE_PATTERNS: ReadonlyArray<[RegExp, WalletErrorKind]> = [
  [/not (installed|detected|available)|no freighter|freighter.*(missing|unavailable)/i, "not-installed"],
  [/declin|reject|denied|cancel+ed|refused/i, "user-rejected"],
  [/locked|unlock|log ?in|not logged/i, "locked"],
  [/network|passphrase/i, "wrong-network"],
  [/not (supported|implemented)|unsupported|is not a function/i, "unsupported-method"],
  [/time ?out|timed out/i, "timeout"],
];

function extractMessage(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw instanceof Error) return raw.message;
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    if ("error" in obj) return extractMessage(obj["error"]);
    if (typeof obj["message"] === "string") return obj["message"];
  }
  return "";
}

/**
 * Map any raw wallet failure (thrown string, Error, or `{ error }` object) to a
 * `WalletError`. Existing `WalletError`s pass through unchanged.
 */
export function normalizeWalletError(raw: unknown): WalletError {
  if (raw instanceof WalletError) return raw;
  const message = extractMessage(raw);
  const match = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
  const kind: WalletErrorKind = match ? match[1] : "unknown";
  secureLogger.warn("Wallet error normalized", { kind, message });
  return new WalletError(kind, raw);
}

/** Reject with a `timeout` WalletError if `promise` does not settle in time. */
export function withWalletTimeout<T>(
  promise: Promise<T>,
  ms: number = WALLET_TIMEOUT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WalletError("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
