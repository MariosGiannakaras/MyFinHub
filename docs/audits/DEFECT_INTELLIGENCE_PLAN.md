# Defect Intelligence implementation plan — #530

Baseline: `develop` at `60b681bb599ef24b56d6b1b24b2d3a88801a7cd2`.
Branch: `chore/530-defect-intelligence`.
Independent from #519 PRs #528/#529; preserve their active scope and shared-owner changes. Never modify Android or product finance/security behavior.

**Implementations 3/3 completed · Sub-implementations 12/12 completed**

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

## 3. Integration and acceptance — 4/4
- [x] DI-09 Dedicated npm scripts and cheap mandatory registry validation in existing check pipeline.
- [x] DI-10 AGENTS.md short canonical integration and scope limits.
- [x] DI-11 Focused validation: registry, tests, syntax, applicable CI. Record evidence accurately.
- [x] DI-12 Scoped PR to develop and a zero-context handoff checkpoint.

## Acceptance invariants
- Deterministic, read-only local preflight with **no** GitHub token, production credential, network fetch or database access.
- Evidence is differentiated from speculation; old failed or skipped runs are not automatically counted as product bugs.
- Guards refer to real test files; no weakened or duplicated checks; no merge/release.
- CI fan-out remains review-ready for expensive gates; UI workstream #519 and Android untouched.

## Checkpoint — source implementation complete; final review gates pending

- **Completed:** DI-01–DI-12, including curated historical evidence, versioned registry, read-only CLI, matching, JSON, focused tests, npm commands, automated advisory core-CI preflight, integrity gate and AGENTS.md pointer.
- **Validated source head:** `b69682c56058d9fdca3b608cab9f006422ed1757`. Core CI [37760174394](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/37760174394) PASS: 182/182 test files and 1,042/1,042 tests; hygiene, registry integrity (4 patterns/6 guard files), API checks, TypeScript, production build/bundle budgets, npm security audits (0 vulnerabilities). Core CI printed one matching failure class for the branch change set. Previous head `6147aae` failed TS7016 because the new .mjs import lacked a declaration; corrected via `scripts/defect-preflight.d.mts` without weakening checks.
- **PR:** [#531](https://github.com/MariosGiannakaras/MyFinHub/pull/531), targets `develop`, independent of #519 work. This documentation checkpoint itself advances HEAD; read live PR head and require its exact-head CI/CodeQL plus review-ready required gates before merge.
- **Pending at this checkpoint:** CodeQL, Real Stack E2E and review-ready matrix on final head; no PASS claim for unfinished checks. No branch merge, production deployment, database action or Android mutation authorized. Final review evidence belongs to live PR #531 Actions.
- **Next safe action:** inspect final live PR head, mark Ready only once source batch is coherent, run all triggered required checks on that head, inspect failures and resolve by root cause before considering merge.
