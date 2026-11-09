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

## 2026-11-09 — proportional security and bulk-closeout review (owner-directed)

**Verdict:** Security guarantees are mostly proportionate to a single-owner finance system, but older task process conflated security approval, production recoverability, source completion and redundant QA. Correct the workflow, **not** the auth boundaries.

| Guard | Decision and evidence | Execution consequence |
|---|---|---|
| Mandatory TOTP/AAL2 + UID + live-session provenance + RLS on finance/API/vault | **Keep.** `server/auth.ts`, `tests/security.test.ts`, `tests/native-bearer-api.test.ts`, `tests/device-access.test.ts` cover cookie Origin vs explicit bearer, owner and active device checks. | No MFA bypass, no broader grants or anonymous access. No extra approval for read-only tests. |
| Conditional four-digit app privacy PIN | **Keep optional.** `20261024160000_shared_owner_app_lock.sql` hides PIN hashes, rate-limits failed attempts, requires owner+AAL2+active session and uses short-lived session tickets; `tests/shared-app-lock.test.ts` and `tests/app-lock-bypass.test.ts` protect the API/RLS lock. The necessary three `SECURITY DEFINER` RPCs have explicit guards, empty search path and narrowed grants; their mere presence is not a proven finding. | No mandatory extra PIN enrollment, no downgrade of server enforcement when the owner enabled it. Never call the confidential PIN an MFA substitute. |
| Finance revision/history, non-destructive JSON import, separate card vault, confidential key boundary | **Keep.** Loss or replay of financial history has materially higher consequence than a source-test inconvenience. | Do not lift limits to make CI green; reject production destructive writes without owner approval. |
| Standalone CodeQL PR scan **in addition to** reusable CI CodeQL | **Avoid duplicate only**, as already corrected on this branch; keep reusable mandatory CodeQL and weekly scheduled scan. | Batching and Draft-focused opt-in eliminate repetitive expense, not required checks. |
| Local PostgreSQL scratch + separate temporary Storage replay | **Sufficient source implementation proof, not production recoverability.** `scripts/isolated-full-recovery-e2e.mjs`, `tests/649-isolated-recovery-source.test.ts`, production operator runbook, successful synthetic [Real Stack #42391429918](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/42391429918). | Mark bounded repository source/recovery procedure ready while keeping independent hosted-cluster, credentials, secret escrow, live consistency and any production restore as explicit separate release/operator gates. No hosted cluster/restore was run. |
| Supabase advisor leaked-password/security-performance WARNs | **Evidence pending, not automatic blockers.** Confirm feature availability on the owner's Supabase Free plan before changing hosted settings; do not weaken app-layer password/MFA protection because an advisor is informational. | No unsupported paid-only service or broad RLS rewrite solely to silence an advisory. |
| Physical Windows/device tests, exhaustive visual reruns on unchanged source, owner approval for ordinary synthetic QA | **Unnecessary defaults**, already forbidden/deferred by AGENTS.md. | Review actual automated Windows/artifact evidence; run focused affected-surface tests and one final Ready matrix. |

**Scope accounting defect:** The frozen 132-item register is **A10 + F4 + V48 + K51 + P8 + S11**; it is not 132 known code defects. Code/guard acceptance, verified no-change cases, unproven candidates, product choices and external security/recovery approvals must have separate statuses. The 23-area audit completed 23/23 in Phase 1; Phase-2 implementation packages are not each a single code edit. Preserve original denominators and historical counts until the active branch explicitly reconciles items with evidence. **No global authorization weakening was performed.**
