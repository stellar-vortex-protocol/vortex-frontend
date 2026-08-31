## Summary

<!-- What does this PR do? Link the relevant issue(s). -->

Closes #

## Changes

<!-- Bullet-point the key changes. -->

-

## Testing & QA

<!-- Describe how you tested this. Paste relevant test output, screenshots, or staging demo links. -->

- [ ] `npm run check:editorconfig` passes
- [ ] `npm run typecheck` (`tsc --noEmit`) passes cleanly
- [ ] `npm test` and `npm run test:coverage` pass
- [ ] `npm run build` passes
- [ ] Verified on local / staging environment with seeded data (where applicable)

## Preview

🚀 **Live Preview**: A staging preview will automatically deploy once CI completes. The preview URL will appear as a comment below. Visit it to visually review your changes against the staging backend.

> **Note**: Fork PRs cannot use preview deployments for security reasons. Please run `npm run dev` locally to test.

## Checklist

- [ ] Self-reviewed the diff
- [ ] Formatting adheres to `.editorconfig`
- [ ] Added or updated tests for new behaviour
- [ ] No secrets or credentials committed (used `.env.example` / `.env.staging.example` templates)
- [ ] PR title follows conventional commits (`feat:`, `fix:`, `chore:`, etc.)
