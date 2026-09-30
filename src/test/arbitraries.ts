import fc from "fast-check";
import {
  TransactionBuilder,
  Account,
  Operation,
  Asset,
  Keypair,
  Networks,
} from "@stellar/stellar-sdk";

// ─── Configuration ────────────────────────────────────────

/**
 * Number of fuzz-test iterations.  Controlled by the FUZZ_RUNS
 * environment variable; defaults to 100 for fast local feedback.
 * CI nightly jobs override this with a larger value.
 */
export function getNumRuns(): number {
  const env = process.env.FUZZ_RUNS;
  if (env !== undefined) {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n > 0) return n;
  }
  return 100;
}

/**
 * Optional fixed seed for reproducibility in CI.
 * When FUZZ_SEED is set the same inputs are generated on every run.
 */
export function getSeed(): number | undefined {
  const env = process.env.FUZZ_SEED;
  if (env !== undefined) {
    const n = parseInt(env, 10);
    if (!isNaN(n) && n >= 0) return n;
  }
  return undefined;
}

// ─── Corpus helpers ───────────────────────────────────────

const CORPUS_DIR = "src/test/fuzz-corpus";

// ─── Corpus helpers ───────────────────────────────────────

import fs from "fs";
import path from "path";

const CORPUS_DIR = "src/test/fuzz-corpus";

/**
 * Save a failing input to the seed-corpus folder so it can be
 * replayed in subsequent unit-test runs.
 */
export function saveToCorpus(testName: string, input: unknown): void {
  try {
    if (!fs.existsSync(CORPUS_DIR)) {
      fs.mkdirSync(CORPUS_DIR, { recursive: true });
    }
    const timestamp = Date.now();
    const filename = `${timestamp}-${testName}.json`;
    fs.writeFileSync(
      path.join(CORPUS_DIR, filename),
      JSON.stringify({ testName, input, timestamp })
    );
  } catch {
    // corpus saving is best-effort; never let it break the test run
  }
}

/**
 * Load all corpus entries for replay in the normal unit run.
 */
export function loadCorpusEntries(): Array<{
  filename: string;
  input: unknown;
}> {
  try {
    if (!fs.existsSync(CORPUS_DIR)) return [];
    return fs
      .readdirSync(CORPUS_DIR)
      .filter((f: string) => f.endsWith(".json"))
      .map((f: string) => {
        const content = fs.readFileSync(path.join(CORPUS_DIR, f), "utf-8");
        return { filename: f, input: JSON.parse(content) };
      });
  } catch {
    return [];
  }
}

// ─── XDR arbitraries ──────────────────────────────────────

const PASSPHRASE = Networks.TESTNET;

/**
 * Build a valid XDR envelope using the Stellar SDK's TransactionBuilder.
 */
function buildValidXdr(): string {
  const source = Keypair.random();
  const account = new Account(source.publicKey(), "0");
  const dest = Keypair.random();

  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: dest.publicKey(),
        asset: Asset.native(),
        amount: String(Math.floor(Math.random() * 1_000_000)),
      })
    )
    .setTimeout(300)
    .build();

  return tx.toXDR();
}

/**
 * Arbitrary that produces valid XDR envelopes.
 */
export const arbitraryXdrEnvelope: fc.Arbitrary<string> = fc
  .integer({ min: 1, max: 5 })
  .map(() => buildValidXdr());

/**
 * Arbitrary that produces mutated XDR envelopes by flipping random
 * bytes in a valid XDR string.  The mutation rate is low enough that
 * most outputs are still parseable but may be semantically invalid.
 */
export const arbitraryMutatedXdrEnvelope: fc.Arbitrary<string> =
  arbitraryXdrEnvelope.chain((xdr) => {
    const bytes = Buffer.from(xdr, "base64");
    if (bytes.length === 0) return fc.constant(xdr);
    return fc.tuple(
      fc.integer({ min: 0, max: bytes.length - 1 }),
      fc.integer({ min: 1, max: 255 })
    ).map(([pos, mask]) => {
      const mutated = Buffer.from(bytes);
      mutated[pos] = mutated[pos] ^ mask;
      return mutated.toString("base64");
    });
  });

// ─── CSV arbitraries ──────────────────────────────────────

const FORMULA_TRIGGERS = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Generate a CSV cell value that may or may not start with a formula
 * trigger character.  Includes trigger characters, commas, quotes,
 * and newlines to exercise the quoting logic.
 */
export const arbitraryCsvCell: fc.Arbitrary<string> = fc.oneof(
  // Safe plain text
  fc.string({ minLength: 0, maxLength: 100 }),
  // Formula trigger prefix
  fc.tuple(
    fc.constantFrom(...FORMULA_TRIGGERS),
    fc.string({ minLength: 0, maxLength: 50 })
  ).map(([trigger, rest]) => trigger + rest),
  // Value with embedded commas
  fc.string({ minLength: 0, maxLength: 50 }).map((s) => s + "," + s),
  // Value with embedded quotes
  fc.string({ minLength: 0, maxLength: 50 }).map((s) => '"' + s + '"'),
  // Value with embedded newlines
  fc.string({ minLength: 0, maxLength: 30 }).map((s) => s + "\n" + s),
  // Value with both trigger and comma
  fc.tuple(
    fc.constantFrom(...FORMULA_TRIGGERS),
    fc.string({ minLength: 0, maxLength: 30 })
  ).map(([trigger, rest]) => trigger + rest + "," + rest)
);

// ─── Unicode arbitraries ──────────────────────────────────

/**
 * Generate strings that span a variety of Unicode blocks, including
 * the dangerous bidi/zero-width ranges.
 */
export const arbitraryUnicodeString: fc.Arbitrary<string> =
  fc.unicodeString({ minLength: 0, maxLength: 200 });

/**
 * Generate strings that specifically contain dangerous Unicode
 * characters (bidi overrides, zero-width/invisible chars).
 */
export const arbitraryDangerousUnicodeString: fc.Arbitrary<string> = fc
  .oneof(
    // Bidi control characters: U+202A–U+202E, U+2066–U+2069
    fc.integer({ min: 0x202a, max: 0x202e }),
    fc.integer({ min: 0x2066, max: 0x2069 }),
    // Zero-width/invisible: U+200B–U+200D, U+FEFF, U+00AD
    fc.integer({ min: 0x200b, max: 0x200d }),
    fc.constant(0xfeff),
    fc.constant(0x00ad)
  )
  .chain((codePoint) =>
    fc.tuple(
      fc.string({ minLength: 0, maxLength: 50 }),
      fc.string({ minLength: 0, maxLength: 50 })
    ).map(([prefix, suffix]) =>
      prefix + String.fromCodePoint(codePoint) + suffix
    )
  );

// ─── Stellar address arbitraries ──────────────────────────

/**
 * Generate a valid Stellar G-strkey public key using the SDK.
 */
export const arbitraryValidStellarAddress: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 1000 })
  .map(() => Keypair.random().publicKey());

/**
 * Generate a corrupted Stellar address by modifying a random character
 * of a valid address (corrupted checksum).
 */
export const arbitraryCorruptedChecksumAddress: fc.Arbitrary<string> =
  arbitraryValidStellarAddress.chain((addr) => {
    if (addr.length < 2) return fc.constant(addr);
    return fc.tuple(
      fc.integer({ min: 1, max: addr.length - 1 }),
      fc.integer({ min: 0, max: 31 })
    ).map(([idx, charIdx]) => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
      const newChar = chars[charIdx];
      return addr.slice(0, idx) + newChar + addr.slice(idx + 1);
    });
  });

/**
 * Generate a Stellar address with an incorrect length.
 */
export const arbitraryWrongLengthAddress: fc.Arbitrary<string> = fc.oneof(
  fc.string({ minLength: 1, maxLength: 54 }).map((s) => "G" + s), // too short
  fc.string({ minLength: 57, maxLength: 60 }).map((s) => "G" + s) // too long
);

/**
 * Arbitrary that produces strkeys with either corrupted checksums
 * or wrong lengths.
 */
export const arbitraryCorruptedStellarAddress: fc.Arbitrary<string> = fc.oneof(
  arbitraryCorruptedChecksumAddress,
  arbitraryWrongLengthAddress
);

// ─── JSON arbitraries ─────────────────────────────────────

/**
 * Generate JSON values with extreme nesting and prototype-polluting keys.
 */
export const arbitraryJson: fc.Arbitrary<unknown> = fc.recursive(
  fc.oneof(
    fc.string({ minLength: 0, maxLength: 20 }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null)
  ),
  (inner) =>
    fc.oneof(
      fc.array(inner, { minLength: 0, maxLength: 10 }),
      fc
        .array(
          fc.tuple(
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 10 }),
              fc.constant("__proto__"),
              fc.constant("constructor")
            ),
            inner
          ),
          { minLength: 0, maxLength: 5 }
        )
        .map((pairs) => Object.fromEntries(pairs))
    ),
  { maxDepth: 5 }
);

// ─── Corpus-aware assertion helper ──────────────────────

/**
 * Run a fast-check property and auto-save any failing
 * counterexample to the seed-corpus folder.
 */
export function assertWithCorpus(
  testName: string,
  property: fc.Property,
  options: { numRuns?: number; seed?: number } = {}
): void {
  try {
    fc.assert(property, options);
  } catch (err) {
    const counterexample = (err as any).counterexample;
    if (counterexample !== undefined) {
      saveToCorpus(testName, counterexample);
    }
    throw err;
  }
}
