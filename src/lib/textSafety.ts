/**
 * Text safety utilities (issue #247, #476).
 *
 * Defends against Unicode-based visual spoofing in externally-supplied strings
 * (solver names, address-adjacent display text) by stripping:
 *
 *   1. Bidirectional control characters (U+202A–U+202E, U+2066–U+2069) that can
 *      make text render in a different order than its underlying bytes.
 *   2. Zero-width and invisible characters (U+200B–U+200D, U+FEFF, U+00AD) that
 *      make visually identical strings differ byte-for-byte.
 *
 * Visible characters from any script (Arabic, CJK, Cyrillic, ...) are never
 * stripped. All functions are pure string functions with no DOM dependency so
 * they behave identically server-side (export/SSR) and client-side.
 */

// ─── Dangerous Unicode ranges ─────────────────────────────────────────────────

/** U+202A–U+202E embeddings/overrides and U+2066–U+2069 isolates. */
const BIDI_CONTROLS_RE = /[‪-‮⁦-⁩]/g;

/** U+200B ZWSP, U+200C ZWNJ, U+200D ZWJ, U+FEFF BOM/ZWNBSP, U+00AD soft hyphen. */
const ZERO_WIDTH_INVIS_RE = /[​-‍﻿­]/g;

/**
 * C0/C1 control characters other than tab (U+0009) and newline (U+000A).
 * Carriage returns are normalised to newlines by `normalizeCommentText` first.
 */
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;

// ─── Comment length bounds (issue #476) ───────────────────────────────────────

export const COMMENT_MIN_LENGTH = 1;
export const COMMENT_MAX_LENGTH = 2000;

// ─── Public API ───────────────────────────────────────────────────────────────

/** Strip bidi-override and zero-width/invisible characters before display. */
export function sanitizeDisplayText(value: string): string {
  return value.replace(BIDI_CONTROLS_RE, "").replace(ZERO_WIDTH_INVIS_RE, "");
}

/** True if the string contains any bidi-control or zero-width/invisible character. */
export function containsDangerousUnicode(value: string): boolean {
  // Fresh non-global tests: a /g regex's `.test` is stateful via `lastIndex`.
  return /[‪-‮⁦-⁩​-‍﻿­]/.test(value);
}

// ─── Confusables / mixed scripts (address-poisoning defence) ──────────────────

/**
 * Lookalike → ASCII skeleton map. This is a documented, SUFFICIENT SUBSET of
 * UTS #39 confusables covering the Cyrillic and Greek letters most commonly
 * used to spoof Latin labels. It is NOT the full confusables table: scripts or
 * lookalikes outside this set are not normalised.
 */
const CONFUSABLES: Readonly<Record<string, string>> = {
  // Cyrillic
  "а": "a", "в": "b", "с": "c", "е": "e", "һ": "h",
  "і": "i", "ј": "j", "к": "k", "ӏ": "l", "м": "m",
  "н": "h", "о": "o", "р": "p", "ѕ": "s", "т": "t",
  "у": "y", "х": "x", "ԁ": "d", "ԛ": "q", "ԝ": "w",
  "А": "A", "В": "B", "С": "C", "Е": "E", "Н": "H",
  "І": "I", "Ј": "J", "К": "K", "М": "M", "О": "O",
  "Р": "P", "Ѕ": "S", "Т": "T", "Х": "X", "У": "Y",
  // Greek
  "α": "a", "β": "b", "ε": "e", "ι": "i", "κ": "k",
  "ν": "v", "ο": "o", "ρ": "p", "τ": "t", "υ": "u",
  "χ": "x", "ω": "w",
  "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z", "Η": "H",
  "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O",
  "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X",
};

/**
 * Canonical skeleton for comparing labels: NFKC, invisible/bidi characters
 * removed, known Cyrillic/Greek lookalikes mapped to Latin, case-folded.
 * Two labels with equal skeletons are visually confusable.
 */
export function confusableSkeleton(value: string): string {
  let out = "";
  for (const ch of sanitizeDisplayText(value).normalize("NFKC")) out += CONFUSABLES[ch] ?? ch;
  return out.toLowerCase();
}

type Script = "latin" | "cyrillic" | "greek";

function scriptOf(ch: string): Script | null {
  if (/\p{Script=Latin}/u.test(ch)) return "latin";
  if (/\p{Script=Cyrillic}/u.test(ch)) return "cyrillic";
  if (/\p{Script=Greek}/u.test(ch)) return "greek";
  return null;
}

/**
 * True when the string mixes letters from more than one of Latin, Cyrillic and
 * Greek — the combination used for homoglyph spoofing. Single-script text
 * (including wholly non-Latin names) and digits/punctuation never flag.
 */
export function hasMixedScripts(value: string): boolean {
  const seen = new Set<Script>();
  for (const ch of value) {
    const script = scriptOf(ch);
    if (script) seen.add(script);
    if (seen.size > 1) return true;
  }
  return false;
}

// ─── Comment canonicalisation (issue #476) ────────────────────────────────────

/**
 * Canonicalise comment text before it is hashed for signature verification
 * (see docs/message-signing.md): NFC, CRLF/CR → LF, strip bidi/zero-width,
 * drop C0/C1 controls except tab and newline, trim.
 */
export function normalizeCommentText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(BIDI_CONTROLS_RE, "")
    .replace(ZERO_WIDTH_INVIS_RE, "")
    .replace(CONTROL_CHARS_RE, "")
    .trim();
}

/** Display-ready comment text; matches exactly what was signed. */
export function sanitizeCommentForDisplay(value: string): string {
  return normalizeCommentText(value);
}

/** True when `value` satisfies the 1–2,000 character bounds after canonicalisation. */
export function isValidCommentLength(value: string): boolean {
  const length = normalizeCommentText(value).length;
  return length >= COMMENT_MIN_LENGTH && length <= COMMENT_MAX_LENGTH;
}
