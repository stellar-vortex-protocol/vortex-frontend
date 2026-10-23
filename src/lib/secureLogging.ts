/**
 * Secure logging utilities to redact sensitive information from console output.
 * Prevents accidental exposure of wallet addresses, XDR blobs, and backend errors.
 *
 * This is the only module allowed to call `console.*` directly (enforced by the
 * `no-console` rule in `.eslintrc.json`). Everything else logs via `secureLogger`.
 *
 * Redaction is rule based: each rule finds candidate substrings and decides
 * whether they are sensitive. Values are redacted deeply (objects, arrays,
 * Errors incl. `stack`/`cause`, circular refs) with depth, breadth and string
 * size limits so a huge payload cannot stall a hot path. Redaction never throws.
 */

import { isValidStrKey } from "./stellarAddress";

export const REDACTED = "[REDACTED]";

export interface RedactionRule {
  name: string;
  /** Global regex locating candidates. */
  pattern: RegExp;
  /** Decides whether a match is sensitive; defaults to always. */
  test?: (match: string) => boolean;
  /** Replacement for a sensitive match; defaults to `[REDACTED]`. */
  replace?: (match: string) => string;
}

export interface RedactorOptions {
  /** Matches equal to / matching one of these entries are left untouched (e.g. intent ids). */
  allowlist?: ReadonlyArray<string | RegExp>;
  rules?: ReadonlyArray<RedactionRule>;
  maxDepth?: number;
  maxKeys?: number;
  maxStringLength?: number;
}

const BASE32 = "A-Z2-7";

// Words that frequently appear in ordinary prose but are not in the BIP-39
// English wordlist; their presence rules out a mnemonic.
const PROSE_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "you", "are", "was",
  "is", "its", "not", "but", "have", "has", "had", "were", "will", "your",
  "they", "them", "then", "than", "been", "into", "which", "there", "their",
]);

const MNEMONIC_LENGTHS = new Set([12, 15, 18, 21, 24]);

function looksLikeMnemonic(match: string): boolean {
  const words = match.trim().split(/\s+/);
  if (!MNEMONIC_LENGTHS.has(words.length) && words.length < 12) return false;
  return words.every((w) => w.length >= 3 && w.length <= 8 && !PROSE_WORDS.has(w));
}

function looksLikeBase64Blob(match: string): boolean {
  const body = match.replace(/=+$/, "");
  if (match.length % 4 !== 0 && !/^[A-Za-z0-9_-]+$/.test(match)) return false;
  // Require mixed character classes: plain words/identifiers rarely have all three.
  return /[A-Z]/.test(body) && /[a-z]/.test(body) && /[0-9+/_-]/.test(body);
}

export const DEFAULT_RULES: ReadonlyArray<RedactionRule> = [
  {
    name: "bearer",
    pattern: /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
    replace: () => `Bearer ${REDACTED}`,
  },
  {
    name: "jwt",
    pattern: /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  },
  {
    // Secret seeds are redacted on shape alone (never worth the risk); every
    // other strkey type must pass the checksum to avoid over-redacting ids.
    name: "strkey",
    pattern: new RegExp(`(?<![A-Za-z0-9])[GSMCTPX][${BASE32}]{47,164}(?![A-Za-z0-9])`, "g"),
    // Seeds are matched loosely (±8 chars) so truncated/mistyped seeds are caught too.
    test: (m) => (m[0] === "S" && m.length <= 64) || isValidStrKey(m),
  },
  {
    name: "xdr",
    pattern: /(?<![A-Za-z0-9+/])AAAA[A-Za-z0-9+/]{44,}={0,2}/g,
    test: (m) => /[a-z0-9+/]/.test(m.slice(4)),
  },
  {
    name: "base64",
    pattern: /(?<![A-Za-z0-9+/_-])[A-Za-z0-9+/_-]{64,}={0,2}(?![A-Za-z0-9+/_-])/g,
    test: looksLikeBase64Blob,
  },
  {
    name: "hex",
    pattern: /\b(?:0x)?[0-9a-fA-F]{40,}\b/g,
  },
  {
    name: "mnemonic",
    pattern: /\b[a-z]{3,8}(?:[ \t]+[a-z]{3,8}){11,23}\b/g,
    test: looksLikeMnemonic,
  },
];

// Object keys whose values are always redacted regardless of content.
const SENSITIVE_KEY_RE = /^(secret|seed|mnemonic|private_?key|password|passphrase|authorization|token|access_?token|signed_?xdr)$/i;

const DEFAULTS = {
  maxDepth: 8,
  maxKeys: 200,
  maxStringLength: 64 * 1024,
};

function isAllowed(match: string, allowlist: ReadonlyArray<string | RegExp>): boolean {
  return allowlist.some((entry) =>
    typeof entry === "string" ? entry === match : new RegExp(`^(?:${entry.source})$`, entry.flags.replace("g", "")).test(match),
  );
}

export function createRedactor(options: RedactorOptions = {}) {
  const rules = options.rules ?? DEFAULT_RULES;
  const allowlist = options.allowlist ?? [];
  const maxDepth = options.maxDepth ?? DEFAULTS.maxDepth;
  const maxKeys = options.maxKeys ?? DEFAULTS.maxKeys;
  const maxStringLength = options.maxStringLength ?? DEFAULTS.maxStringLength;

  function redactString(input: string): string {
    let str = input;
    let suffix = "";
    if (str.length > maxStringLength) {
      suffix = `…[truncated ${str.length - maxStringLength} chars]`;
      str = str.slice(0, maxStringLength);
    }
    for (const rule of rules) {
      str = str.replace(rule.pattern, (match) => {
        if (isAllowed(match, allowlist)) return match;
        if (rule.test && !rule.test(match)) return match;
        return rule.replace ? rule.replace(match) : REDACTED;
      });
    }
    return str + suffix;
  }

  function redactValue(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
    try {
      if (typeof value === "string") return redactString(value);
      if (value === null || typeof value !== "object") {
        return typeof value === "bigint" || typeof value === "symbol" || typeof value === "function"
          ? String(value)
          : value;
      }
      if (seen.has(value)) return "[Circular]";
      if (depth >= maxDepth) return "[MaxDepth]";
      seen.add(value);

      if (value instanceof Error) {
        const out: Record<string, unknown> = {
          name: value.name,
          message: redactString(value.message),
        };
        if (value.stack) out["stack"] = redactString(value.stack);
        if ("cause" in value && value.cause !== undefined) {
          out["cause"] = redactValue(value.cause, depth + 1, seen);
        }
        return out;
      }

      if (Array.isArray(value)) {
        const out = value.slice(0, maxKeys).map((v) => redactValue(v, depth + 1, seen));
        if (value.length > maxKeys) out.push(`[+${value.length - maxKeys} items]`);
        return out;
      }

      const out: Record<string, unknown> = {};
      const keys = Object.keys(value);
      for (const key of keys.slice(0, maxKeys)) {
        const v = (value as Record<string, unknown>)[key];
        out[key] = SENSITIVE_KEY_RE.test(key) && v != null ? REDACTED : redactValue(v, depth + 1, seen);
      }
      if (keys.length > maxKeys) out["…"] = `[+${keys.length - maxKeys} keys]`;
      return out;
    } catch {
      return REDACTED;
    }
  }

  return {
    redactString,
    redactValue: (value: unknown) => redactValue(value),
  };
}

const defaultRedactor = createRedactor();

/** Deeply redacts a value, preserving its shape where safe. Never throws. */
export function redactValue(value: unknown): unknown {
  return defaultRedactor.redactValue(value);
}

export function redactSensitiveData(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  const redacted = defaultRedactor.redactValue(value);
  if (typeof redacted === "string") return redacted;
  try {
    return JSON.stringify(redacted) ?? String(redacted);
  } catch {
    return REDACTED;
  }
}

export function truncateString(value: string, maxLength: number = 50): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength / 2)}...${value.slice(-maxLength / 2)}`;
}

export function createSecureLogger(options?: RedactorOptions) {
  const redactor = options ? createRedactor(options) : defaultRedactor;
  const emit =
    (fn: (...args: unknown[]) => void) =>
    (message: string, data?: unknown) => {
      const safeMessage = redactor.redactString(message);
      if (data === undefined) {
        fn(safeMessage);
        return;
      }
      const redacted = redactor.redactValue(data);
      fn(safeMessage, typeof redacted === "string" ? redacted : JSON.stringify(redacted));
    };

  return {
    log: emit((...args) => console.log(...args)),
    warn: emit((...args) => console.warn(...args)),
    error: emit((...args) => console.error(...args)),
  };
}

export const secureLogger = createSecureLogger();
