# Visual Regression Test Baselines

This directory contains baseline screenshots used for visual regression testing via Playwright and the Storybook test-runner.

## Files

- `*.spec.ts` - Generated test files for Storybook stories
- `__screenshots__/` - Baseline screenshots for comparison (auto-generated and committed)

## Managing Baselines

### Updating Baseline Images

When you intentionally change component styles or add new stories:

```bash
npm run build:storybook
npm run test:visual -- --update
```

This updates the baseline images. Always review the changes in git before committing:

```bash
git diff .storybook/playwright/
```

### Regenerating All Baselines

If you encounter font rendering differences between local and CI environments, regenerate baselines in the CI environment:

1. Run visual tests in CI (GitHub Actions)
2. Download the visual regression report artifact
3. If baselines need updating, this is done automatically in CI to ensure consistent font rendering

## CI Integration

- Baselines are generated in the CI environment to avoid font-rendering discrepancies
- Visual regression tests run on every build (push and PR)
- Test failures are reported and block merging until resolved
- Visual regression reports are uploaded as CI artifacts for review

## Troubleshooting

**Test failures after environment changes:**
- Font rendering may differ between systems
- Regenerate baselines in the CI environment for authoritative results
- Review visual diffs in the test report before updating

**New stories added:**
- Build Storybook, run visual tests, and update baselines
- Commit baseline images with your story changes
