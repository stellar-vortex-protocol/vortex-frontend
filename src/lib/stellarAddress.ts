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

/** Strkey prefixes from the SEP-0023 version-byte table. */
export type StrKeyPrefix = "G" | "S" | "M" | "C" | "T" | "X" | "P";

// Decoded byte lengths (version + payload + 2-byte CRC) per prefix. Signed
// payloads ("P") carry a variable-length payload, so any length is accepted.
const STRKEY_DECODED_LENGTHS: Record<StrKeyPrefix, readonly number[] | null> = {
  G: [35],
  S: [35],
  C: [35],
  T: [35],
  X: [35],
  M: [43],
  P: null,
};

/**
 * Checksum-validates any SEP-0023 strkey (account, seed, muxed, contract,
 * pre-auth tx, hash-x or signed payload). Never throws.
 */
export function isValidStrKey(value: string): boolean {
  const prefix = value[0] as StrKeyPrefix | undefined;
  if (!prefix || !(prefix in STRKEY_DECODED_LENGTHS)) return false;

  const decoded = base32Decode(value);
  if (!decoded || decoded.length < 3) return false;

  const lengths = STRKEY_DECODED_LENGTHS[prefix];
  if (lengths && !lengths.includes(decoded.length)) return false;
  if (decoded[0]! >>> 3 !== BASE32_ALPHABET.indexOf(prefix)) return false;

  const expectedChecksum = crc16xmodem(decoded.slice(0, -2));
  return (
    decoded[decoded.length - 2] === (expectedChecksum & 0xff) &&
    decoded[decoded.length - 1] === expectedChecksum >>> 8
  );
}
