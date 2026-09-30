# Contributing to Vortex Protocol Frontend

Thank you for your interest in contributing to Vortex Protocol!

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](./CODE_OF_CONDUCT.md). Please read it before participating in community discussions, submitting issues, or creating pull requests.

## How to Contribute

1. **Pick an Issue**: Check out open issues tagged with complexity labels on the [Wave Tracker](/contributors) or in `issues.md`.
2. **Follow Guidelines**: Ensure all user-submitted text follows sanitization standards (`src/lib/textSafety.ts`).
3. **Logging**: Never call `console.*` in `src/**`; use `secureLogger` from `src/lib/secureLogging.ts`, which redacts keys, XDR, tokens and mnemonics. `npm run lint` fails on violations. If you find a new sensitive format, add a rule to `DEFAULT_RULES` with a test.
4. **Browser storage**: Never touch `localStorage`/`sessionStorage` directly; register the key in `STORAGE_KEYS` and use the `storage` facade in `src/lib/storage.ts` (lint-enforced).
5. **Submit PR**: Open a pull request detailing your changes and referencing the closed issue (`Closes #N`).

## Reporting Conduct Issues

If you experience or witness unacceptable behavior, please contact the maintainers at `conduct@vortexprotocol.io` or `[TODO: maintainer email]`.
