# CI Workflow & Repository Instruction Optimization — #483

## Goal

Reduce redundant GitHub Actions churn during high-frequency implementation without weakening final-head security, correctness, accessibility, performance, desktop lifecycle, or release validation. Remove conflicting repository instruction sources and standardize progress reporting.

**Implementations 9/9 · Sub-implementations 24/24**

## 1. CI churn control — 3/3

- [x] Keep core CI + CodeQL active during draft development, but defer expensive rendered/cross-engine/performance/Windows lifecycle work until a pull request is ready for review.
- [x] Add superseded-run cancellation to Performance Smoke.
- [x] Document checkpoint-oriented push/PR behavior so high-churn work does not intentionally trigger full validation on every small edit.

## 2. Trigger/path scoping — 3/3

- [x] Scope Performance Smoke to frontend/performance-affecting paths.
- [x] Scope Cross-engine Smoke to browser/frontend-affecting paths.
- [x] Ensure expensive workflows re-run when a draft PR transitions to ready-for-review.

## 3. Remove duplicate Windows validation — 3/3

- [x] Remove duplicated root `npm run check` from Windows Desktop while preserving Windows/package checks.
- [x] Remove duplicated root `npm run check` from Windows First Run while preserving contract-specific tests.
- [x] Remove duplicated root `npm run check` from Windows Clean Launch while preserving package/lifecycle validation.

## 4. Production smoke correctness — 2/2

- [x] Align Production Smoke with the canonical MyFinHub production origin.
- [x] Preserve the existing production-deployment event guard and public security/health assertions.

## 5. Instruction source alignment — 4/4

- [x] Standardize progress terminology on `Implementations X/Y · Sub-implementations X/Y`.
- [x] Make `AGENTS.md` the canonical version-controlled repository execution contract.
- [x] Keep issue #266 as the durable owner/product decision ledger without competing workflow/counter rules.
- [x] Keep `PROJECT_RULES.md` as a short discovery/precedence pointer instead of a second instruction set.

## 6. Bundle-budget semantics — 3/3

- [x] Keep the eager CSS gzip ceiling at 46 KiB while giving raw CSS a bounded 256 KiB source-size ceiling instead of a near-zero-growth margin.
- [x] Add an aggregate 500 KiB raw / 100 KiB gzip CSS ceiling across all emitted CSS chunks so lazy loading cannot hide total stylesheet growth.
- [x] Extend release-readiness source coverage for both eager and aggregate CSS gates.

## 7. Deterministic performance evidence — 2/2

- [x] Run Lighthouse three times per existing case and gate on the median rather than one shared-runner sample.
- [x] Preserve every existing performance/accessibility/best-practices/LCP/CLS/TBT threshold unchanged and retain each raw run artifact.

## 8. Windows validation deduplication — 3/3

- [x] Split the desktop dependency audit from syntax/source validation so Windows Desktop owns the audit while First Run and Clean Launch keep source checks without repeating the same audit failure.
- [x] Build the root production frontend once in Windows Desktop, then reuse that dist for unpacked and NSIS packaging; apply the same reuse to tagged release packaging.
- [x] Lock the ownership/build-reuse contract in source tests.

## 9. Dependency security refresh — 1/1

- [x] Refresh only the vulnerable desktop transitive lockfile resolutions within their existing parent semver ranges: brace-expansion 1.x → 1.1.21, 2.x → 2.1.7, 5.x → 5.0.12, and fast-uri 3.x → 3.1.8.

## Validation

- Parse every modified workflow as YAML.
- Run repository source tests that lock workflow triggers/contracts.
- Run the narrowest relevant workflow/source tests first.
- Run `npm run check` on the final implementation head.
- Inspect the final PR workflow fan-out and confirm expensive jobs are skipped for draft PRs but run after ready-for-review.
- Do not merge until required final-head checks are green.

## Scope exclusions

- No Android repository changes.
- No reduction of security thresholds, test assertions, accessibility requirements, performance thresholds, Windows lifecycle checks, or release protections.
- No release or production deployment.


## Implementation checkpoint

All accepted implementation items, including the follow-up CI hardening requested after the first validation wave, are complete on `chore/483-ci-workflow-optimization`. The branch must still pass final-head PR validation before merge. No release or production deployment is part of #483.
