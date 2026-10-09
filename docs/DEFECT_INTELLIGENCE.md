# Defect Intelligence — prevention registry

This document explains the **existing AGENTS.md prevention-first contract**; it does not supersede it, duplicate issue #266 product decisions or replace workstream plans.

## Sources and evidence status

`quality/defect-patterns.json` contains **confirmed, reusable failure classes**, not every failed Actions run. Each entry has a stable ID, owning category, impact severity, verified incident URL, root cause, prevention rule, path triggers and one or more existing focused regression guards. The historical source of truth remains the linked issue/PR and its associated CI evidence; do not paste user finance data, secrets or long logs into this registry.

Initial evidence, verified against GitHub on 2026-10-08:

| Pattern | Verified source | What the history established |
| --- | --- | --- |
| FP-001 | [#498](https://github.com/MariosGiannakaras/MyFinHub/issues/498) | Post-TOTP device-session bootstrap returned a row whose SELECT was blocked by RLS; minimal-return bootstrap and an existing regression test resolved this. |
| FP-002 | [#224](https://github.com/MariosGiannakaras/MyFinHub/issues/224) | Malformed imported Lending structures reached unsafe selector operations; normalization and sanitized selector tests resolved this. |
| FP-003 | [#523](https://github.com/MariosGiannakaras/MyFinHub/issues/523) | Common form controls diverged into inconsistent auth/Quick Entry/editor skins; shared primitive contracts and regression tests were adopted. |
| FP-004 | [#483](https://github.com/MariosGiannakaras/MyFinHub/issues/483) | Expensive CI fan-out was duplicated during high-churn development; review-ready and workflow ownership reduced unnecessary work. |

**Untriaged example, not a confirmed pattern:** on 2026-10-08 Cards PR [#529](https://github.com/MariosGiannakaras/MyFinHub/pull/529) run [37758402959](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/37758402959) failed two source tests. One asserted a literal Button count of 5 but observed 7; another flagged generic button chrome in InteractivePaymentCard. The first may be a brittle assertion or an actual divergence, and the second needs root-cause confirmation. Do **not** automatically label either a confirmed defect from one CI result. Determine which part reflects a real product regression, an intentionally changed contract, test brittleness or runner noise in that active workstream first.

## Running the preflight

```sh
npm run defects:check
npm run defects:preflight -- --base origin/develop
npm run defects:preflight -- --working
npm run defects:preflight -- --files src/lib/lending.ts server/deviceSessionRegistry.ts
npm run defects:preflight -- --base origin/develop --json
```

The existing core CI workflow also runs the read-only risk preflight automatically against its checked-out two-commit comparison (the PR merge's first parent or the previous push commit). It reports suggested guards without executing them, and its separate registry-integrity check runs inside the standard npm check pipeline.

The preflight performs read-only matching. It **does not execute** commands, touch finance data, mutate Git refs or certify a change as correct. It prints a deduplicated focused test command and context-specific preventative checks. If no known paths match, that is **not** proof of safety or permission to skip required CI. `--base` compares the merge base with HEAD for the full task-branch delta; `--working` scans unstaged, staged and untracked local files. `--files` takes explicit paths without requiring a Git checkout.

Use the suggested focused tests before a coherent checkpoint, followed by the repository's existing required validation cadence. Source-test results alone never replace rendered evidence for user-visible UI changes or the required final-head CI/security/Windows gates.

## Triage and promotion policy

1. When a failure occurs, record its source URL, exact branch/head, error, affected state and classification in the **active workstream** issue/plan; check against existing FP IDs first.
2. Separate **confirmed regression**, **intentional contract change / obsolete assertion**, **fixture/test problem**, **infrastructure/flaky failure** and **unknown**. Cancelled/skipped runs are not failures. Normalize repeats by actual root cause, not by message string alone.
3. Fix the owning cause and bound sibling consumers. Add the cheapest stable guard that actually reproduces the failure. If it is not practical to automate, retain an exact evidence-based rationale in the task plan.
4. Promote a **confirmed, reusable** class to this registry only with a verified GitHub incident link, realistic impacted paths, a present guard file and specific prevention instructions. If already covered, update the existing entry instead of adding a duplicate. Do not add unconfirmed examples as known bugs.
5. Prefer narrow cheap preflight guards for recurrent deterministic failures. Do not weaken security, accounting, privacy, accessibility, performance, desktop or rendered QA gates. Final review-head checks remain mandatory.

## Registry upkeep and limitations

- Registry is deliberately **curated and bounded** rather than a mass dump of up to thousands of historical CI runs. Historical logs may be unavailable or incomplete; avoid invented frequency claims or claiming exhaustive historical classification.
- A pattern's `paths` use relative glob patterns (`*` matches one segment, `**` can match across directories); keep blast-radius scopes narrow.
- A `guards` entry points to an existing local `tests/*.test.ts` file. Suggested test commands are generated from those paths; nothing from the registry is executed automatically.
- The cheap `defects:check` registry-integrity gate validates metadata and guard path existence inside the existing check pipeline.
- Do not store mutable CI status/head SHAs in this registry. Use live Actions and the relevant plan/checkpoint for current failure state.
- New project/product decisions belong in issue #266; durable execution mechanics in AGENTS.md; active failures/counters in the owning issue/plan.
- This implementation is scoped to MyFinHub web/backend/desktop. Android repository changes are out of scope.


## Historical mining expansion — #533 (2026-10-08)

A retrospective inventory of the accessible Actions failures, GitHub issue history and PR history is recorded in `docs/audits/HISTORICAL_FAILURE_EVIDENCE.md`. It measured **218 real issues, 311 closed PR records, 4 open PRs, 11 surviving branches, and 2,712 failed workflow runs** across the accessible August–October 2026 period. Workflow failures are not unique bugs, a closed PR need not be merged, and deleted branches / expired logs cannot be claimed as recovered.

The curated registry now contains **20 evidence-backed failure classes**, FP-001–FP-020. Sixteen additional classes cover Windows ESM/first-run packaging (#204), category-tree migration (#225), metadata first-write constraint (#317), history undo/redo audit constraints (#287), API-local TypeScript packaging (#9), Supabase upstream session classification (#16), Vercel body budgets (#18), loan-payment identity (#29), ordering/duplicate assumptions (#30), recurring overrides and valid zero settings (#47), local-midnight date refresh (#26), production smoke identity (#142), Origin/Host proxy correctness (PR #497), serverless function count (PR #352), lazy-page recovery (#51) and finance semantic range guards (#27). Individual root causes and guard paths stay in the machine-readable registry; PR sources may now be used when the root-cause evidence is in a PR rather than an issue.

### Opt-in historical collection

```sh
GH_TOKEN=... npm run defects:mine -- --since 2026-08-01 --until 2026-10-08 --include-trackers --inspect-jobs 12
```

`GH_TOKEN` or `GITHUB_TOKEN` must have read-only access to MyFinHub Actions, issues and PR metadata. The command **never executes proposed fixes** and never downloads raw job logs, uploaded artifacts, finance data or secrets. It emits a bounded JSON report to ignored `.qa-artifacts/defect-mining/historical-inventory.json` and a concise summary. A partial inventory exits nonzero and includes explicit missing-coverage warnings; the scan subdivides windows before the GitHub 1,000-run API pagination ceiling.

A separate read-only [Historical Defect Mining](https://github.com/MariosGiannakaras/MyFinHub/actions/workflows/historical-defect-mining.yml) workflow defines a **weekly metadata-only run** plus a manually triggered date-bounded backfill. GitHub executes scheduled workflows from the default branch only: because MyFinHub's default branch is production `main`, this new scheduled workflow will **not actually run until a separately approved release promotes the workflow to `main`**. Keeping it on integration `develop` does not activate the schedule; do not bypass release discipline merely to start it. Reports are ephemeral Actions artifacts (14-day retention), not committed source or automatically accepted bug facts. Core CI still runs only the fast local registry check/change-aware preflight without network credentials.

**Promotion rule:** a frequently failing workflow or test does not by itself qualify as a confirmed root cause. Investigate the originating failing step/PR/issue/actual fix, exclude cancelled or obsolete tests and infrastructure noise, confirm the narrow owning boundary, and verify a regression guard before creating/updating one FP entry. The candidate table in the evidence document stays explicitly unconfirmed.
