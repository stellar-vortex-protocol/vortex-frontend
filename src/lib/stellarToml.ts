import { isValidStellarPublicKey } from "./stellarAddress";

/**
 * Strict-subset stellar.toml (SEP-0001) parser.
 *
 * Only what solver identity verification needs is understood:
 *   - top-level `ACCOUNTS = ["G...", ...]` (single- or multi-line string array)
 *   - `[DOCUMENTATION]` table: `ORG_NAME`, `ORG_URL` (basic strings)
 * Everything else (other tables, `[[CURRENCIES]]`, numbers, dates, inline
 * tables) is skipped line-by-line. Malformed values are ignored rather than
 * thrown, and hard caps bound work on hostile input.
 */
export type StellarTomlIdentity = {
  accounts: string[];
  orgName: string | null;
  orgUrl: string | null;
};

const MAX_LINES = 5_000;
const MAX_ACCOUNTS = 100;
const MAX_STRING = 256;

/** Parse a TOML basic ("...") or literal ('...') string; null if malformed. */
function parseString(raw: string): string | null {
  const v = raw.trim();
  const m = /^"((?:[^"\\\n]|\\["\\nt])*)"$/.exec(v) ?? /^'([^'\n]*)'$/.exec(v);
  if (!m) return null;
  const body = m[1] ?? "";
  const out = v.startsWith('"')
    ? body.replace(/\\(["\\nt])/g, (_, c: string) => (c === "n" ? "\n" : c === "t" ? "\t" : c))
    : body;
  return out.length > MAX_STRING ? null : out;
}

function stripComment(line: string): string {
  // Remove `# ...` comments that are not inside a string.
  let inStr: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (c === "\\" && inStr === '"') i++;
      else if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'") inStr = c;
    else if (c === "#") return line.slice(0, i);
  }
  return line;
}

function parseStringArray(raw: string): string[] {
  const body = raw.trim();
  if (!body.startsWith("[") || !body.endsWith("]")) return [];
  const out: string[] = [];
  const re = /"((?:[^"\\\n]|\\.)*)"|'([^'\n]*)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) && out.length < MAX_ACCOUNTS) {
    out.push(m[1] ?? m[2] ?? "");
  }
  return out;
}

export function parseStellarToml(text: string): StellarTomlIdentity {
  const result: StellarTomlIdentity = { accounts: [], orgName: null, orgUrl: null };
  const lines = text.split(/\r?\n/).slice(0, MAX_LINES);
  let table = "";

  for (let i = 0; i < lines.length; i++) {
    const line = stripComment(lines[i] ?? "").trim();
    if (!line) continue;

    const header = /^\[\[?\s*([A-Za-z0-9_.]+)\s*\]\]?$/.exec(line);
    if (header) {
      const name = header[1] ?? "";
      table = line.startsWith("[[") ? `[[${name}]]` : name;
      continue;
    }

    const kv = /^([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1] ?? "";
    const rawValue = kv[2] ?? "";

    if (table === "" && key === "ACCOUNTS") {
      let value = rawValue;
      // Multi-line array: accumulate until the closing bracket (bounded).
      while (value.trim().startsWith("[") && !value.trim().endsWith("]") && i + 1 < lines.length) {
        value += " " + stripComment(lines[++i] ?? "").trim();
        if (value.length > MAX_ACCOUNTS * 64) break;
      }
      result.accounts = parseStringArray(value).filter(isValidStellarPublicKey);
    } else if (table === "DOCUMENTATION" && key === "ORG_NAME") {
      result.orgName = parseString(rawValue);
    } else if (table === "DOCUMENTATION" && key === "ORG_URL") {
      const url = parseString(rawValue);
      result.orgUrl = url && /^https:\/\//i.test(url) ? url : null;
    }
  }
  return result;
}
