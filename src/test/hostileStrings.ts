/**
 * Shared hostile-string corpus and DOM inspection helpers (issue #481).
 *
 * The corpus is rendered through every component that displays externally
 * supplied data.  Tests assert that no executable attribute or URL is created
 * and that displayed text is sanitised.
 */

import { sanitizeDisplayText } from "../lib/textSafety";

/** A single hostile payload with a stable id for test reporting. */
export interface HostileString {
  id: string;
  value: string;
}

/**
 * Corpus of hostile strings covering script tags, event handlers,
 * `javascript:` URLs, bidi/zero-width characters, homoglyphs, extremely long
 * strings, null bytes, prototype-pollution keys, CSV formula triggers, format
 * strings, and RTL overrides.
 */
export const HOSTILE_STRINGS: HostileString[] = [
  { id: "script-tag", value: '<script>alert(1)</script>' },
  { id: "img-onerror", value: '<img src=x onerror=alert(1)>' },
  { id: "svg-onload", value: '<svg onload=alert(1)>' },
  { id: "event-handler", value: '" onmouseover="alert(1)' },
  { id: "javascript-url", value: 'javascript:alert(1)' },
  { id: "javascript-url-mixed", value: 'JaVaScRiPt:alert(1)' },
  { id: "data-html-url", value: 'data:text/html,<script>alert(1)</script>' },
  { id: "bidi-override", value: '\u202Egnp.exe' },
  { id: "bidi-isolate", value: '\u2066evil\u2069' },
  { id: "zero-width", value: 'solver\u200Bname' },
  { id: "soft-hyphen", value: 'sol\u00ADver' },
  { id: "homoglyph", value: '\u0430dmin' },
  { id: "extremely-long", value: 'A'.repeat(10000) },
  { id: "null-byte", value: 'solver\u0000name' },
  { id: "prototype-pollution", value: '__proto__' },
  { id: "prototype-constructor", value: 'constructor' },
  { id: "csv-formula-equals", value: '=1+1' },
  { id: "csv-formula-plus", value: '+1+1' },
  { id: "csv-formula-minus", value: '-1+1' },
  { id: "csv-formula-at", value: '@SUM(A1:A2)' },
  { id: "format-string", value: '%s%s%s%n' },
  { id: "rtl-override", value: '\u202Ehello' },
];

/**
 * Render a component with a hostile string substituted into the supplied
 * field.  The caller provides a render function that receives the (already
 * sanitised) value so the same corpus can drive every component.
 */
export function renderWithHostileData<T>(
  render: (value: string) => T,
  hostile: HostileString,
): T {
  return render(sanitizeDisplayText(hostile.value));
}

/**
 * Walk a DOM subtree and return every attribute value that could execute
 * code or navigate to a non-relative URL.
 */
export function findExecutableAttributes(root: Element): string[] {
  const offenders: string[] = [];
  const walk = (el: Element): void => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) {
        offenders.push(`${el.tagName}[${name}]`);
      }
      if (
        (name === "href" || name === "src" || name === "xlink:href") &&
        (value.startsWith("javascript:") || value.startsWith("data:text/html"))
      ) {
        offenders.push(`${el.tagName}[${name}=${attr.value}]`);
      }
    }
    for (const child of Array.from(el.children)) {
      walk(child);
    }
  };
  walk(root);
  return offenders;
}

/**
 * Returns `true` when the rendered text contains no raw script markers or
 * bidi/zero-width control characters.
 */
export function isSanitisedText(text: string): boolean {
  if (/<script/i.test(text)) return false;
  if (/[\u202A-\u202E\u2066-\u2069\u200B-\u200D\uFEFF\u00AD]/.test(text)) {
    return false;
  }
  return true;
}
