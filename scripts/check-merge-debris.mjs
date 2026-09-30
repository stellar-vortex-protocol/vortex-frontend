#!/usr/bin/env node
/**
 * Merge-debris guard.
 *
 * Detects leftover merge-conflict debris that silently breaks `main`:
 *   1. Conflict markers (<<<<<<<, =======, >>>>>>>) in tracked files.
 *   2. Duplicate keys in package.json / JSON configs (JSON.parse drops them).
 *   3. Duplicate top-level declarations in TS files via the TypeScript AST
 *      (const/function/type/interface and duplicate members in a type literal).
 *
 * Runs in well under 5s on the full repo. Exits non-zero on any finding.
 * Out of scope: auto-fixing conflicts.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const CONFLICT_MARKER = /^(<{7}|={7}|>{7})(\s|$)/;
const JSON_EXT = new Set(['.json']);
const TS_EXT = new Set(['.ts', '.tsx', '.mts', '.cts']);
const SKIP_DIRS = /(^|\/)(node_modules|dist|build|\.next|coverage|out)(\/|$)/;

/** @type {{file: string, line: number, message: string, suggestion: string}[]} */
const problems = [];

function report(file, line, message, suggestion) {
  problems.push({ file, line, message, suggestion });
}

function trackedFiles() {
  const out = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' });
  return out.split('\0').filter(Boolean);
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function checkConflictMarkers(file, text) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (CONFLICT_MARKER.test(lines[i])) {
      report(
        file,
        i + 1,
        `conflict marker "${lines[i].slice(0, 7)}" found`,
        'Resolve the conflict and remove all <<<<<<<, =======, >>>>>>> markers.',
      );
    }
  }
}

/**
 * Tokenising JSON scanner: JSON.parse silently keeps the last duplicate key,
 * so we walk the raw text and track keys per object scope.
 */
function checkJsonDuplicateKeys(file, text) {
  let i = 0;
  const n = text.length;
  const stack = [];
  let line = 1;

  const advance = (count) => {
    for (let k = 0; k < count; k += 1) {
      if (text[i] === '\n') line += 1;
      i += 1;
    }
  };

  const skipWs = () => {
    while (i < n && /\s/.test(text[i])) advance(1);
  };

  const readString = () => {
    let value = '';
    advance(1); // opening quote
    while (i < n) {
      const ch = text[i];
      if (ch === '\\') {
        value += text[i + 1] ?? '';
        advance(2);
        continue;
      }
      if (ch === '"') {
        advance(1);
        break;
      }
      value += ch;
      advance(1);
    }
    return value;
  };

  while (i < n) {
    skipWs();
    if (i >= n) break;
    const ch = text[i];

    if (ch === '{') {
      stack.push({ keys: new Map(), expectKey: true });
      advance(1);
      continue;
    }
    if (ch === '}') {
      stack.pop();
      advance(1);
      continue;
    }
    if (ch === '[') {
      stack.push(null);
      advance(1);
      continue;
    }
    if (ch === ']') {
      stack.pop();
      advance(1);
      continue;
    }
    if (ch === '"') {
      const startLine = line;
      const value = readString();
      skipWs();
      const scope = stack[stack.length - 1];
      if (scope && text[i] === ':') {
        if (scope.keys.has(value)) {
          report(
            file,
            startLine,
            `duplicate JSON key "${value}" (first seen on line ${scope.keys.get(value)})`,
            'Remove the duplicate key; JSON keeps only the last occurrence.',
          );
        } else {
          scope.keys.set(value, startLine);
        }
      }
      continue;
    }
    advance(1);
  }
}

function checkTsDuplicateDeclarations(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const seen = new Map();

  const record = (name, node) => {
    if (!name) return;
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
    if (seen.has(name)) {
      report(
        file,
        line + 1,
        `duplicate top-level declaration "${name}" (first seen on line ${seen.get(name)})`,
        'Remove the duplicate declaration left over from a merge.',
      );
    } else {
      seen.set(name, line + 1);
    }
  };

  for (const stmt of source.statements) {
    if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) record(decl.name.text, decl);
      }
    } else if (
      (ts.isFunctionDeclaration(stmt) ||
        ts.isClassDeclaration(stmt) ||
        ts.isTypeAliasDeclaration(stmt) ||
        ts.isInterfaceDeclaration(stmt) ||
        ts.isEnumDeclaration(stmt)) &&
      stmt.name
    ) {
      record(stmt.name.text, stmt);
    }

    if (ts.isTypeLiteralNode(stmt) || ts.isInterfaceDeclaration(stmt)) {
      const members = new Map();
      for (const member of stmt.members) {
        if (!member.name || !ts.isIdentifier(member.name)) continue;
        const key = member.name.text;
        const { line } = source.getLineAndCharacterOfPosition(member.getStart(source));
        if (members.has(key)) {
          report(
            file,
            line + 1,
            `duplicate member "${key}" in type literal (first seen on line ${members.get(key)})`,
            'Remove the duplicate member left over from a merge.',
          );
        } else {
          members.set(key, line + 1);
        }
      }
    }
  }
}

function main() {
  const files = trackedFiles();
  for (const file of files) {
    if (SKIP_DIRS.test(file)) continue;
    const ext = path.extname(file);
    const text = readText(file);
    if (text === null) continue;

    checkConflictMarkers(file, text);
    if (JSON_EXT.has(ext)) checkJsonDuplicateKeys(file, text);
    if (TS_EXT.has(ext)) checkTsDuplicateDeclarations(file, text);
  }

  if (problems.length === 0) {
    process.stdout.write('check-merge-debris: no merge debris found.\n');
    return;
  }

  for (const p of problems) {
    process.stderr.write(`${p.file}:${p.line}: ${p.message}\n  -> ${p.suggestion}\n`);
  }
  process.stderr.write(`\ncheck-merge-debris: ${problems.length} problem(s) found.\n`);
  process.exitCode = 1;
}

main();
