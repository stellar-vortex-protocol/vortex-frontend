# Dependency policy

How dependency updates are grouped, scheduled, reviewed, merged and patched in this repository.

Related files:

- `.github/dependabot.yml`: update schedule, groups and ignore rules
- `.github/workflows/dependabot-automerge.yml`: classifies Dependabot PRs and arms auto-merge or requests review
- `scripts/dependency-policy.mjs`: `classifyUpdate(pkg, from, to, type)` → `auto | review | block`
- `scripts/check-dependencies.mjs`: provenance check for PR dependency changes (`--report` writes JSON)
- `.github/workflows/npm-audit-summary.yml`: weekly `npm audit` summary issue
- `SECURITY.md`: how to report vulnerabilities

## Update grouping and schedule

Dependabot runs weekly on Mondays at 06:00 UTC, for npm and GitHub Actions.

| Group | Matches | Update types | Merge path |
| --- | --- | --- | --- |
| `stellar` | `@stellar/*` | any non-ignored | human review |
| `next-react` | `next`, `react`, `react-dom`, `@types/react*`, `eslint-config-next` | any | human review |
| `testing` | `vitest`, `@vitest/*`, `jsdom`, `fast-check`, `@testing-library/*`, `@playwright/test` (dev only) | minor, patch | auto-merge candidate |
| `dev-tooling` | all other dev dependencies | minor, patch | auto-merge candidate |
| `production-minor-and-patch` | all other production dependencies | minor, patch | human review |
| (ungrouped) | any major update | major | human review, one PR per package |
| `github-actions` | all actions | any | human review (workflows are in CODEOWNERS) |

Dependabot assigns each dependency to the first matching group, so the order in `dependabot.yml` matters.

## Ignore rules

| Dependency | Ignored | Reason |
| --- | --- | --- |
| `@types/node` | major | Must track the runtime in `.nvmrc`. Bump deliberately with the Node upgrade. |
| `@stellar/stellar-sdk` | major | Needs a compatibility pass with contract ABIs and wallet adapters. Plan it as a task. |
| `@stellar/freighter-api` | major | Same as above, for wallet integration. |

Ignored updates are not opened as PRs. Remove the rule to re-enable them.

## Auto-merge criteria

`classifyUpdate` decides each update independently. A PR is auto-merged only if every update in it is `auto`.

| Condition | Decision |
| --- | --- |
| Version cannot be parsed, or the update is a downgrade | `block` |
| Prerelease target version | `review` |
| Package matches `@stellar/*`, `next`, `react`, `react-dom` | `review` |
| Production dependency (including transitive) | `review` |
| Major bump | `review` |
| Pre-1.0 minor bump (`0.x`) | `review` |
| Dev-only, stable, minor or patch | `auto` |

`auto` PRs get `gh pr merge --auto --squash`. GitHub merges them once every required check in branch protection passes. Auto-merge requires branch protection with required status checks, and the repository setting "Allow auto-merge" must be on.

`review` and `block` PRs get the `dependencies:review-required` label and a checklist comment. The checklist covers:

- changelog and release notes (npm version page linked)
- `package-lock.json` diff
- install-script changes (`preinstall`, `install`, `postinstall`)
- provenance status on the npm page, or `npm audit signatures` locally
- peer dependency changes
- wallet and signing behaviour for crypto-related packages

## Security model for the auto-merge workflow

The workflow runs on `pull_request_target`, which has a write-scoped token and access to secrets. It therefore:

- never checks out or executes code from the pull request
- reads PR metadata only through `dependabot/fetch-metadata`
- downloads `scripts/dependency-policy.mjs` from the **base** commit through the API, so a PR cannot change its own policy
- runs only for PRs opened by `dependabot[bot]`
- uses `permissions: {}` at the top level and grants only `contents: write` and `pull-requests: write` to the job

Do not add a `checkout` of the PR head to this workflow. Changes to it go through CODEOWNERS review.

## Security SLAs

Response times run from the date an advisory is published against a dependency we ship or use in CI.

| Severity (npm audit) | Target to patch or mitigate |
| --- | --- |
| Critical | 7 days |
| High | 30 days |
| Moderate | 90 days |
| Low | next scheduled update cycle |

If no fixed version exists, record the risk in an issue labelled `security` with a mitigation or an accepted-risk decision. Accepted risks are reviewed each quarter.

The weekly `npm audit` summary issue (label `dependency-audit`) is the tracking point. It is updated every Monday by `npm-audit-summary.yml`.

## Emergency update runbook

Use this for a critical advisory on a runtime dependency, or any advisory being actively exploited.

1. **Triage (same day).** Confirm the affected version range and whether our code path reaches the vulnerable function. Record the findings in a `security` issue. Do not put exploit details in a public PR.
2. **Patch branch.** Branch from `main`. Bump only the affected package to the first fixed version, with `npm install <pkg>@<version>`. Do not run `npm audit fix` across the tree.
3. **Verify.** Run `npm run lint`, `npm run typecheck`, `npm run test` and `npm run build`. Check the lockfile diff for unrelated changes.
4. **Expedited review.** Open the PR with the `dependencies:review-required` label and ask a CODEOWNERS maintainer for review. Mention the security issue in the description.
5. **Release.** Merge once approved and CI is green. Deploy using the normal pipeline.
6. **Follow up.** Close the security issue with the fixed version. If the fix was blocked, record the mitigation and the date to revisit.

If the affected package is a Dependabot-managed dev dependency, the same steps apply. The auto-merge path is not a substitute for triage.

## Known gaps

These are not yet automated. They are checked by hand during review:

- maintainer or ownership change detection for packages (depends on registry data we do not fetch in CI)
- license policy enforcement (flagged in `dependency-diff-report.mjs`, not blocked)
- install-script diff against the previous version (checklist item only)

## Changing this policy

Update `dependabot.yml`, `dependency-policy.mjs`, and this document in the same PR. CODEOWNERS covers all three.
