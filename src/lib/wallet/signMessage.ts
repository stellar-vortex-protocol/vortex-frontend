import { Keypair, TransactionBuilder, Networks, Operation, Account, Asset, BASE_FEE } from 'stellar-sdk';

/**
 * SEP-53 style message signing for governance comments.
 *
 * Canonical message format (documented spec):
 *
 *   stellar-comment:<proposalId>:<sha256(normalizedText)>:<timestamp>
 *
 * - `proposalId` is the raw proposal identifier (no normalisation).
 * - `normalizedText` is the comment body after Unicode NFC normalisation and
 *   trimming of leading/trailing whitespace. The hash is the lowercase hex
 *   encoding of the SHA-256 digest of the UTF-8 bytes.
 * - `timestamp` is the Unix epoch milliseconds at signing time. Verifiers MUST
 *   reject signatures whose timestamp is outside the accepted window
 *   (see `SIGNATURE_WINDOW_MS`) to prevent replay of old signatures.
 *
 * Wallets that support SEP-53 message signing sign the raw UTF-8 bytes of the
 * canonical message. Wallets that do not expose message signing fall back to a
 * zero-fee, zero-amount `manageData` auth transaction whose data value is the
 * canonical message; the transaction is signed by the wallet and never
 * submitted to the network.
 */

export const SIGNATURE_WINDOW_MS = 5 * 60 * 1000;

export interface SignedCommentPayload {
  proposalId: string;
  text: string;
  timestamp: number;
}

export interface SignedComment extends SignedCommentPayload {
  author: string;
  signature: string;
  /** Which signing strategy produced the signature. */
  scheme: 'sep53' | 'auth-tx';
}

/**
 * Normalise comment text for hashing: Unicode NFC + trim.
 */
export function normalizeCommentText(text: string): string {
  return text.normalize('NFC').trim();
}

/**
 * Compute the lowercase hex SHA-256 digest of the normalised comment text.
 * Uses the Web Crypto API available in browsers and modern Node runtimes.
 */
export async function hashCommentText(text: string): Promise<string> {
  const normalized = normalizeCommentText(text);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Build the canonical message that is signed and verified. Pure and
 * deterministic so it can be reused by both signing and verification paths.
 */
export function buildCanonicalMessage(
  proposalId: string,
  textHash: string,
  timestamp: number,
): string {
  return `stellar-comment:${proposalId}:${textHash}:${timestamp}`;
}

/**
 * Sign a governance comment with the supplied keypair using SEP-53 style
 * message signing. Returns the canonical payload plus signature metadata.
 */
export async function signComment(
  keypair: Keypair,
  payload: SignedCommentPayload,
): Promise<SignedComment> {
  const textHash = await hashCommentText(payload.text);
  const message = buildCanonicalMessage(payload.proposalId, textHash, payload.timestamp);
  const signature = keypair.sign(Buffer.from(message, 'utf8')).toString('base64');
  return {
    ...payload,
    author: keypair.publicKey(),
    signature,
    scheme: 'sep53',
  };
}

/**
 * Build a zero-fee auth transaction carrying the canonical message in a
 * `manageData` operation. Used as a documented shim for wallets that do not
 * support SEP-53 message signing. The transaction is never submitted.
 */
export function buildAuthTransaction(
  sourcePublicKey: string,
  proposalId: string,
  textHash: string,
  timestamp: number,
): string {
  const message = buildCanonicalMessage(proposalId, textHash, timestamp);
  const account = new Account(sourcePublicKey, '0');
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(
      Operation.manageData({
        name: 'comment',
        value: Buffer.from(message, 'utf8'),
      }),
    )
    .addMemo({ type: 'none' } as never)
    .setTimeout(0)
    .build();
  return tx.toXDR();
}

/**
 * Verify a signed comment. Pure function: given the comment and the current
 * time it returns whether the signature is valid, the timestamp is within the
 * accepted window, and the text hash matches the signed message.
 *
 * Returns `true` only when all checks pass. Callers should display the
 * "verified author" badge solely on a `true` result.
 */
export async function verifySignedComment(
  comment: SignedComment,
  now: number = Date.now(),
): Promise<boolean> {
  if (!comment || typeof comment.signature !== 'string' || comment.signature.length === 0) {
    return false;
  }
  if (typeof comment.timestamp !== 'number' || !Number.isFinite(comment.timestamp)) {
    return false;
  }
  // Replay protection: reject signatures outside the accepted window.
  if (Math.abs(now - comment.timestamp) > SIGNATURE_WINDOW_MS) {
    return false;
  }
  const textHash = await hashCommentText(comment.text);
  const message = buildCanonicalMessage(comment.proposalId, textHash, comment.timestamp);
  try {
    const keypair = Keypair.fromPublicKey(comment.author);
    const signature = Buffer.from(comment.signature, 'base64');
    return keypair.verify(Buffer.from(message, 'utf8'), signature);
  } catch {
    return false;
  }
}
