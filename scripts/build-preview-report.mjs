#!/usr/bin/env node
/**
 * Builds the consolidated PR preview report comment for issue #507.
 *
 * Reads the artifacts produced by the preview pipeline (smoke e2e, Lighthouse,
 * visual diff, bundle size) and renders a single sticky markdown comment that
 * is updated in place via an HTML marker.
 *
 * Usage:
 *   node scripts/build-preview-report.mjs \
 *     --preview-url https://... \
 *     --smoke-status success \
 *     --lighthouse-status success \
 *     --visual-status success \
 *     --bundle-status success \
 *     --artifacts-dir ./preview-artifacts \
 *     --out ./preview-report.md
 *
 * All inputs are optional; missing data degrades gracefully so the comment is
 * still useful when a job is skipped or fails early.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const MARKER = '<!-- preview-report -->';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = 'true';
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

function readJson(path) {
  if (!path || !existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function statusIcon(status) {
  switch ((status || '').toLowerCase()) {
    case 'success':
      return '\u2705';
    case 'failure':
      return '\u274c';
    case 'skipped':
      return '\u23ed\ufe0f';
    case 'cancelled':
      return '\u26d4';
    default:
      return '\u2753';
  }
}

function formatDelta(value, unit = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value}${unit}`;
}

function formatBytes(bytes) {
  if (bytes === null || bytes === undefined || Number.isNaN(bytes)) return 'n/a';
  const sign = bytes > 0 ? '+' : '';
  const abs = Math.abs(bytes);
  if (abs < 1024) return `${sign}${bytes} B`;
  if (abs < 1024 * 1024) return `${sign}${(bytes / 1024).toFixed(1)} KB`;
  return `${sign}${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderLighthouse(lighthouse) {
  if (!lighthouse || !Array.isArray(lighthouse.routes) || lighthouse.routes.length === 0) {
    return '_Lighthouse results unavailable._';
  }
  const lines = [
    '| Route | Perf | A11y | Best Practices | SEO |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const route of lighthouse.routes) {
    const scores = route.scores || {};
    const delta = (key) => {
      const base = route.baseline && route.baseline[key];
      const current = scores[key];
      if (base === undefined || current === undefined) return '';
      const diff = current - base;
      if (diff === 0) return '';
      return ` (${diff > 0 ? '+' : ''}${diff})`;
    };
    lines.push(
      `| \`${route.path}\` | ${scores.performance ?? 'n/a'}${delta('performance')} | ${scores.accessibility ?? 'n/a'}${delta('accessibility')} | ${scores['best-practices'] ?? 'n/a'}${delta('best-practices')} | ${scores.seo ?? 'n/a'}${delta('seo')} |`,
    );
  }
  return lines.join('\n');
}

function renderVisual(visual) {
  if (!visual || !Array.isArray(visual.routes) || visual.routes.length === 0) {
    return '_Visual diff results unavailable._';
  }
  const lines = ['| Route | Result |', '| --- | --- |'];
  for (const route of visual.routes) {
    const changed = route.changed === true;
    lines.push(`| \`${route.path}\` | ${changed ? '\u{1f5bc}\ufe0f changed' : '\u2705 unchanged'} |`);
  }
  return lines.join('\n');
}

function renderBundle(bundle) {
  if (!bundle || bundle.deltaBytes === undefined) {
    return '_Bundle size delta unavailable._';
  }
  const pct = bundle.deltaPercent !== undefined ? ` (${formatDelta(bundle.deltaPercent, '%')})` : '';
  return `Bundle size delta vs \`main\`: **${formatBytes(bundle.deltaBytes)}**${pct}`;
}

function buildReport(args) {
  const previewUrl = args['preview-url'] || '';
  const smokeStatus = args['smoke-status'] || 'unknown';
  const lighthouseStatus = args['lighthouse-status'] || 'unknown';
  const visualStatus = args['visual-status'] || 'unknown';
  const bundleStatus = args['bundle-status'] || 'unknown';
  const artifactsDir = args['artifacts-dir'] ? resolve(args['artifacts-dir']) : null;
  const runUrl = args['run-url'] || '';

  const lighthouse = readJson(artifactsDir ? resolve(artifactsDir, 'lighthouse.json') : null);
  const visual = readJson(artifactsDir ? resolve(artifactsDir, 'visual-diff.json') : null);
  const bundle = readJson(artifactsDir ? resolve(artifactsDir, 'bundle-size.json') : null);

  const lines = [];
  lines.push(MARKER);
  lines.push('## \u{1f680} Preview report');
  lines.push('');
  if (previewUrl) {
    lines.push(`**Preview:** ${previewUrl}`);
  } else {
    lines.push('**Preview:** _not available_');
  }
  lines.push('');
  lines.push('| Check | Status |');
  lines.push('| --- | --- |');
  lines.push(`| Smoke e2e | ${statusIcon(smokeStatus)} ${smokeStatus} |`);
  lines.push(`| Lighthouse | ${statusIcon(lighthouseStatus)} ${lighthouseStatus} |`);
  lines.push(`| Visual diff | ${statusIcon(visualStatus)} ${visualStatus} |`);
  lines.push(`| Bundle size | ${statusIcon(bundleStatus)} ${bundleStatus} |`);
  lines.push('');
  lines.push('### Lighthouse (deltas vs `main`)');
  lines.push(renderLighthouse(lighthouse));
  lines.push('');
  lines.push('### Visual diff (vs last `main` deployment)');
  lines.push(renderVisual(visual));
  lines.push('');
  lines.push('### Bundle size');
  lines.push(renderBundle(bundle));
  lines.push('');
  lines.push('### Artifacts');
  if (runUrl) {
    lines.push(`- [Workflow run](${runUrl})`);
  }
  lines.push('- Playwright traces (uploaded on failure)');
  lines.push('- Lighthouse reports');
  lines.push('- Visual diff bundle');
  lines.push('');
  lines.push('<sub>Updated automatically on every push to this PR.</sub>');
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = buildReport(args);
  const out = args.out ? resolve(args.out) : null;
  if (out) {
    writeFileSync(out, report, 'utf8');
  } else {
    process.stdout.write(report);
  }
}

main();
