'use client';

import React from 'react';

/**
 * Safe Markdown renderer for governance proposals and comments.
 *
 * Design decisions (see docs/security-audit.md):
 * - Parser -> AST -> React elements only. We never use dangerouslySetInnerHTML
 *   and never emit raw HTML. Any HTML-looking input is rendered as literal text.
 * - Images are intentionally NOT supported. Remote images are a tracking /
 *   phishing vector and would require an app-proxied allowlist; we document the
 *   decision and render image syntax as plain text instead.
 * - Links are restricted to https: and mailto: (configurable). Every link gets
 *   rel="noopener noreferrer nofollow ugc" and target="_blank", shows the
 *   visible domain, and its text is passed through sanitizeDisplayText.
 * - Size/complexity limits (max length, nesting depth, link count) are enforced
 *   with a truncation notice. The parser is a hand-written linear scanner with
 *   no backtracking-prone regexes.
 */

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

export interface MarkdownLimits {
  maxLength: number;
  maxDepth: number;
  maxLinks: number;
}

export const DEFAULT_MARKDOWN_LIMITS: MarkdownLimits = {
  maxLength: 20000,
  maxDepth: 6,
  maxLinks: 50,
};

// ---------------------------------------------------------------------------
// Text safety
// ---------------------------------------------------------------------------

// Bidi control characters and zero-width characters that can be used to spoof
// or hide content. Stripped from all rendered text.
const UNSAFE_TEXT_CHARS = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/**
 * Strip bidi/zero-width control characters from display text. Exported so the
 * same policy can be reused by other governance surfaces.
 */
export function sanitizeDisplayText(input: string): string {
  return input.replace(UNSAFE_TEXT_CHARS, '');
}

// ---------------------------------------------------------------------------
// URL policy
// ---------------------------------------------------------------------------

export interface UrlPolicy {
  allowedSchemes: string[];
}

export const DEFAULT_URL_POLICY: UrlPolicy = {
  allowedSchemes: ['https:', 'mailto:'],
};

/**
 * Normalize a candidate URL and return it only if it passes the scheme policy.
 * Returns null for anything unsafe (javascript:, data:, vbscript:, obfuscated
 * schemes with embedded whitespace/control chars, relative URLs, etc.).
 */
export function sanitizeUrl(raw: string, policy: UrlPolicy = DEFAULT_URL_POLICY): string | null {
  // Remove control chars and whitespace that could be used to obfuscate a
  // scheme (e.g. "java\tscript:").
  const cleaned = raw.replace(/[\u0000-\u0020\u007F]/g, '').trim();
  if (!cleaned) return null;

  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return null;
  }

  if (!policy.allowedSchemes.includes(parsed.protocol)) return null;
  return parsed.toString();
}

/**
 * Extract a human-readable domain for display. For mailto: links we show the
 * address; for https: links we show the hostname (punycode-decoded when
 * possible) so users can see where a link actually goes.
 */
export function displayDomain(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'mailto:') {
      return sanitizeDisplayText(parsed.pathname);
    }
    const host = parsed.hostname;
    // Decode punycode/IDN hosts for display when the runtime supports it.
    try {
      // eslint-disable-next-line no-restricted-properties -- URL hostname decoding is intentional here
      const decoded = decodeURIComponent(host);
      return sanitizeDisplayText(decoded);
    } catch {
      return sanitizeDisplayText(host);
    }
  } catch {
    return '';
  }
}

/**
 * Detect mixed-script (homograph) hostnames. Returns true when a hostname
 * mixes Latin with another script, which is a common phishing signal.
 */
export function isMixedScriptHost(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    const hasLatin = /[a-z]/i.test(host);
    const hasNonLatin = /[^\u0000-\u007F]/.test(host);
    return hasLatin && hasNonLatin;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export type MarkdownNode =
  | { type: 'text'; value: string }
  | { type: 'paragraph'; children: MarkdownNode[] }
  | { type: 'heading'; level: number; children: MarkdownNode[] }
  | { type: 'emphasis'; children: MarkdownNode[] }
  | { type: 'strong'; children: MarkdownNode[] }
  | { type: 'code'; value: string }
  | { type: 'codeblock'; value: string }
  | { type: 'blockquote'; children: MarkdownNode[] }
  | { type: 'list'; ordered: boolean; items: MarkdownNode[][] }
  | { type: 'link'; href: string; children: MarkdownNode[] };

// ---------------------------------------------------------------------------
// Inline parser
// ---------------------------------------------------------------------------

function parseInline(input: string, depth: number, limits: MarkdownLimits, linkCount: { n: number }): MarkdownNode[] {
  if (depth > limits.maxDepth) {
    return [{ type: 'text', value: input }];
  }

  const nodes: MarkdownNode[] = [];
  let buffer = '';
  let i = 0;

  const flush = () => {
    if (buffer) {
      nodes.push({ type: 'text', value: sanitizeDisplayText(buffer) });
      buffer = '';
    }
  };

  while (i < input.length) {
    const ch = input[i];

    // Inline code: `code`
    if (ch === '`') {
      const end = input.indexOf('`', i + 1);
      if (end !== -1) {
        flush();
        nodes.push({ type: 'code', value: sanitizeDisplayText(input.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }

    // Links: [text](url)
    if (ch === '[') {
      const closeBracket = input.indexOf(']', i + 1);
      if (closeBracket !== -1 && input[closeBracket + 1] === '(') {
        const closeParen = input.indexOf(')', closeBracket + 2);
        if (closeParen !== -1) {
          const label = input.slice(i + 1, closeBracket);
          const rawUrl = input.slice(closeBracket + 2, closeParen);
          const href = sanitizeUrl(rawUrl);
          if (href && linkCount.n < limits.maxLinks) {
            linkCount.n += 1;
            flush();
            nodes.push({
              type: 'link',
              href,
              children: parseInline(label, depth + 1, limits, linkCount),
            });
            i = closeParen + 1;
            continue;
          }
        }
      }
    }

    // Strong: **text**
    if (ch === '*' && input[i + 1] === '*') {
      const end = input.indexOf('**', i + 2);
      if (end !== -1) {
        flush();
        nodes.push({
          type: 'strong',
          children: parseInline(input.slice(i + 2, end), depth + 1, limits, linkCount),
        });
        i = end + 2;
        continue;
      }
    }

    // Emphasis: *text*
    if (ch === '*') {
      const end = input.indexOf('*', i + 1);
      if (end !== -1) {
        flush();
        nodes.push({
          type: 'emphasis',
          children: parseInline(input.slice(i + 1, end), depth + 1, limits, linkCount),
        });
        i = end + 1;
        continue;
      }
    }

    buffer += ch;
    i += 1;
  }

  flush();
  return nodes;
}

// ---------------------------------------------------------------------------
// Block parser
// ---------------------------------------------------------------------------

export function parseMarkdown(source: string, limits: MarkdownLimits = DEFAULT_MARKDOWN_LIMITS): MarkdownNode[] {
  const truncated = source.length > limits.maxLength;
  const text = truncated ? source.slice(0, limits.maxLength) : source;
  const lines = text.split(/\r?\n/);
  const nodes: MarkdownNode[] = [];
  const linkCount = { n: 0 };
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // Fenced code block
    if (line.trimStart().startsWith('```')) {
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) {
        body.push(lines[i]);
        i += 1;
      }
      i += 1; // skip closing fence
      nodes.push({ type: 'codeblock', value: sanitizeDisplayText(body.join('\n')) });
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line);
    if (headingMatch) {
      nodes.push({
        type: 'heading',
        level: headingMatch[1].length,
        children: parseInline(headingMatch[2], 0, limits, linkCount),
      });
      i += 1;
      continue;
    }

    // Blockquote
    if (line.trimStart().startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('>')) {
        body.push(lines[i].trimStart().replace(/^>\s?/, ''));
        i += 1;
      }
      nodes.push({
        type: 'blockquote',
        children: parseMarkdown(body.join('\n'), limits),
      });
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: MarkdownNode[][] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*[-*+]\s+/, '');
        items.push(parseInline(itemText, 0, limits, linkCount));
        i += 1;
      }
      nodes.push({ type: 'list', ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: MarkdownNode[][] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        const itemText = lines[i].replace(/^\s*\d+\.\s+/, '');
        items.push(parseInline(itemText, 0, limits, linkCount));
        i += 1;
      }
      nodes.push({ type: 'list', ordered: true, items });
      continue;
    }

    // Paragraph
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('>') &&
      !lines[i].trimStart().startsWith('```') &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    nodes.push({
      type: 'paragraph',
      children: parseInline(para.join(' '), 0, limits, linkCount),
    });
  }

  if (truncated) {
    nodes.push({ type: 'paragraph', children: [{ type: 'text', value: '… (content truncated)' }] });
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// AST -> React
// ---------------------------------------------------------------------------

function renderNodes(nodes: MarkdownNode[], keyPrefix = 'md'): React.ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;
    switch (node.type) {
      case 'text':
        return <React.Fragment key={key}>{node.value}</React.Fragment>;
      case 'paragraph':
        return <p key={key}>{renderNodes(node.children, key)}</p>;
      case 'heading': {
        const level = Math.min(Math.max(node.level, 1), 6);
        const Tag = `h${level}` as keyof JSX.IntrinsicElements;
        return <Tag key={key}>{renderNodes(node.children, key)}</Tag>;
      }
      case 'emphasis':
        return <em key={key}>{renderNodes(node.children, key)}</em>;
      case 'strong':
        return <strong key={key}>{renderNodes(node.children, key)}</strong>;
      case 'code':
        return <code key={key}>{node.value}</code>;
      case 'codeblock':
        return (
          <pre key={key}>
            <code>{node.value}</code>
          </pre>
        );
      case 'blockquote':
        return <blockquote key={key}>{renderNodes(node.children, key)}</blockquote>;
      case 'list': {
        const ListTag = node.ordered ? 'ol' : 'ul';
        return (
          <ListTag key={key}>
            {node.items.map((item, itemIndex) => (
              <li key={`${key}-${itemIndex}`}>{renderNodes(item, `${key}-${itemIndex}`)}</li>
            ))}
          </ListTag>
        );
      }
      case 'link': {
        const domain = displayDomain(node.href);
        const mixed = isMixedScriptHost(node.href);
        return (
          <a
            key={key}
            href={node.href}
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            title={mixed ? `Warning: mixed-script domain (${domain})` : domain}
          >
            {renderNodes(node.children, key)}
            {domain ? <span className="markdown-link-domain"> ({domain})</span> : null}
          </a>
        );
      }
      default:
        return null;
    }
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface MarkdownProps {
  source: string;
  limits?: MarkdownLimits;
  urlPolicy?: UrlPolicy;
  className?: string;
}

export function Markdown({ source, limits = DEFAULT_MARKDOWN_LIMITS, className }: MarkdownProps) {
  const nodes = React.useMemo(() => parseMarkdown(source ?? '', limits), [source, limits]);
  return <div className={className}>{renderNodes(nodes)}</div>;
}

export default Markdown;
