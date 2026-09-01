/**
 * Text safety utilities for issue #247.
 *
 * Defends against Unicode-based visual spoofing attacks in externally-supplied
 * strings (solver names, address-adjacent display text) by stripping:
 *
 *   1. Bidirectional control characters (U+202A–U+202E, U+2066–U+2069)
 *      These can cause text to render right-to-left in the middle of a
 *      left-to-right string, making e.g. "trustworthy" appear as something
 *      else to a human reader while the underlying bytes differ.
 *
 *   2. Zero-width and invisible characters (U+200B–U+200D, U+FEFF, U+00AD)
 *      These are imperceptible to a reader but allow two visually identical
 *      strings to have different byte sequences — a classic "address
 *      poisoning" technique in crypto UIs.
 *
 * What we do NOT strip:
 *   • Non-Latin scripts (Arabic, CJK, Cyrillic, etc.) — a solver name in
 *     any script is legitimate.  We target control and invisible code points
 *     only, never visible characters from any Unicode block.
 *   • Regular whitespace, punctuation, or numeric characters.
 *
 * Stellar public keys (G-strkeys, 56-char base32) are validated structurally
 * by `isValidStellarPublicKey` before display, so the confusable-character
 * risk is limited to the address-adjacent free-text fields (solver names,
 * future memo fields).  We still run sanitisation on displayed address strings
 * as a defence-in-depth measure.
 *
 * The sanitisation strips rather than flags dangerous characters because:
 *   • There is essentially no legitimate use of bidi overrides or zero-width
 *     characters in solver names or Stellar addresses.
 *   • Stripping is silent and user-friendly; flagging would require UI changes
 *     in every consumer and could cause confusing error messages for benign input.
 */

// ─── Dangerous Unicode ranges ─────────────────────────────────────────────────

/**
 * Bidirectional override and isolate characters.
 *
 * U+202A  LEFT-TO-RIGHT EMBEDDING
 * U+202B  RIGHT-TO-LEFT EMBEDDING
 * U+202C  POP DIRECTIONAL FORMATTING
 * U+202D  LEFT-TO-RIGHT OVERRIDE
 * U+202E  RIGHT-TO-LEFT OVERRIDE   ← most commonly abused
 * U+2066  LEFT-TO-RIGHT ISOLATE
 * U+2067  RIGHT-TO-LEFT ISOLATE
 * U+2068  FIRST STRONG ISOLATE
 * U+2069  POP DIRECTIONAL ISOLATE
 */
const BIDI_CONTROLS_RE = /[\u202A-\u202E\u2066-\u2069]/g;

/**
 * Zero-width and invisible characters.
 *
 * U+200B  ZERO WIDTH SPACE
 * U+200C  ZERO WIDTH NON-JOINER
 * U+200D  ZERO WIDTH JOINER
 * U+FEFF  ZERO WIDTH NO-BREAK SPACE (BOM when at start of stream)
 * U+00AD  SOFT HYPHEN (invisible, used in homoglyph attacks)
 */
const ZERO_WIDTH_INVIS_RE = /[\u200B-\u200D\uFEFF\u00AD]/g;

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Strip bidi-override and zero-width/invisible Unicode characters from a
 * string before displaying it to the user.
 *
 * Safe to call with any string; returns the input unchanged if no dangerous
 * characters are present.
 */
export function sanitizeDisplayText(value: string): string {
  return value.replace(BIDI_CONTROLS_RE, "").replace(ZERO_WIDTH_INVIS_RE, "");
}

/**
 * Returns `true` if the string contains any dangerous Unicode characters that
 * could be used for visual spoofing.  Useful for tests and logging.
 */
export function containsDangerousUnicode(value: string): boolean {
  return BIDI_CONTROLS_RE.test(value) || ZERO_WIDTH_INVIS_RE.test(value);
}
