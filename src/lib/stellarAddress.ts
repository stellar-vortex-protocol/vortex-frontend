// Validates Stellar Ed25519 public keys ("G..." strkeys) per SEP-0023,
// without depending on @stellar/stellar-sdk — pulling in the full SDK here
// drags sodium-native into the client bundle for a single format check.

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ED25519_PUBLIC_KEY_VERSION_BYTE = 6 << 3; // 0x30, encodes to a leading "G"

function base32Decode(input: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of input) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) return null;
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }

  return new Uint8Array(bytes);
}

function crc16xmodem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

/**
 * Shortens a Stellar address (or any opaque identifier such as a tx hash) for
 * display, keeping `prefix` leading and `suffix` trailing characters joined by
 * an ellipsis — e.g. `GABC...3456`.
 *
 * This is the single source of truth for address truncation; call sites must not
 * re-implement their own slice logic. Inputs that are empty or already no longer
 * than `prefix + suffix` are returned unchanged so we never produce a string
 * that is longer than (or as long as) the original.
 */
export function truncateAddress(
  address: string,
  opts: { prefix?: number; suffix?: number } = {}
): string {
  const { prefix = 4, suffix = 4 } = opts;
  if (!address || address.length <= prefix + suffix) return address;
  return `${address.slice(0, prefix)}...${address.slice(-suffix)}`;
}

export function isValidStellarPublicKey(address: string): boolean {
  if (address.length !== 56 || address[0] !== "G") return false;

  const decoded = base32Decode(address);
  if (!decoded || decoded.length !== 35) return false;

  const [versionByte] = decoded;
  if (versionByte !== ED25519_PUBLIC_KEY_VERSION_BYTE) return false;

  const payload = decoded.slice(0, 33);
  const checksum = decoded.slice(33, 35);
  const expectedChecksum = crc16xmodem(payload);

  return (
    checksum[0] === (expectedChecksum & 0xff) &&
    checksum[1] === expectedChecksum >>> 8
  );
}

/**
 * Normalises a Stellar address for comparison: trims surrounding whitespace and
 * upper-cases it. Stellar strkeys are case-insensitive base32, so two addresses
 * that differ only in case refer to the same account. Used by the delegation
 * flow to detect self-delegation and to compare a pasted address against the
 * current delegate without false negatives.
 */
export function normalizeStellarAddress(address: string): string {
  return address.trim().toUpperCase();
}

/**
 * Returns true when two Stellar addresses refer to the same account, ignoring
 * surrounding whitespace and case. Returns false if either input is empty so
 * that an unset delegate never compares equal to a real address.
 */
export function isSameStellarAddress(a: string, b: string): boolean {
  const left = normalizeStellarAddress(a);
  const right = normalizeStellarAddress(b);
  if (!left || !right) return false;
  return left === right;
}

/**
 * Detects visually confusable Stellar addresses — the address-poisoning vector
 * where an attacker crafts an address that shares a long prefix/suffix with a
 * legitimate one so a truncated display looks identical.
 *
 * Returns the number of leading and trailing characters the two addresses have
 * in common (case-insensitive). Callers decide the threshold at which to warn;
 * this helper only measures the overlap so the policy stays in the UI layer.
 */
export function addressConfusableOverlap(
  a: string,
  b: string
): { prefix: number; suffix: number } {
  const left = normalizeStellarAddress(a);
  const right = normalizeStellarAddress(b);
  if (!left || !right) return { prefix: 0, suffix: 0 };

  const max = Math.min(left.length, right.length);

  let prefix = 0;
  while (prefix < max && left[prefix] === right[prefix]) prefix++;

  let suffix = 0;
  while (
    suffix < max - prefix &&
    left[left.length - 1 - suffix] === right[right.length - 1 - suffix]
  ) {
    suffix++;
  }

  return { prefix, suffix };
}

/**
 * Convenience predicate for the delegation confirmation step: flags a candidate
 * address as confusable with a reference address when it shares at least
 * `minOverlap` leading or trailing characters. Defaults to 4, matching the
 * default `truncateAddress` prefix/suffix so anything that would render
 * identically when truncated is caught.
 */
export function isConfusableAddress(
  candidate: string,
  reference: string,
  minOverlap = 4
): boolean {
  if (isSameStellarAddress(candidate, reference)) return false;
  const { prefix, suffix } = addressConfusableOverlap(candidate, reference);
  return prefix >= minOverlap || suffix >= minOverlap;
}
