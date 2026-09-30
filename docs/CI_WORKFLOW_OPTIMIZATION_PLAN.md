# CI Workflow & Repository Instruction Optimization — #483

## Goal

Reduce redundant GitHub Actions churn during high-frequency implementation without weakening final-head security, correctness, accessibility, performance, desktop lifecycle, or release validation. Remove conflicting repository instruction sources and standardize progress reporting.

**Implementations 0/5 · Sub-implementations 0/15**

## 1. CI churn control — 0/3

- [ ] Keep core CI + CodeQL active during draft development, but defer expensive rendered/cross-engine/performance/Windows lifecycle work until a pull request is ready for review.
- [ ] Add superseded-run cancellation to Performance Smoke.
- [ ] Document checkpoint-oriented push/PR behavior so high-churn work does not intentionally trigger full validation on every small edit.

## 2. Trigger/path scoping — 0/3

- [ ] Scope Performance Smoke to frontend/performance-affecting paths.
- [ ] Scope Cross-engine Smoke to browser/frontend-affecting paths.
- [ ] Ensure expensive workflows re-run when a draft PR transitions to ready-for-review.

## 3. Remove duplicate Windows validation — 0/3

- [ ] Remove duplicated root `npm run check` from Windows Desktop while preserving Windows/package checks.
- [ ] Remove duplicated root `npm run check` from Windows First Run while preserving contract-specific tests.
- [ ] Remove duplicated root `npm run check` from Windows Clean Launch while preserving package/lifecycle validation.

## 4. Production smoke correctness — 0/2

- [ ] Align Production Smoke with the canonical MyFinHub production origin.
- [ ] Preserve the existing production-deployment event guard and public security/health assertions.

## 5. Instruction source alignment — 0/4

- [ ] Standardize progress terminology on `Implementations X/Y · Sub-implementations X/Y`.
- [ ] Make `AGENTS.md` the canonical version-controlled repository execution contract.
- [ ] Keep issue #266 as the durable owner/product decision ledger without competing workflow/counter rules.
- [ ] Keep `PROJECT_RULES.md` as a short discovery/precedence pointer instead of a second instruction set.

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
