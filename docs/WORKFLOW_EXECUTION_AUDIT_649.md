# #649 — Whole-implementation workflow and CI cost audit

**Baseline:** Draft PR [#654](https://github.com/MariosGiannakaras/MyFinHub/pull/654), branch `fix/649-bulk-remediation`; integration `develop`, production/release `main`. Applies to the whole MyFinHub web, API, Supabase migration, and Windows implementation process. Android is a separate repository.

## Verified prior exact-head results

- Prior head `c883a3b980876c6525214748c08644759f0ca97b`: [CI #42429202804](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/42429202804) **SUCCESS**, [standalone CodeQL #42429202700](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/42429202700) **SUCCESS**, [real PostgreSQL/Storage + browser E2E #42429202754](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/42429202754) **SUCCESS**. The CI job additionally invokes its own reusable CodeQL analysis; this generated duplicate PR CodeQL work.
- [Desktop Backup focused #42429202776](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/42429202776) **FAIL** only in focused rendered QA. Source unit 12/12, TypeScript/build/bundle/source syntax all **PASS**; three actual desktop PNGs were uploaded in artifact #13597190793. Rendered pass reached the valid backup Restore button and timed out waiting for a destructive confirmation; inspected the fixture and found `getRestoreCandidate` provided `seed:{}` (missing `accounts` and `transactions`) and `state:{}`. Existing `previewFinanceImport` correctly rejects this malformed document *before* opening a destructive confirmation. No production code defect or reason to weaken preview validation. The current batch repairs the **synthetic source fixture** to the supported FinanceData shape and adds a preview+confirmation assertion and diagnostic capture. The existing error screenshot is a valid failure signal, not a pass.

## Whole workflow: expensive gate ownership

| Workflow/gate | Draft implementation batch | Coherent review head | Release |
|---|---|---|---|
| `CI/validate` including hygiene, all unit/source tests, build, audits, and local PIN/RLS smoke | **Required** by develop/main GitHub rulesets | Required | Required |
| Reusable `CI/CodeQL security analysis` | Required inside CI, single PR scan | Required | Required |
| Standalone CodeQL workflow | Weekly scheduled scan only; **do not duplicate PR analysis** | Same reusable CI job | Scheduled + CI |
| `Real Stack E2E` (local PostgreSQL, Storage, owner/AAL2, browser, forward-only migration) | Explicit trusted PR marker or manual dispatch on selected checkpoint heads | **Automatic** on relevant non-draft PRs | Required when affected by release scope |
| `Desktop Backup Focused Rendered QA` (15 responsive states plus 3 error/retry and dark/confirmation) | Explicit trusted PR marker or manual dispatch | **Automatic** on relevant non-draft PRs | If desktop backup scope affected |
| History / FB / Motion focused suites | Existing independent opt-in owners; reuse accepted evidence where unchanged | Relevant focused review if affected | Scope-dependent |
| WebKit, Lighthouse/CLS, Windows installer / first-run / clean-launch | Deferred by existing Draft `CI` gate; focused tests during implementation | **Automatic required** in `CI` | Required |
| Final Visual QA 216 images | Do not run in the debug/edit loop | Once, after accepted narrow rendered evidence & required green CI, via review label/manual CI dispatch | As required by release |

## Root causes and safe corrections

1. **GitHub PR path filters compare cumulative PR contents**. This long-lived branch has already changed real-stack scripts and desktop-backup files, so a tiny source/test/README commit still matches both paths and launches expensive jobs. Keep path filters as initial surface selectors, but gate actual heavyweight jobs during Draft behind explicit opt-in; do **not** skip mandatory ready-for-review checks.
2. **CodeQL was running twice per PR head**: the direct `codeql.yml` pull_request trigger and CI's reusable `codeql` job. The active GitHub `develop`/main rulesets require `validate` status and CodeQL code-scanning alerts, not a duplicate standalone scan. Retain the CI reusable CodeQL PR job and weekly standalone scheduled run. Check exact-head CodeQL upload and ruleset checks before review.
3. **Focused QA startup failures led to serial full-CI loops**. Focused browser harness now has isolated CDP port/profile/process-group cleanup, plus a single retry restricted to a verified Chromium bootstrap error; neither a broken product state nor failed assertion is retried. Its remaining failed confirm was an invalid test fixture, not application finance import behavior.
4. **Do not rerun the entire workflow after every small edit.** Work from `develop` to one active task branch and Draft PR; inspect relevant logs/screenshots and fix related root causes together; run narrow source/type and focused QA locally/on selected draft checkpoint; then run the full strict CI, CodeQL, PostgreSQL/Storage, cross-engine/performance, responsive QA, and Windows gates on the coherent review head. Preserve exact failure evidence in status and avoid speculative merges.
5. **No security/finance lowering**: no weakening of owner+AAL2/TOTP/RLS, revisions/import preview/backup/history, SQL migration approvals, bundle/performance thresholds, or physical Windows hardware gate invention. Production `main` receives only separately authorized `develop -> main` release merges. Android stays untouched.

## Acceptance tracking

- The current change is a *workflow/performance* reconciliation and a correction of the focused desktop backup synthetic QA fixture.
- Run the focused 15-state visual matrix **once** on the coherent current head, inspect all PNGs, and classify I18.03/I18.06 only after the actual proof passes. The 2c94fdb isolated local PostgreSQL+Storage rehearsal is verified but **does not** establish a separately hosted, production-grade recovery environment for I18.02.
- Track implementation completion **separately** from pending review-head CI and merge; use the active #649 branch checkpoint for counters. Do not auto-merge a Draft PR or apply production migrations.

## 2026-11-08 focused follow-up to the whole-workflow audit

- Existing `tests/workflow-optimization-source.test.ts` was still asserting the old **duplicate direct PR CodeQL** scan. The global workflow now relies on mandatory CI's reusable CodeQL for PR scan + weekly scheduled standalone CodeQL; update the legacy guard rather than restoring duplicate cost. The actual GitHub rulesets explicitly require `validate` and CodeQL code-scanning analysis, not two scans.
- The 15-state Windows backup proof reached real rendered Restore confirmation but exposed a **QA-only StrictMode race** in its single-use synthetic failure. Keep failure until a deliberate retry action; then verify the visible error disappears. Partial evidence artifact #13610211853 was reviewed; final tablet/mobile/retry acceptance is still pending.
- A corrupt-only catalog must not show first-install copy below its red warning. Fix the copy based on real screenshot and lock source and rendered assertions. Capture the restore modal only after motion settles so the visual artifact is an accurate review image.
