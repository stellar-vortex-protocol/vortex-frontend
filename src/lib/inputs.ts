/**
 * Central validators for untrusted input entering the app.
 *
 * Every validator returns a branded type so unvalidated strings
 * cannot accidentally reach API helpers or path-interpolation sites.
 * Invalid inputs return `null` (callers decide how to react).
 *
 * Validators are pure functions — no side effects, no network calls.
 */

// ─── Branded types ──────────────────────────────────────────────────

type Brand<K, T> = K & { __brand: T };

/** Opaque intent identifier used in `/intents/:id` paths. */
export type IntentId = Brand<string, "IntentId">;

/** Stellar Ed25519 public key (G-strkey, 56 chars). */
export type StrKey = Brand<string, "StrKey">;

/** Known chain identifier (ethereum, base, polygon, etc.). */
export type ChainId = Brand<string, "ChainId">;

/** Internal relative href — safe for `<Link href>` or `window.location`. */
export type InternalHref = Brand<string, "InternalHref">;

/** External URL whose origin is on the approved whitelist. */
export type ExternalUrl = Brand<string, "ExternalUrl">;

// ─── Constants ──────────────────────────────────────────────────────

const MAX_INTENT_ID_LENGTH = 64;
const MAX_STRKEY_LENGTH = 56;
const MAX_CHAIN_ID_LENGTH = 32;
const MAX_HREF_LENGTH = 256;
const MAX_URL_LENGTH = 2048;

const VALID_CHAIN_IDS = new Set([
  "ethereum",
  "base",
  "polygon",
  "arbitrum",
  "optimism",
  "avalanche",
]);

// Origins that are allowed for external links in toasts and ExternalLink.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://github.com",
  "https://discord.gg",
];

// ─── Helpers ────────────────────────────────────────────────────────

function isAlphanumericHyphenUnderscore(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

// ─── Validators ─────────────────────────────────────────────────────

/**
 * Validate an intent ID for use in `/intents/:id` path interpolation.
 *
 * Accepts only ASCII alphanumeric characters, hyphens, and underscores.
 * Rejects path traversal (`..`), slashes, query strings, and fragments.
 */
export function parseIntentId(value: string): IntentId | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_INTENT_ID_LENGTH) return null;
  if (!isAlphanumericHyphenUnderscore(value)) return null;
  return value as IntentId;
}

/**
 * Validate a Stellar Ed25519 public key (G-strkey).
 *
 * Uses the same structural check as `isValidStellarPublicKey` from
 * `stellarAddress.ts` — 56 chars, starts with G, valid base32,
 * valid CRC-16 checksum.
 */
export function parseStrKey(value: string): StrKey | null {
  if (typeof value !== "string") return null;
  if (value.length !== MAX_STRKEY_LENGTH) return null;
  if (value[0] !== "G") return null;

  const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes: number[] = [];
  let bits = 0;
  let byteValue = 0;

  for (const char of value) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) return null;
    byteValue = (byteValue << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((byteValue >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  if (bytes.length !== 35) return null;

  // Verify CRC-16-XMODEM checksum (last 2 bytes).
  const payload = bytes.slice(0, 33);
  const checksum = (bytes[33] << 8) | bytes[34];
  if (crc16Xmodem(payload) !== checksum) return null;

  return value as StrKey;
}

function crc16Xmodem(data: number[]): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * Validate a chain identifier against the known set of chains.
 */
export function parseChainId(value: string): ChainId | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_CHAIN_ID_LENGTH) return null;
  if (!VALID_CHAIN_IDS.has(value)) return null;
  return value as ChainId;
}

/**
 * Validate an internal relative href.
 *
 * Accepts paths that:
 *  - Start with `/`
 *  - Do not start with `//` (protocol-relative)
 *  - Do not contain `..` path segments
 *  - Do not contain `\` (backslashes)
 *  - Are at most MAX_HREF_LENGTH chars
 *
 * Query strings and hash fragments are allowed (they're part of
 * internal navigation).
 */
export function parseInternalHref(value: string): InternalHref | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_HREF_LENGTH) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//")) return null;
  if (value.includes("\\")) return null;

  // Reject path traversal segments.
  const segments = value.split("/");
  for (const segment of segments) {
    if (segment === "..") return null;
  }

  return value as InternalHref;
}

/**
 * Validate an external URL against an allowed-origin whitelist.
 *
 * Rejects:
 *  - `javascript:`, `data:`, `vbscript:` protocols
 *  - URLs whose origin is not in `allowedOrigins`
 *  - URLs longer than MAX_URL_LENGTH
 *  - URLs that fail `new URL()` parsing
 *
 * When `allowedOrigins` is omitted, uses `DEFAULT_ALLOWED_ORIGINS`.
 */
export function parseExternalUrl(
  value: string,
  allowedOrigins?: string[],
): ExternalUrl | null {
  if (typeof value !== "string") return null;
  if (value.length === 0 || value.length > MAX_URL_LENGTH) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  // Reject dangerous protocols.
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const origins = allowedOrigins ?? DEFAULT_ALLOWED_ORIGINS;
  const origin = `${url.protocol}//${url.host}`;
  if (!origins.includes(origin)) return null;

  return value as ExternalUrl;
}
