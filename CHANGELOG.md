# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial changelog entry

## [0.1.0] — 2025-07-30

### Added
- Wallet integration — connect/disconnect Freighter, sign swaps and solver registrations, persist sessions across reloads
- Swap interface with live quotes over SWR and end-to-end Freighter signing
- Intent explorer page (`/explore`) — browse all intents with status/chain filters, sorting, and pagination
- Solver detail page with fill history and reputation metrics
- Live WebSocket feeds for fills and open intents layered on REST snapshots
- Shared toast/notification system for swap, intent, solver, and wallet outcomes
- Solver registration form with client-side validation (Stellar address + bond)
- Mobile responsive navigation and full accessibility pass (ARIA labels, skip-to-content, keyboard controls)
- Number and currency formatting locale-aware via i18n infrastructure
- Root layout and error boundary tests
- Vitest test suite with coverage reporting

---

## Contributing

Update `CHANGELOG.md` when merging a feature or fix PR. Every merged PR that ships a user-visible change (new feature, bug fix, or notable enhancement) should add an entry under the `[Unreleased]` section in the appropriate subsection (`### Added`, `### Changed`, `### Fixed`, etc.). Before tagging a release, merge all `[Unreleased]` entries into the latest version heading and remove the `[Unreleased]` section.