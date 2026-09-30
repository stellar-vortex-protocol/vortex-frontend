import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from "vitest";
import { Keypair, StrKey } from "@stellar/stellar-sdk";
import {
  REDACTED,
  createRedactor,
  createSecureLogger,
  redactSensitiveData,
  redactValue,
  truncateString,
} from "./secureLogging";

// Small seeded PRNG so the property tests are deterministic and reproducible.
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomBytes(rand: () => number, n: number): Buffer {
  return Buffer.from(Array.from({ length: n }, () => Math.floor(rand() * 256)));
}

function sensitiveSamples(rand: () => number): string[] {
  const kp = Keypair.random();
  const bytes32 = randomBytes(rand, 32);
  const words = ["abandon", "ability", "zebra", "wallet", "orbit", "cactus", "ladder", "mercy"];
  const mnemonic = (n: number) =>
    Array.from({ length: n }, () => words[Math.floor(rand() * words.length)]).join(" ");
  return [
    kp.publicKey(),
    kp.secret(),
    StrKey.encodeMed25519PublicKey(Buffer.concat([bytes32, randomBytes(rand, 8)])),
    StrKey.encodeContract(bytes32),
    StrKey.encodePreAuthTx(bytes32),
    StrKey.encodeSha256Hash(bytes32),
    StrKey.encodeSignedPayload(
      Buffer.concat([bytes32, Buffer.from([0, 0, 0, 4]), randomBytes(rand, 4)]),
    ),
    // XDR-ish envelope
    "AAAAAg" + randomBytes(rand, 96).toString("base64"),
    // Generic base64 blob
    randomBytes(rand, 80).toString("base64"),
    // JWT
    `eyJhbGciOiJIUzI1NiJ9.${Buffer.from('{"sub":"123456"}').toString("base64url")}.${randomBytes(rand, 32).toString("base64url")}`,
    // Long hex
    randomBytes(rand, 32).toString("hex"),
    mnemonic(12),
    mnemonic(24),
  ];
}

describe("secureLogging", () => {
  describe("redactSensitiveData", () => {
    it("redacts Stellar account ids", () => {
      expect(redactSensitiveData(Keypair.random().publicKey())).toBe(REDACTED);
    });

    it("redacts secret seeds even with an invalid checksum", () => {
      const key = "SBQWY2BOZX34ULNQG23RQ6F4YUSXHTWYTTE2XYGDWKIUZQVHAEDO74G";
      expect(redactSensitiveData(key)).toBe(REDACTED);
    });

    it("redacts XDR blobs", () => {
      const xdr =
        "AAAAAgAAAABgSvLU8OZaKKAx7BRgZQ5s76q5xOE1/lLPVMI6D/7hAAAAZABDcjYAAAAEAAAAAQAAAAAAAAAA/AAAA";
      expect(redactSensitiveData(xdr)).toContain(REDACTED);
    });

    it("handles objects with sensitive data", () => {
      const result = redactSensitiveData({
        address: Keypair.random().publicKey(),
        message: "Transfer complete",
      });
      expect(result).toContain(REDACTED);
      expect(result).toContain("Transfer complete");
    });

    it("handles null and undefined", () => {
      expect(redactSensitiveData(null)).toBe("null");
      expect(redactSensitiveData(undefined)).toBe("undefined");
    });

    it("redacts Bearer tokens and keeps the scheme", () => {
      expect(redactSensitiveData("Authorization: Bearer abc.def-123")).toBe(
        `Authorization: Bearer ${REDACTED}`,
      );
    });

    it("redacts strkeys inside URLs and query strings", () => {
      const pk = Keypair.random().publicKey();
      const out = redactSensitiveData(`https://x.test/account?id=${pk}&page=2`);
      expect(out).toBe(`https://x.test/account?id=${REDACTED}&page=2`);
    });

    it("does not redact 56-char uppercase strings that fail the checksum", () => {
      const fake = "G" + "A".repeat(55);
      expect(redactSensitiveData(fake)).toBe(fake);
    });

    it("leaves ordinary prose alone", () => {
      const prose = "the solver filled the intent and the user received their tokens from the pool";
      expect(redactSensitiveData(prose)).toBe(prose);
    });

    it("honours a configurable allowlist", () => {
      const intentId = "a".repeat(64);
      const redactor = createRedactor({ allowlist: [/[0-9a-f]{64}/] });
      expect(redactor.redactString(`intent ${intentId}`)).toBe(`intent ${intentId}`);
      expect(redactSensitiveData(intentId)).toBe(REDACTED);
    });
  });

  describe("redactValue (deep)", () => {
    it("preserves structure and primitive types", () => {
      const pk = Keypair.random().publicKey();
      const out = redactValue({ n: 1, ok: true, list: [pk, "x"], nested: { pk } });
      expect(out).toEqual({ n: 1, ok: true, list: [REDACTED, "x"], nested: { pk: REDACTED } });
    });

    it("handles circular references", () => {
      const a: Record<string, unknown> = { name: "a" };
      a["self"] = a;
      expect(redactValue(a)).toEqual({ name: "a", self: "[Circular]" });
    });

    it("sanitises Error message, stack and cause", () => {
      const secret = Keypair.random().secret();
      const err = new Error(`bad ${secret}`, { cause: new Error(`inner ${secret}`) });
      const out = JSON.stringify(redactValue(err));
      expect(out).not.toContain(secret);
      expect(out).toContain("inner");
    });

    it("redacts values of sensitive keys wholesale", () => {
      expect(redactValue({ password: "hunter2", signedXdr: "short" })).toEqual({
        password: REDACTED,
        signedXdr: REDACTED,
      });
    });

    it("never throws on hostile getters", () => {
      const hostile = {
        get boom() {
          throw new Error("nope");
        },
      };
      expect(() => redactValue(hostile)).not.toThrow();
    });

    it("bounds depth", () => {
      let deep: Record<string, unknown> = {};
      const root = deep;
      for (let i = 0; i < 50; i++) {
        deep["child"] = {};
        deep = deep["child"] as Record<string, unknown>;
      }
      expect(JSON.stringify(redactValue(root))).toContain("[MaxDepth]");
    });
  });

  describe("property / fuzz", () => {
    it("no known-sensitive sample survives redaction (200 seeded runs)", () => {
      for (let seed = 1; seed <= 200; seed++) {
        const rand = prng(seed);
        for (const sample of sensitiveSamples(rand)) {
          const wrapped = `prefix:[${sample}]:suffix`;
          const out = redactSensitiveData(wrapped);
          expect(out, `seed ${seed}: ${sample}`).not.toContain(sample);
          expect(out).toContain("prefix");
          expect(out).toContain("suffix");
        }
      }
    });

    it("benign strings under the thresholds are unchanged", () => {
      const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_:,.";
      for (let seed = 1; seed <= 500; seed++) {
        const rand = prng(seed);
        const len = Math.floor(rand() * 39);
        const str = Array.from({ length: len }, () => alphabet[Math.floor(rand() * alphabet.length)]).join("");
        expect(redactSensitiveData(str)).toBe(str);
      }
    });
  });

  describe("performance", () => {
    it("handles a 10 MB payload in bounded time via truncation", () => {
      const huge = "A1b2".repeat(2.5 * 1024 * 1024);
      const start = performance.now();
      const out = redactSensitiveData(huge);
      expect(performance.now() - start).toBeLessThan(100);
      expect(out).toMatch(/truncated \d+ chars/);
    });
  });

  describe("truncateString", () => {
    it("truncates long strings", () => {
      const result = truncateString(
        "This is a very long string that should be truncated to fit within the maximum length",
        20,
      );
      expect(result.length).toBeLessThanOrEqual(24);
      expect(result).toMatch(/\.\.\./);
    });

    it("does not truncate short strings", () => {
      expect(truncateString("Short", 50)).toBe("Short");
    });
  });

  describe("createSecureLogger", () => {
    let logSpy: MockInstance;
    let warnSpy: MockInstance;
    let errorSpy: MockInstance;

    beforeEach(() => {
      logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("redacts data passed to log", () => {
      const address = Keypair.random().publicKey();
      createSecureLogger().log("Address:", address);
      const callArgs = logSpy.mock.calls[0]!;
      expect(callArgs[1]).toContain(REDACTED);
      expect(callArgs[1]).not.toContain(address);
    });

    it("redacts data passed to warn", () => {
      createSecureLogger().warn("Warning:", { key: Keypair.random().secret() });
      expect(warnSpy.mock.calls[0]![1]).toContain(REDACTED);
    });

    it("redacts data passed to error", () => {
      createSecureLogger().error("Error:", { address: Keypair.random().publicKey() });
      expect(errorSpy.mock.calls[0]![1]).toContain(REDACTED);
    });

    it("redacts the message itself", () => {
      const secret = Keypair.random().secret();
      createSecureLogger().log(`leaked ${secret}`);
      expect(logSpy.mock.calls[0]![0]).not.toContain(secret);
    });
  });
});
