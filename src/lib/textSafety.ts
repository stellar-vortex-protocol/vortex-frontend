/**
 * Text safety utilities.
 *
 * These helpers sanitise untrusted strings before they are rendered or
 * logged. Historically the bidi handling stripped *all* Unicode bidi
 * control characters, which also removed legitimate right-to-left
 * letters (Arabic / Hebrew) and broke RTL content. The helpers below
 * only strip the invisible bidi *control* characters (UAX #9) while
 * preserving real RTL letters, and expose an isolation helper so that
 * mixed-direction content (addresses, hashes, amounts, code) can be
 * rendered without leaking direction into surrounding text.
 */

/**
 * Unicode bidi control characters (UAX #9) that are invisible and can be
 * abused for spoofing. These are safe to strip because they carry no
 * visible glyphs.
 *
 * NOTE: This intentionally does NOT include Arabic/Hebrew letters or any
 * other visible RTL characters.
 */
const BIDI_CONTROL_CHARS =
  /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/**
 * Matches any visible right-to-left character (Arabic, Hebrew, Syriac,
 * Thaana, NKo, and the Arabic/Hebrew presentation forms). Used to detect
 * whether a string legitimately contains RTL content.
 */
const RTL_CHARS =
  /[\u0591-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/**
 * Removes invisible bidi control characters from a string while keeping
 * legitimate RTL letters intact.
 */
export function stripBidiControls(input: string): string {
  if (typeof input !== "string") {
    return "";
  }
  return input.replace(BIDI_CONTROL_CHARS, "");
}

/**
 * Returns true when the string contains at least one visible RTL
 * character. Useful for deciding whether a value needs bidi isolation.
 */
export function containsRtl(input: string): boolean {
  if (typeof input !== "string") {
    return false;
  }
  return RTL_CHARS.test(input);
}

/**
 * Wraps mixed-direction content in Unicode isolate characters so that it
 * does not leak direction into surrounding text. This is the string
 * equivalent of rendering the value inside a `<bdi>` element.
 *
 * The isolate characters are added around the (control-stripped) value
 * and are themselves invisible, so the visible output is unchanged.
 */
export function isolateBidi(input: string): string {
  const safe = stripBidiControls(input);
  if (safe.length === 0) {
    return safe;
  }
  return `\u2068${safe}\u2069`;
}

/**
 * Sanitises a user-supplied string for safe rendering/logging.
 *
 * Strips invisible bidi control characters but preserves legitimate
 * RTL letters (Arabic / Hebrew) so that RTL content is not corrupted.
 */
export function sanitizeText(input: string): string {
  return stripBidiControls(input);
}

export default sanitizeText;
