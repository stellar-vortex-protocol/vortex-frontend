# Security policy

## Supported versions

This repository is under active development. Security fixes are evaluated
against the `main` branch and the latest published release, when a release is
available. Older commits and unreleased feature branches may not receive a
backport.

## Reporting a vulnerability

Please report suspected vulnerabilities privately through GitHub's **Report a
vulnerability** flow on this repository's Security tab. Include only the
minimum information needed to reproduce the issue and avoid real user data,
private keys, or production credentials.

If private vulnerability reporting is not enabled, contact a repository
maintainer through their GitHub profile and request a private channel. Do not
include exploit details in a public issue, pull request, or discussion.

Please include:

- the affected commit, release, or route;
- concise reproduction steps and expected versus observed behaviour;
- the security impact and any prerequisites; and
- a minimal proof of concept that uses only local or test data.

We will acknowledge a report when a maintainer is available, work with the
reporter to reproduce it, and share remediation or disclosure timing when the
scope and impact is understood. This is a contributor-run project, so exact
response and fix timelines cannot be guaranteed.

## Safe harbor

Good-faith research is welcome when it avoids privacy violations, service
degradation, or disruption of other users. Do not access data that is not
yours, submit transactions with real value, use stolen credentials, probe
production systems, perform denial-of-service testing, or contact users.

Please stop testing and report privately as soon as you confirm a potential
issue. We will not pursue legal action for research that follows this policy,
stays within the repository's own code and test environments, and avoids
accessing or modifying other people's data.

## Dependency supply-chain security

This repository uses automated checks to detect supply-chain attacks on npm
dependencies. These checks run on every CI build and PR.

### Lockfile integrity linting (`scripts/lint-lockfile.mjs`)

The lockfile linter parses `package-lock.json` (v3) and validates:

1. **Approved registry hosts** — all `resolved` URLs must use `registry.npmjs.org` over HTTPS.
2. **Integrity hashes** — every lockfile entry must have an `integrity` field. Missing integrity may indicate lockfile tampering.
3. **Disallowed non-standard sources** — `git+` and tarball URLs are rejected unless the package is explicitly allowlisted.

**Handling findings:**

- If a violation is flagged, first verify whether the package is legitimately using a non-standard source (e.g., a private git repository).
- If intentional, add the package name to `ALLOWLISTED_NON_STANDARD_SOURCES` in `scripts/lint-lockfile.mjs` with a comment explaining the reason and the review date.
- If unintentional, investigate the source of the lockfile modification. This may indicate a lockfile poisoning attack. Revert the change and audit the dependency tree.
- Review the allowlist quarterly (at minimum) to ensure no stale entries remain.

### Provenance verification (`scripts/verify-provenance.mjs`)

The provenance checker runs `npm audit signatures` to verify that dependencies
have valid npm attestations (cryptographic proofs of origin). Packages without
attestations are checked against the allowlist.

**Handling findings:**

- Packages with **invalid signatures** always fail the check. Investigate immediately — this may indicate a tampered package.
- Packages **missing attestations** that are not on the allowlist will fail. If the package legitimately lacks attestations (e.g., it is a private package or a legacy package that predates npm attestations), add it to `ATTESTATION_ALLOWLIST` in `scripts/verify-provenance.mjs` with a comment explaining the reason and the review date.
- Review the allowlist quarterly (at minimum).

### SBOM generation (`scripts/generate-sbom.mjs`)

A CycloneDX JSON SBOM is generated for production dependencies on every
`main` build and uploaded as a CI artifact. SBOMs are also attached to
production releases.

**Using the SBOM:**

- Download the SBOM artifact from the CI run or release page.
- Use a CycloneDX-compatible tool (e.g., `cyclonedx-cli`, `cyclonedx-bom`) to validate or compare SBOMs across builds.
- The SBOM provides a machine-readable inventory of all production dependencies and their versions, enabling automated vulnerability scanning and drift detection.

### Dependency change policy (`scripts/check-dependencies.mjs`)

New or updated dependencies in `package.json` require justification in the PR
description. Dependabot and Renovate PRs are exempt from this requirement but
still receive integrity and provenance checks.

### Allowlist maintenance

Both `ALLOWLISTED_NON_STANDARD_SOURCES` (lockfile linter) and
`ATTESTATION_ALLOWLIST` (provenance checker) are reviewed quarterly. When
adding an entry:

1. Document the reason for the exception.
2. Include the date of the last review.
3. Set a calendar reminder for the next quarterly review.
4. Remove entries that are no longer needed.
