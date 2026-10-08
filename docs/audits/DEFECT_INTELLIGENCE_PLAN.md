# Defect Intelligence implementation plan — #530

Baseline: `develop` at `60b681bb599ef24b56d6b1b24b2d3a88801a7cd2`.
Branch: `chore/530-defect-intelligence`.
Independent from #519 PRs #528/#529; preserve their active scope and shared-owner changes. Never modify Android or product finance/security behavior.

**Implementations 2/3 completed · Sub-implementations 10/12 completed**

## 1. Evidence and registry — 4/4
- [x] DI-01 Verify incident root causes #498, #224, #523 and CI policy #483; distinguish current untriaged #529 CI failures.
- [x] DI-02 Define a versioned, evidence-linked registry with stable IDs, path patterns and guard files.
- [x] DI-03 Seed four verified cross-domain failure classes; historical narratives stay in original issues.
- [x] DI-04 Document triage, candidate promotion and source-of-truth policies in `docs/DEFECT_INTELLIGENCE.md`.

## 2. Working preventive tooling — 4/4
- [x] DI-05 Read-only registry validation and referenced guard/path checks.
- [x] DI-06 Explicit-path, working-tree and branch-diff matching.
- [x] DI-07 Stable JSON and human-readable deduplicated risk/guard suggestions, no arbitrary command execution.
- [x] DI-08 Focused positive/negative tests.

## 3. Integration and acceptance — 2/4
- [x] DI-09 Dedicated npm scripts and cheap mandatory registry validation in existing check pipeline.
- [x] DI-10 AGENTS.md short canonical integration and scope limits.
- [ ] DI-11 Focused validation: registry, tests, syntax, applicable CI. Record evidence accurately.
- [ ] DI-12 Scoped PR to develop and a zero-context handoff checkpoint.

## Acceptance invariants
- Deterministic, read-only local preflight with **no** GitHub token, production credential, network fetch or database access.
- Evidence is differentiated from speculation; old failed or skipped runs are not automatically counted as product bugs.
- Guards refer to real test files; no weakened or duplicated checks; no merge/release.
- CI fan-out remains review-ready for expensive gates; UI workstream #519 and Android untouched.

## Checkpoint
Review checkpoint: #531 draft is open. Exact head `6147aae938bc259d8494698deeaea4fd477f7ead` failed CI run 37759900409 at hygiene: TypeScript TS7016 because the new .mjs module lacked a typed declaration for the TS tests; security/rendered gates were not reached. This batch adds a proper .d.mts declaration and automated advisory changed-path preflight in core CI (two-commit checkout). Next: inspect new exact-head CI and CodeQL results, address any actual remaining failures, then reconcile handoff. Do not claim PASS before observing it.
