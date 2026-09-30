import { domainToASCII, domainToUnicode } from "node:url";
import { isIP } from "node:net";

/**
 * Normalise a user-supplied home domain. Returns the ASCII (punycode) form
 * used for fetching plus the Unicode form for display, or null when the input
 * is not a plain public hostname (IP literals, ports, paths, single labels,
 * and invalid IDNs are rejected).
 */
export function normalizeDomain(input: string | null): { ascii: string; unicode: string } | null {
  if (!input) return null;
  const trimmed = input.trim().replace(/\.$/, "");
  if (!trimmed || trimmed.length > 253 || /[/:@?#\s\\]/.test(trimmed)) return null;
  const ascii = domainToASCII(trimmed).toLowerCase();
  if (!ascii || isIP(ascii) || isIP(trimmed)) return null;
  const labels = ascii.split(".");
  if (labels.length < 2) return null;
  const label = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
  if (!labels.every((l) => label.test(l))) return null;
  if (/^\d+$/.test(labels[labels.length - 1] ?? "")) return null;
  return { ascii, unicode: domainToUnicode(ascii) || ascii };
}
