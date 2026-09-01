# Link Checking CI Workflow

This document describes the automated link checking system implemented to catch broken documentation links.

## Overview

The link-checking workflow validates all markdown files in the repository for broken internal (relative file paths) and external (HTTP/HTTPS) links. It helps maintain documentation quality by catching link rot early.

## Workflow Configuration

### Files

- `.github/workflows/link-check.yml` — Main workflow definition
- `.github/workflows/mlc-config.json` — Configuration for internal-only link checks (PR checks)
- `.github/workflows/mlc-config-external.json` — Configuration for external link checks (scheduled checks)

### When Links Are Checked

**Internal Links (Every PR + Push to main)**
- Runs on every pull request and push to main
- Checks all relative file path links (e.g., `[link](./docs/file.md)`)
- Fast and reliable — no external dependencies
- Blocks PR if broken internal links are found

**External Links (Weekly Schedule)**
- Runs on Mondays at 09:00 UTC (configurable in `cron` expression)
- Checks all HTTP/HTTPS links (e.g., `[link](https://example.com)`)
- Includes retries (3x) and longer timeouts to handle flakiness from external sites
- Does NOT block PRs (to avoid external site flakiness blocking merges)
- Creates an issue if broken external links are found

### Configuration Details

**Internal Link Check (`mlc-config.json`)**
- Ignores all external URLs (`^http` pattern)
- No retries (filesystem checks are deterministic)
- 10-second timeout

**External Link Check (`mlc-config-external.json`)**
- Includes all external links
- 3 retries with 1-second fallback delay
- 15-second timeout
- Handles rate-limiting (429) and service errors (503)

## Testing Locally

To test the link checker locally:

```bash
# Install the tool (already in devDependencies)
npm install

# Test internal links only
npx markdown-link-check README.md docs/*.md CHANGELOG.md \
  --config .github/workflows/mlc-config.json

# Test external links with retries
npx markdown-link-check README.md docs/*.md CHANGELOG.md \
  --config .github/workflows/mlc-config-external.json
```

## Adding New Documentation

When adding new markdown files:

1. Ensure all relative links use proper paths (e.g., `./docs/file.md` from root, or `../src/component.tsx` from docs/)
2. The PR workflow will automatically check internal links
3. External links will be validated weekly

## Fixing Broken Links

If the weekly external link check finds broken links:

1. An issue will be created automatically in the repository
2. Review the linked workflow run for details
3. Update the affected links in the documentation
4. The issue will be automatically resolved once links are fixed and the next scheduled check passes

## Edge Cases

- **Anchor links** — Currently, the link checker does not validate anchor links (e.g., `#section`). These should be manually reviewed.
- **Dynamic URLs** — Some services may return different status codes depending on user-agent or time. The retries help mitigate this.
- **Rate limiting** — GitHub and other large services sometimes rate-limit requests. The external link check is configured to handle this gracefully.

## See Also

- `gaurav-nelson/github-action-markdown-link-check` — The underlying GitHub Action used for checking
- `markdown-link-check` — The CLI tool that powers the action
