# CI Workflow & Repository Instruction Optimization — #483

## Goal

Reduce redundant GitHub Actions churn during high-frequency implementation without weakening final-head security, correctness, accessibility, performance, desktop lifecycle, or release validation. Remove conflicting repository instruction sources and standardize progress reporting.

**Implementations 5/5 · Sub-implementations 15/15**

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

All accepted implementation items are complete on `chore/483-ci-workflow-optimization`. The branch must still pass final-head PR validation before merge. No release or production deployment is part of #483.
