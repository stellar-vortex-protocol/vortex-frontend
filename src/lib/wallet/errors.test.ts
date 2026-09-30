import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizeWalletError,
  WalletError,
  withWalletTimeout,
  type WalletErrorKind,
} from "./errors";

// Raw failure shapes seen from Freighter across versions: thrown strings
// (v1/v2), thrown Errors, and `{ error }` result objects (v3+).
const FIXTURES: ReadonlyArray<[unknown, WalletErrorKind]> = [
  ["User declined access", "user-rejected"],
  [new Error("User declined access"), "user-rejected"],
  [{ error: "The user rejected this request." }, "user-rejected"],
  [{ error: { code: -4, message: "User cancelled the request" } }, "user-rejected"],
  ["Freighter is locked", "locked"],
  [new Error("Please unlock Freighter"), "locked"],
  [new Error("Freighter is not installed"), "not-installed"],
  [{ error: "Network passphrase mismatch" }, "wrong-network"],
  [new TypeError("freighterApi.getAddress is not a function"), "unsupported-method"],
  [new Error("Request timed out"), "timeout"],
  [new Error("Something odd happened"), "unknown"],
  [undefined, "unknown"],
  [42, "unknown"],
];

describe("normalizeWalletError", () => {
  it.each(FIXTURES)("maps %j to %s", (raw, kind) => {
    const err = normalizeWalletError(raw);
    expect(err).toBeInstanceOf(WalletError);
    expect(err.kind).toBe(kind);
    expect(err.cause).toBe(raw);
  });

  it("passes an existing WalletError through unchanged", () => {
    const original = new WalletError("locked");
    expect(normalizeWalletError(original)).toBe(original);
  });

  it("never exposes raw extension text in the message", () => {
    const err = normalizeWalletError(new Error("declined for GABC...XYZ"));
    expect(err.message).toBe("wallet:user-rejected");
  });
});

describe("withWalletTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("rejects with a timeout WalletError when the extension never responds", async () => {
    vi.useFakeTimers();
    const pending = withWalletTimeout(new Promise<never>(() => {}), 1000);
    vi.advanceTimersByTime(1000);
    await expect(pending).rejects.toMatchObject({ kind: "timeout" });
  });

  it("resolves with the underlying value when it settles in time", async () => {
    await expect(withWalletTimeout(Promise.resolve("ok"), 1000)).resolves.toBe("ok");
  });
});
