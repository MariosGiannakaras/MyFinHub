# MyFinHub — full application correction roadmap (#649, consolidated)

## 2026-11-23 — FP-033 recurring image release uncertainty ACCEPTED (source + real Chromium)

**Implementations 6/23 completed · Sub-implementations 104/132 completed**, unchanged; the original broad I19.04/I22.02 and other original P0/P1 tasks remain incomplete. Latest browser QA/source-guard head [`d78500f`](https://github.com/MariosGiannakaras/MyFinHub/commit/d78500f41f89ca0df873059d39e125a27463261b) has **exact-head [CI #45126098131](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45126098131) SUCCESS** for `validate`, CodeQL JS/TS and Unified. Previous [`108dabc` CI #45125282962](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45125282962) also SUCCESS on the FP-033 production client + synchronous auth-epoch negative guard. Candidate `4b624e0` had one test-only literal screenshot-name mismatch in [CI #45125861008](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45125861008); the dynamic viewport-loop source assertion was corrected in `d78500f` without weakening browser tests. No new application behavior was added after the accepted client guard.

**Actual changed-surface proof:** [focused recurring-service-brand Chromium #45126306507](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45126306507) **SUCCESS on exact `d78500f`**, artifact [#14795572359](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45126306507/artifacts/14795572359) with **10 genuine PNGs and 2 logs**. Downloaded ZIP, inspected all ten images in a contact sheet, then opened full-size `recurring-service-brand-release-unverified-desktop.png` (1440×1100), `recurring-service-brand-release-unverified-mobile.png` (375×812), and pre-existing finance receipt warning screenshot (1440×1100). No new clipping/overlap or hidden status in these inspected screens. Chromium demonstrated: committed finance save and new bound logo retained after mock Storage purge 503; one old-key DELETE only; visible warning differentiating persisted finance from unconfirmed old-image release; direct repeated same-key call rejected with **zero second DELETE**; mobile full-width warning/row/status contained. The existing positive/rejected finance, same-turn double Save, pause/payment, Dark and mobile screenshot cases remained PASS. Synthetic mock deliberately removes the old image from the *active-only* catalog before 503, proving the app does **not** treat catalog absence as actual Storage purge.

**Boundary:** This is bounded browser/client fail-closed handling only. Server owner+AAL2/RLS and existing Storage/registry partial-write behavior are unchanged; no live hosted Storage or finance write, no independent production recovery proof, Android, develop/main merge, production release or complete Ready Windows/WebKit/Lighthouse/whole-app responsive acceptance. One-shot `<!-- run-649-recurring-asset-qa -->` PR-body marker is **OFF** after screenshot review. Bot PRs #657/#658/#660 remain open, overlay already staged in #654; #645 remains owner-go/no-go Draft production release.

**Next safe action:** wait for ordinary source CI on this documentation-only checkpoint, then continue only original unaccepted P0 I19.04 orphan/recovery and I22.02 direct negative endpoint evidence or demonstrated P1 defects. Keep Draft #654 and defer the expensive full Ready matrix to a coherent review head.

---


## 2026-11-23 — FP-033 actual Chromium recurring release uncertainty (new focused QA candidate)

**Implementations 6/23 completed · Sub-implementations 104/132 completed**, unchanged. Previous exact source head [`108dabc`](https://github.com/MariosGiannakaras/MyFinHub/commit/108dabc84e8c5511ca13ca33034f13258cbe7ee6) has confirmed [CI #45125282962](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45125282962) **SUCCESS** for `validate`, JS/TS CodeQL and Unified. The corrected FP-033 source and old-auth in-flight negative tests are accepted at source level; this does **not** yet prove the changed user-visible release warning.

A bounded addition to the **existing** `scripts/recurring-service-brand-qa.mjs` emulates the real partial outcome: server release RPC deactivates old image, Storage purge fails with 503, active-only catalog could misleadingly exclude it. Run actual Chromium in desktop 1440×1100 and mobile 375×812; verify the finance Save remains committed, new artwork remains bound, exactly one old-image DELETE occurs, a visible/contained warning identifies uncertain Storage, and a direct same-key follow-up attempt is blocked with no replay. Captures two named evidence PNGs and keeps existing positive/rejected-finance/ambiguity scenarios. Add a narrow QA source guard; no product/SQL/RLS/Android/production mutation. New exact-head source/CodeQL/Unified and **one** focused recurring-service-brand Chromium run plus screenshot inspection **PENDING**. Keep #654 Draft and full Ready suite deferred.

---


## 2026-11-23 — FP-033 self-review: active-only catalog cannot certify Storage purge

**Implementations 6/23 completed · Sub-implementations 104/132 completed**, unchanged. Before candidate acceptance, checked the actual server `deleteRecurringServiceAsset`: its first release RPC may mark the row inactive and a subsequent Storage deletion may fail with 503; `readRecurringServiceAssets` filters `active=eq.true`. Therefore, after ambiguous DELETE, an empty public GET **cannot** certify Storage deletion or exact-row purge. Corrected the candidate to fail closed and block repeat same-key DELETE on transport/408/429/5xx or invalid HTTP-200 receipt, without claiming success from an active-only catalog. Only explicit server `{ok:true}` (issued after verified Storage DELETE and purge) proceeds to the existing fresh catalog absence proof. Four ambiguous-negative tests now assert no GET and no replay, with same-key concurrency and definite 400 retry coverage. FP-033 registry prevention corrected. No server/RLS changes, DB/Storage writes or finance mutation. Source/CodeQL/Unified **PENDING new exact head**.

---


## 2026-11-23 — FP-033 recurring asset release ambiguous DELETE (source candidate)

**Implementations 6/23 completed · Sub-implementations 104/132 completed**, unchanged. On the existing consolidated Draft #654 → develop, the I19.04 recurring browser release client previously retried as a normal failure after network-loss/408/429/5xx DELETE even though its owner-scoped server release could have committed. This candidate uses per-key synchronous release ownership, a fresh read-only catalog absence check after ambiguous or acknowledged responses, fail-closed same-key retry lock when readback is inconclusive, and retired-auth-epoch protection. Definite 400 keeps its original retry contract; finance revision, Storage/RLS policy, other provider assets and Android are unchanged. Existing test file adds four ambiguous statuses × both definitive absent/retained catalog cases plus duplicate-delete concurrency. FP-033 records the regression class.

**Validation PENDING:** exact new source-head targeted Vitest, TypeScript/full ordinary CI and CodeQL/Unified. No browser claim before actual evidence, no Real Stack DB/security revision, hosted Storage/finance writes, merge, release or production restore. Continue final original P0/P1 and protected Ready matrix after this narrowed proof.

---


## 2026-11-23 — FP-032 exact generated provider Storage URL completed at bounded source/browser level

**Implementations 6/23 completed · Sub-implementations 104/132 completed**, unchanged. Source head `1be4ae4868b17b54dd12b09d7c05c50f69d187c4` passed [CI #45097196181](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45097196181) `validate`/CodeQL/Unified plus actual [focused Chromium #45097348469](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45097348469) provider-management and receipt-local OCR. Directly reviewed 53 PNG artifact #14783369818 in contact sheet and important full-size mobile wrong-path refusal and desktop dark positive brand asset. The browser client now requires server-generated provider Storage path exactness for **newly uploaded keys**, in both 200 receipt and fresh catalog readback, but preserves curated legacy artwork and all existing server/RLS/security boundaries. The two historical CI failures were test-only fixtures/TypeScript return annotation and fixed before final PASS. All focused QA opt-ins OFF. FP-032 prevention registry and newest detailed status own evidence.

**Next:** final ordinary CI for this docs-only checkpoint and then genuinely incomplete original P0/P1/operational gating. No bot PR merge, main promotion, Android, hosted writes or full Ready acceptance. Final Windows/WebKit/Lighthouse/complete visual and owner approval still pending.

---

## 2026-11-23 — FP-032 provider newly-uploaded binary URL exact provenance

**Original 6/23 · 104/132 counters unchanged.** Source-server review found a specific original I19.04 false-green gap: the provider client checked generated key, file MIME, bytes and slot but accepted unrelated HTTPS URLs in HTTP-200 upload receipts and otherwise matching catalog GET. The generated-key contract is already enforced in server/SQL: `financial-provider-assets/providers/<provider>/<generatedKey>.<MIME-extension>`. The bounded source candidate checks the canonical public Storage **pathname** at both receipt and postwrite catalog for **only freshly uploaded keys**, retaining all curated legacy image URLs, same-owner AAL2/RLS, no duplicate binary replay, per-slot binding and previous readback behavior. Update existing unit and provider-branding real browser QA (one valid canonical fixture, one correct-key/foreign-path HTTP 200 denial) without new QA duplicate. FP-032 guards in `quality/defect-patterns.json`; current status has exact next acceptance and one-shot opt-in. CI and rendered review **PENDING** on the new head. No Android, production database or rollout scope.

---

## 2026-11-23 — FP-031 verified completion checkpoint within original I19.04

**Original counters 6/23 · 104/132, unchanged.** The synchronous same-turn recurring Save and generated provider/recurring binary-asset in-flight guards were **source/CodeQL/Unified accepted** on [`a6f98c2` / CI #45095358732](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45095358732) and **actual Chromium accepted** on [focused #45095500141](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45095500141) (one same-task double Save, one Storage PUT; other partial-commit/error/theme/mobile states preserved). Downloaded artifact #14783266349: eight actual screenshot contact-sheet views, full-size ambiguous receipt warning and synthetic-only logs manually reviewed. The targeted opt-in marker was **removed**; Draft-only expensive gates remain off. This is an **accepted bounded P0 mitigation**, not a claim broad I19.04 closed. Continue original P0/P1 without duplicating all previously accepted tests; #657/#658/#660 portfolio dependency evidence unchanged, #645 separate production go/no-go. The following documentation-only commit needs its own exact-head routine CI.

---

## 2026-11-23 — P0 I19.04 FP-031 cross-store same-turn upload ownership

**Counters unchanged 6/23 · 104/132.** A specific previously unguarded same-task duplicate upload path was found in the recurring editor (state-only busy, no synchronous Save latch) and both exposed binary upload clients (no per-recurring or provider/role/variant in-flight lock). The new coordinated candidate introduces shared-client synchronous per-target ownership plus RecurringPage's pre-dispatch synchronous ref, auth-epoch-safe reset/finally, and existing-suite unit/source plus one recurring-service-brand Chromium double-click assertion. It preserves earlier provider editor serialization, uncertain binary receipt behavior, finance revision rollback classification, strict Storage ownership and previous accepted tests. Detailed changed-file/testing contract in the newest [branch status](./ISSUE_649_BULK_IMPLEMENTATION_STATUS.md) and FP-031 [defect pattern](../../quality/defect-patterns.json). **Source/CodeQL/Unified and focused user-visible QA PENDING new head**; do not count original broad I19.04 complete from one race fix. No backend migration/hosted mutation or Android/release scope. Resume existing draft PR #654, not a separate PR.

---

## 2026-11-23 — consolidated dependency/portfolio acceptance boundary (current)

**Implementations 6/23 completed · Sub-implementations 104/132 completed**, unchanged. Draft PR #654 on exact previous code head `0f1553d04de988fe596d70b90fd77084dac3bc5b` has now passed [source/security CI #45088883896](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45088883896), [isolated local Real Stack #45092659037](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45092659037), [focused shared-controls Chromium #45093220360](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45093220360) and [focused desktop-backup Chromium #45093220381](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/45093220381), all **SUCCESS on the exact same source head**. Downloaded artifacts **#14781822640 (104 PNG + logs)** and **#14782271324 (24 PNG)**, manually inspected contact sheets and representative full-size desktop/mobile/320px dark/light, errors and restore-dialog states. No evidenced new visual defect in inspected samples; do not equate focused tests or samples with the required final whole-app visual acceptance. All one-shot PR-body QA markers are **OFF**. Full Windows installer/clean launch/first run, WebKit, Lighthouse, complete responsive matrix, review-ready migration/security/recovery and integration gates **not yet run** on this Draft head.

Source-overlaid bot PRs #657/#658/#660 remain open **without standalone merging** until their accepted composite changes reach protected `develop`. The prior standalone #660 lock mismatch was repaired by exact root/desktop linked-lock parity; its earlier local Supabase registry rate-limit/seed timeout did not recur in the successful combined Real Stack. Current production read-only finance revision 499 has 498 newest in-app backup, exact owner-approved taxonomy JSON 4/4, zero observed owner-join leg/account/asset/history/card-reference orphan anomalies; see the latest status and #616 issue comment. Hosted full restoration, owner AAL2 activation provenance and #645 production release remain separate owner-approved acceptance.

**I22.04 Free-plan bound:** Supabase's official documentation says leaked-password protection is **Pro+ only**. #266 mandates normal MyFinHub operation remain viable on Supabase Free. Treat the Auth advisor as a reviewed, paid-setting/product-risk boundary rather than silently enabling a paid feature or altering existing owner MFA/RLS.

**Next:** preserve no-opt-in state while resuming genuinely unaccepted original I19.04/I22.02/P1 code paths, then one protected Ready review head with full gates. Docs-only checkpoint must obtain its own normal CI. No production writes, Android changes, main merge, physical-device dependency or release.

---

## 2026-11-23 — coordinated all-open-issue/PR execution scope

**Owner direction:** Work on all currently open MyFinHub issues/PRs in coordinated compatible batches, not one #649 micro-task at a time. Live inventory: open issues **#266, #616, #617, #637, #641, #649, #655**, PRs **#645, #654, #657, #658, #660**. Only this repository; separate Android code is excluded. Preserve established branch ownership and release boundaries; the instruction does **not** approve main promotion or destructive hosted data actions.

**Combined dependency candidate on active Draft #654:** Stage the *actual deltas* from independent #657 (Electron 43.8.4), #658 (CodeQL Actions 4.39.3) and #660 (lucide-react, Vite/plugin, concurrently and Vitest minor/patch updates) without merging/closing the three source PRs before accepted integration. Preserve latest #654 source, version 1.7.1, application scripts and scheduled/reusable CodeQL workflow (do not reintroduce duplicate PR CodeQL scans from the older #658 branch). Reconcile `desktop/package-lock.json` `packages['..']` to exact root manifest, with existing version-coherence regression expanded for root lock and packaged Electron version. This specifically repairs #660's demonstrated source CI failure, not an unrelated test weakening. #660 Real Stack's Docker registry rate limit and legacy-seed timeout require independent re-evaluation; a transient infrastructure failure is not schema proof. Combined dependency candidate remains unaccepted until **new exact-head** security, source, build and relevant Windows/browser/DB gates pass. The Dependabot PRs remain open pending coherent proven integration into develop.

**Unchanged independent items:** #649 original 6/23 implementation and 104/132 sub-implementation counters; outstanding P0/P1 continue after the dependency boundary. #641 auth fix already source-integrated; Draft #645 is a separate main-ancestral release with previous exact-head source/Real Stack proof but no current owner production go/no-go, full Ready visual/Windows acceptance or separately approved restore-risk disposition. #637 tracks release lifecycle and must not cause ad hoc version/tag issuance. #617 persisted taxonomy already matches owner-approved 20/6 + 71, but owner+AAL2 in-app activation ceremony provenance is not proven and data must not be reapplied; #616 historical SELECT-only integrity and backups do not certify independently restorable Postgres+Storage. #655 is a dated read-only dependency-health snapshot; major Node/Electron/TypeScript upgrades are not implied by this batch. #266 remains permanently open as durable owner/product decisions, not changing task progress.

**Validation order:** one combined source/security CI for dependency candidate; investigate actual failures in one coherent repair; full responsive visual, WebKit, Lighthouse, Windows installer, Real Stack and performance/security only when the final Ready head or a genuine high-risk dependency boundary requires them. No merge of #654/#645 or retirement of independent PRs until required exact-head gates and provenance pass.

---

## 2026-11-19 — Current authoritative consolidation (read before the 2026-10-29 intake below)

**One #649 implementation owner:** [Draft PR #654](https://github.com/MariosGiannakaras/MyFinHub/pull/654), `fix/649-bulk-remediation` → `develop`. This roadmap and the original evidence are now available on the *implementation* branch; independent draft audit PR #650 is superseded. Do **not** open a new PR per defect, resume an already accepted item, or treat an inactive branch as the implementation head.

**Exact active code progress: Implementations 6/23 completed · Sub-implementations 104/132 completed.** These count only fully accepted implementation items per [branch-local current status](./ISSUE_649_BULK_IMPLEMENTATION_STATUS.md). Individual 2026-10-29 checklists and their original 0/23 counters below are **historical intake baselines**, *not* live progress and not instructions to restart completed work. The 23/132 inventory is an evidence-backed work breakdown, not a claim that 132 independent bugs exist. Do not increase denominators or fabricate completion based on aggregate code edits.

### Consolidated execution sequence (one coherent milestone, no PR proliferation)

| Order | Action | Completion evidence and protection |
| --- | --- | --- |
| **A — repair the active failed gate** | CI #44583813737 failed only NodeNext imports in `src/lib/accountMetadataClient.ts` after new client IBAN readback tests. Add the required three `.js` extensions without changing runtime semantics, then use the next ordinary source CI. | `validate`, CodeQL and Unified **on the exact resulting head**, not on preceding green 013a8a8. Do not rerun the old full browser matrix. |
| **B — collapse already-implemented small branches** | PR #651/#648 Transactions EOD/lending cash signs and PR #653/#652 FinanceData JSON backup scope are already source-integrated and protected by tests in #654. Preserve the *newer* #654 code instead of cherry-picking stale files. Retire redundant drafts only after confirming parity; track unmerged code in #654/#649. | Existing `tests/648-transactions-balance-cash-signs.test.ts`, `tests/652-backup-scope-source.test.ts`; maintain finance cash-leg meaning, privacy, non-destructive history and backup exclusions. |
| **C — complete remaining P0 implementation** | Continue original uncompleted #649 tasks, especially I19.04 cross-store uncertain receipts/verified recovery and I22.02 security/direct-RPC negative boundary. Reuse the finished I19.05/I20.06/I22.05 tests and all previously accepted QA. Group fixes by shared server/domain owner; avoid unbounded speculative audits. | Scoped deterministic read/write/error tests, disposable PostgreSQL direct RPC proofs where DB changes occur, changed-surface rendered evidence where UI changes occur. Production PostgreSQL/Storage restore (I18.02) requires separate explicit approval. |
| **D — finish residual P1 by shared root cause** | Shared shell/design tokens/accessibility/responsive primitives first, then affected Dashboard/Transactions/Settings/overlays/Windows route groups using existing 23-area classification. Resolve only reproduced defects or accepted product decisions. | Source and targeted 320/375/768/1440 desktop/tablet/mobile/light/dark/error/focus proof for **changed** surfaces; inspect screenshot artifacts, don't repeat accepted suites. |
| **E — one final coherent Ready review** | Reconcile independent Dependabot PRs #657/#658/#660 **only after separate compatibility/CI checks**; do not blindly merge version bumps. Set #654 Ready only when implementation stable. Run required full CI, CodeQL, rendered/visual, WebKit, Lighthouse, Windows/installer, security and applicable real-stack/recovery gates once for the coherent final review head. | All protected checks PASS on exact same review head, no security/UX/finance thresholds weakened. Fix failure causes in batches; no merge on pending/failed results. |
| **F — controlled integration then separate production release** | Review/squash #654 → current `develop` only when final protected gates pass; separately reconcile surviving release #645 from the validated integration state. Never auto-promote to `main`. | Owner-go/no-go for production; preserve active owner+AAL2/RLS, finance history, backup integrity, no Android edits. |

### PR and issue retention / cleanup

- **Keep** #654 as the single #649 integration PR, #649 as its task umbrella and #266 as the permanent product/architecture ledger (NEVER CLOSE).
- **Supersede after verification** docs-only #650 (its 12 non-README audit/plan artifacts are copied onto #654). Supersede #651/#648 and #653/#652 once current #654 source/test equivalence has been verified; close old PRs **without merge** because their contents are already implemented on the newer branch.
- **Keep independent** draft production promotion #645 (no unsolicited deployment), Dependabot PRs #657/#658/#660 (compatibility/security), read-only runtime health #655, and owner/production acceptance #616/#617/#637/#641. Do not close these as ordinary code-cleanup duplicates.
- **Retire historical #646** only once its accepted 3/3 implementation and 13/13 subitems are confirmed already integrated into `develop`, with residual work covered by #649. Never delete unmerged implementation branches while ownership or recovery references remain uncertain.
- **Branch cleanup:** identify stale/no-open-PR branches separately, but do not force-delete/merge refs or discard source without provenance and exact ownership checks. Git history is retention, not active work scheduling.
- Do not create duplicate `STATUS.md`, another roadmap, another issue per line or larger PR-body progress journals. **Current status lives in** [ISSUE_649_BULK_IMPLEMENTATION_STATUS.md](./ISSUE_649_BULK_IMPLEMENTATION_STATUS.md). Old issue/PR descriptions are discovery snapshots only. The original Phase 1 documents below remain archived evidence, not active implementation queues.

---

## OWNER-SUPERSEDING TWO-MACRO-TASK EXECUTION — effective 2026-10-29

**Task 1/2: MASS AUDIT FIRST — COMPLETE (23/23 classification).** Complete source/CI/runtime/screenshot/domain/authorization analysis across all 23 planned areas, all 12 routed pages, seven Settings tabs, auth, Quick Entry, Windows and shared interfaces. Reproduce candidate faults and collapse duplicates/already-fixed cases into ONE prioritized, evidence-backed finding matrix. Do not implement more product source changes before this audited backlog is frozen. All 23 areas have evidence/decision classification; runtime negative states and recovery/owner-approval exceptions are explicitly reserved as Phase 2 acceptance gates. Do not claim those unexecuted tests PASS. See [bulk audit registry](./WHOLE_APP_PHASE1_BULK_AUDIT_649.md).

**Task 2/2: MASS CORRECTION SECOND — ACTIVATED AFTER PHASE 1 FREEZE.** Deliver corrected shared owners and domain contracts in the **fewest coherent compatible implementation batches**; favor one final review head if safe. Keep PRs draft during churn. Use targeted/local/source tests within implementation, **not** full CI for every small edit. Run required CI, rendered desktop/tablet/mobile Chromium, WebKit, Lighthouse, CodeQL and Windows only on the final coherent Ready head(s). An intermediate full gate is justified only at a genuine high-risk auth/security, migration, dependency, recovery or finance architecture boundary. Never weaken gates or merge/deploy when they fail/pending.

**Concurrent work freeze:** #646 merged into develop (3/3 implementations, 13/13 subimplementations). #648 code in PR #651 completed (2/2 · 3/3), draft-source CI/CodeQL passed and a full Ready CI #40937113673 had already launched before the new owner instruction. #652 I18.01 source+guard in draft PR #653 is already **1/132 subimplementations** in #649, but still pending full acceptance; preserve both staged changes without expanding micro-PR/full-CI loops. #650 owns audit docs and should remain draft until audit closeout. #645 main release remains independently approval-gated. Android separate.

**Progress reporting:** Phase 1 audit `N/23 reviewed-and-triaged areas`; Phase 2 implementation `Implementations X/23 completed · Sub-implementations A/132 completed` (currently **0/23 · 1/132** source-implemented). Audit/CI, integration and production are separate statuses. Reconcile denominators **once at the bulk audit freeze**, with evidence, instead of reopening tracking for each small tweak.

**Artifact provenance:** successful CI #40921547456 yielded **736 PNG and 50 JSON**: **712 screenshot registrations in 49 QA suite JSON files plus 24 route full-page captures in one manifest**, across 45 QA visual folders/categories. Only sampled images have been personally opened at full resolution so far; the remainder is QA evidence to triage, not automatically manual visual acceptance.

**Authority:** issue #649 · `AGENTS.md` · durable owner decisions #266 · [whole-app evidence matrix](./WHOLE_APP_AUDIT_649_EVIDENCE.md) · previous [consolidated audit from #646](https://github.com/MariosGiannakaras/MyFinHub/blob/fix/646-audit-v21-first-batch/docs/audits/CONSOLIDATED_AUDIT_20261029.md).

**Historical 2026-10-29 intake state (superseded by the current 2026-11-19 header): Implementations 0/23 completed · Sub-implementations 1/132 completed (I18.01 had been staged on #652 branch).** These are **proposed code/contract/QA-tool implementation packages**, not 132 proven defects or 132 independent PRs. A candidate failing reproduction can be retired/replaced explicitly before implementation, with the plan denominator updated. Count completion only when scoped code/config and a relevant reviewed regression guard exist. Do **not** count screenshots/CI/merge/deploy as code work.

## Scope and source of truth
- Scope **only** `MariosGiannakaras/MyFinHub`: web, API, Supabase contract and Windows/desktop. Android code is strictly excluded.
- Snapshot: `develop@18e925b3dfbc81ab82099f1351a2d25b19845a3d` as integration base; audited exact UI head PR #647 `1814d72bfa3d6aa151a7a50a43feee80d6a8ba16` (full mandatory [CI #40921547456](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40921547456) **SUCCESS**, PR not merged at audit intake); `main@78325762d564d0aa04cc576d04e1f22b5c8d2871` is separate production/release. Draft #645 owns v1.7.1 auth production promotion. Separate #648 owns Transactions EOD labeling and lending cash signs (`cd433580d68fd1c948714dc3c088b41fdb777ef5`), currently 1/2 implementations and 2/3 sub-implementations code-complete on its own plan.
- Source reviewed: all 12 route JSX owners, 7 Settings tabs, AppShell/App, 17 representative complex interactions, finance selectors, auth/API, desktop-related source, prior #616/#630/#646, 24 exact-head full-page desktop+mobile renders and 32 representative other generated states; 786 image entries exist in final visual artifact, **not** all individually inspected at native resolution. Completed automated CI is an important *positive baseline*, not proof that every workflow/negative state has been exercised.
- **Evidence disposition:** **A** confirmed source/runtime failure or semantic contradiction; **B** candidate from screenshot/code requiring controlled reproduction; **C** owner-dependent UX choice; **D** already correct/accepted invariant; **S** cross-store/security/recovery risk requiring targeted evidence, not presumed exploit. Do not mutate to resolve B/C/S without first proving necessity and preserving constraints.
- Preserve finance event/leg engine, historic edits, RLS, single-owner+AAL2, save receipts, backup/audit, card vault boundaries and non-destructive storage. Do not add destructive migrations or production restores without explicit owner approval.

## Sequencing and scope ownership
| Phase | Focus | Rules |
|---|---|---|
| **Gate 0** | Integrate already accepted #647 into develop only after direct final screenshot/diff review; reconcile #648 on current develop | *Excluded* from new 0/23 plan counters; never lose concurrent changes |
| **P0 domain/recovery** | I03, I05, I10, I11, I18, I19, I22 | Independent bounded issues and finance/security negative-path tests; high-risk gates before adjacent work |
| **P1 shared system** | I01–I02, I23 | Shared-first; prevent duplicated CSS and run sibling theme/control blast-radius |
| **P1 route semantics** | I04–I14 | Coherent route groups after shared owner stabilizes; focused rendered Desktop/Tablet/Mobile |
| **P1 Settings/overlays** | I15–I17, I20–I21 | Complete 7 tabs, all dialogs/Windows contracts and relevant dark/light/error states |
| **Integration** | Final coherent review heads then develop; separate validated develop→main release | No merge while required gates pending/failing; no implicit production deploy |

This ordering is a **dependency graph**, not a request to start all 23 branches. Security/database/migration/backup boundaries get intermediate gates where unsafe to proceed otherwise.

## Code work packages and explicit sub-implementations

### I01. Shared AppShell, navigation and routing — 0/6

**Priority:** P1 · **Owner:** `AppShell, routing, period controls, command entry` · **Dependencies:** none

- [ ] **I01.01** Align sidebar/More-menu, route titles, current-route highlight and Greek labels across desktop/tablet/mobile without changing canonical route IDs.
- [ ] **I01.02** Verify global period-navigation availability and actual active period after route switch; standardize contextual month/as-of semantics where wrong.
- [ ] **I01.03** Give global search, history, refresh and notification popovers anchored flip/edge containment and keyboard/focus return; reproduce historical G-01 tooltip overlap.
- [ ] **I01.04** Audit route loading, lazy-import failure, unknown hash, route recovery and changed-route focus; preserve recoverable PageErrorBoundary.
- [ ] **I01.05** Reconcile persistent shell privacy visibility and route-scoped money screens against an explicitly approved scope; document nonpersistent reset/no accidental reveal.
- [ ] **I01.06** Guard mobile bottom bar/More-menu, safe areas, 200% zoom, text scaling, route transitions and overlay z-index as one shell contract.

### I02. Shared visual system, typography and semantic controls — 0/6

**Priority:** P1 · **Owner:** `src/lib/theme.ts, Surface/Button/Input, root-compat.css and tokens` · **Dependencies:** after #647 visual baseline

- [ ] **I02.01** Inventory 80+ ordered CSS compatibility imports and effective selector/token ownership; consolidate repeated root causes rather than adding narrow override chains.
- [ ] **I02.02** Normalize default buttons, selects, money/date inputs, autocomplete and validation/focus states by shared role across login, editors, settings and Quick Entry.
- [ ] **I02.03** Ensure destructive action tokens survive primary accent rules in standard and confirm surfaces; regress exact #646 T-03 fix.
- [ ] **I02.04** Resolve dense Greek typography/minimum readable sizes, truncation/overflow-wrap rules and number tabular alignment at 320/375/390/768/1440/2560.
- [ ] **I02.05** Audit dark/light/forced high-contrast + reduced-motion + browser autofill states and accessible semantic positive/negative/warning contrast.
- [ ] **I02.06** Replace risky `nth-of-type`/DOM-index and ad hoc width assumptions with explicit component/variant semantics, backed by bounded sibling tests.

### I03. Login, TOTP, sessions and authentication recovery — 0/6

**Priority:** P0 · **Owner:** `LoginScreen, MfaScreen, server/auth, API/session guard` · **Dependencies:** independent release #645 login fix; owner/AAL2 invariants

- [ ] **I03.01** Reconcile current Login error state with #641/#645 and validate failed credential, offline, server-unavailable and retry in all viewports/themes.
- [ ] **I03.02** Cover TOTP enrollment, challenge, invalid/expired OTP, auto-verify, factor reset and back navigation; never introduce an MFA bypass.
- [ ] **I03.03** Verify session-expiry and AAL2 downgrade from active pages, stale cookies/bearer provenance, failed refresh and recoverable focus without leaking finance data.
- [ ] **I03.04** Recheck API owner-UID and AAL2 denial paths for login-adjacent/profile/vault/finance requests, SameSite/Origin and cookie vs bearer behavior.
- [ ] **I03.05** Confirm accessibility of labels, OTP digit entry, paste/keyboard, live error announcements, 200% zoom and mobile dark mode.
- [ ] **I03.06** Preserve and regression-lock app-lock PIN and active-device session revocation interaction and timing without asserting device identity data not available.

### I04. Dashboard / Επισκόπηση — 0/5

**Priority:** P1 · **Owner:** `DashboardPage.tsx, DashboardRecharts, dashboard selectors` · **Dependencies:** #647 before modification; #648 owns cash sign

- [ ] **I04.01** Reconcile Dashboard lending/repayment cash signs with #648 after it owns the head; preserve receivable/operational-income separation.
- [ ] **I04.02** Guard hidden/revealed money and charts across account cards, summary, categories, recent movements, secondary balances and tooltips; privacy scope requires owner contract.
- [ ] **I04.03** Confirm account hierarchy, IBAN absence, account chart historic/future dates, first-/last-month balance provenance and large-number stress.
- [ ] **I04.04** Improve EOD vs event contextual labels and comparison percent-zero-basis explanation without changing canonical finance computations.
- [ ] **I04.05** Resolve duplicate recurring/exposure labels and verify footer security/encryption claims against actual scoped guarantees before copy changes.

### I05. Transactions / Συναλλαγές — 0/6

**Priority:** P0 · **Owner:** `TransactionsPage, selector, ledger and legacy adapter` · **Dependencies:** #648 owns EOD/sign work; full per-event balance separate

- [ ] **I05.01** Integrate #648 truthful end-of-day balance labeling, first-account provenance and ± lending cash direction; preserve existing merged logic.
- [ ] **I05.02** Design canonical per-event account running-balance contract only with deterministic same-day ordering, snapshots, legacy overrides, transfers and account-leg reconciliation tests.
- [ ] **I05.03** Correct 200%/mobile/tablet ledger geometry, selected-detail panel width, long Greek notes, dates and keyboard selectable rows without hiding actions.
- [ ] **I05.04** Reproduce full-page QA screenshot showing only ~2 visually painted rows despite '20 of 68'; distinguish animation capture timing from actual rendering/infinite scroll fault, then lock stable capture.
- [ ] **I05.05** Recheck filtering/sorting/date range/pagination/export, accurate counts, empty/no-results states, and shortcut/deep focus for exact event.
- [ ] **I05.06** Exercise edit/delete/undo/receipt/recurring linkage/correction conflict and native/legacy semantic preservation, with durable receipt and failure UI.

### I06. Savings / Αποταμίευση — 0/5

**Priority:** P1 · **Owner:** `SavingsPage, goal projections, domain savings` · **Dependencies:** #646 S-03 completed

- [ ] **I06.01** Align savings header/action/content widths across large desktop and mobile; preserve shared Surface grid ownership.
- [ ] **I06.02** Correct chart tick precision and repeated labels for low ranges without synthetic maximum or manipulating underlying balances.
- [ ] **I06.03** Explicitly distinguish monthly savings flow, common cash pool, per-goal target and nonreserved goals; verify #646 S-03 remains intact.
- [ ] **I06.04** Reproduce and guard saving transfer, manual cash offset, HELP/RETURN and goal allocation with linked-account selection and no double posting.
- [ ] **I06.05** Test goal create/edit/delete/over-target, date/deadline, future events, conflict, autosave receipt, empty/large-state and dark/light.

### I07. Debit and prepaid Cards / Κάρτες — 0/5

**Priority:** P1 · **Owner:** `CardsPage, CardCreateDialog, CardDetailsDialog, bank visuals` · **Dependencies:** no Android repo change

- [ ] **I07.01** Reconcile card header/recent activity panel widths and large desktop whitespace without implying debit card owns a separate ledger.
- [ ] **I07.02** Verify exact 16-digit PAN 4×4 input, expiry/CVV, credential reveal/hide, clipboard state, and zero layout shift at 320/375/1440.
- [ ] **I07.03** Review card stack, archive/recovery/hard-delete settled-state requirements, close focus, keyboard/drag interactions and responsive action affordances.
- [ ] **I07.04** Validate linked-account transaction provenance: repeated merchant charges remain separate account ledger events, no fabricated card transaction grouping.
- [ ] **I07.05** Guard vault receipt, encrypted secret exclusion from ordinary FinanceData, reveal after reload, partial save/upload failure, cleanup/retry and privacy.

### I08. Credit cards / Πιστωτική — 0/6

**Priority:** P1 · **Owner:** `CreditCardPage, credit statement selectors, secure card UI` · **Dependencies:** #647 A-02 verified

- [ ] **I08.01** Reconcile individual selected-card limit vs aggregated portfolio limits/debt/available credit in every card, report and statement.
- [ ] **I08.02** Reproduce Greek nickname/glyph clipping at exact 320/375/1440/2560 and computed font; preserve real on-card edit WYSIWYG geometry.
- [ ] **I08.03** Add discoverable clickable card stack indicators if compatible with existing drag, touch and ArrowUp/ArrowDown keyboard behavior; focus state and reduced motion.
- [ ] **I08.04** Localize statement/order terms accurately (κατάσταση λογαριασμού), verify dense header/progression and mobile long-page section navigation.
- [ ] **I08.05** Retest purchase/spending, card-payment non-spending, multi-source payment, due-cycle, interest, overlimit, historic as-of and unposted future state.
- [ ] **I08.06** Verify archive only when settled, debt tombstone invariant, delete confirmation, card vault secret isolation, negative paths, real save receipt.

### I09. Loans and installments / Δόσεις & Δάνεια — 0/5

**Priority:** P1 · **Owner:** `LoansPage, loan lifecycle and linked payments` · **Dependencies:** canonical Loans domain remains owner

- [ ] **I09.01** Reconcile full-width panels/embedded rows for 1440/1920/2560 and compact mobile without moving ownership of payment actions.
- [ ] **I09.02** Clarify installment number vs actual payment date/elapsed status and support historical/future as-of without fabricated due dates.
- [ ] **I09.03** Verify exact installment coverage, partial/full payments, duplicate prevention, loan-specific payoff, end-of-term and forgiven status.
- [ ] **I09.04** Test linkage from Recurring and Attention to canonical loan and deep-focus, without creating duplicate active recurring loan obligations.
- [ ] **I09.05** Render-check loading/empty/completed long lists, 320/375 dark/light, keyboard and ownership of confirmation/notification.

### I10. Lending and receivables / Δανεικά-Οφειλές — 0/5

**Priority:** P0 · **Owner:** `LendingPage, receivable selector and settlement dialog` · **Dependencies:** #648 Dashboard cash sign overlap

- [ ] **I10.01** Align master/list/detail/summary widths and selected person focus across desktop/tablet/mobile without nested clipping.
- [ ] **I10.02** Reconcile receivable positive asset vs account cash −/+ movements; preserve non-operational income/expense semantics.
- [ ] **I10.03** Verify writeoff vs archive vs deletion confirmation copy and only allowed neutral-tombstone/history-preserving operations.
- [ ] **I10.04** Exercise partial/multiple repayments, historic as-of, future-dated event exclusion, overpayment guards and custom person mapping.
- [ ] **I10.05** Guard masked/unmasked receivables across summary and details, date/amount formatting, failure/conflict/pending receipts.

### I11. Recurring subscriptions and obligations / Πάγια — 0/6

**Priority:** P0 · **Owner:** `RecurringPage, recurrenceCadence, Attention selector, forecast` · **Dependencies:** #646 overdue-display done; forecast approval gated

- [ ] **I11.01** Preserve shared canonical `recurringDue` current/overdue state and separate `nextRecurringDate` future schedule, with explicit time reference in UI.
- [ ] **I11.02** Define unpaid past-cycle forecast policy via approved booked/due/estimated distinction; guard no double counting across 1/2/12/24-month cadences.
- [ ] **I11.03** Retest early/partial/duplicate payments, pause/stop/resume, day-end/Feb/annual rollover and linked canonical Loans payment.
- [ ] **I11.04** Clarify variable amount estimate vs actual recorded amount; align due-state primary/secondary CTA hierarchy after visual/product review.
- [ ] **I11.05** Check provider logos/branding partial upload failure, mobile/dark long names, event origin and retry/conflict feedback.
- [ ] **I11.06** Protect historical legacy identity and lifetime purchases from forced monthly recurring reclassification.

### I12. Planning and future cashflow / Προγραμματισμός — 0/5

**Priority:** P1 · **Owner:** `PlanningPage, scheduled cashflow, forecast components` · **Dependencies:** #647 P-02/P-03 complete

- [ ] **I12.01** Reconcile nested pending-list scroll/last-row reachability, keyboard wheel/trackpad and 320/mobile long-viewport accessibility.
- [ ] **I12.02** Keep current portfolio visible and flat sparklines centered as fixed #646, with true forecast vs booked value provenance.
- [ ] **I12.03** Distinguish scheduled/estimated/due/actually posted transactions in labels, chart legend, tooltip and date resolution.
- [ ] **I12.04** Test create/edit/skip/cancel/complete/failure/undo scheduled events with exact one logical posting, negative scenarios and conflict receipts.
- [ ] **I12.05** Verify multi-account cash projections, large dates/amounts, expected negative balances and history comparison without double posting.

### I13. Attention center / Έλεγχος — 0/5

**Priority:** P1 · **Owner:** `AttentionPage, action contracts and canonical due selectors` · **Dependencies:** #647 E-02/E-03 complete

- [ ] **I13.01** Recheck urgent count/icon/copy semantic correctness and group hierarchy in the last full-page 375×2495 capture.
- [ ] **I13.02** Audit per-alert source links and exact destination/focus for loan, recurring, scheduled, budget, credit and legacy review actions.
- [ ] **I13.03** Verify global in-session privacy, amount masking, switching surfaces and no persistence of private visibility.
- [ ] **I13.04** Review false urgency/due classifications, keep/reject semantics, source provenance and no automatic finance mutation from advisory review.
- [ ] **I13.05** Normalize dense action-button styles, long lists and actionable error/empty states with focus/keyboard/reduced motion.

### I14. Reports, budgets and rules / Αναφορές — 0/6

**Priority:** P1 · **Owner:** `ReportsPage, report selectors, budget and rule editors` · **Dependencies:** #647 A-01/02/03/04 complete

- [ ] **I14.01** Guard account/report as-of period boundaries, current vs historical upcoming obligations, and percentages el-GR without runtime transposition.
- [ ] **I14.02** Render-check nested single-credit-summary full-width card vs global operations grid; examine Reports screenshot with empty-looking credit-analysis panel before declaring bug.
- [ ] **I14.03** Clarify positive-only account distribution vs whole-account net worth, aggregate vs selected-card denominator and budget source provenance.
- [ ] **I14.04** Audit category/counterparty entry wrapping, stable category colors/icons, legend/ticks across empty/large/negative/zero-value datasets.
- [ ] **I14.05** Recheck budget create/edit/delete/rule priority/rollover, canceled/pending receipts, conflict, shortcuts, keyboard and deep links.
- [ ] **I14.06** Review 375×4259 mobile long scroll, section anchor visibility, sticky controls, dark theme and horizontal overflow with stress fixtures.

### I15. Settings — General, Profile and Readability — 0/5

**Priority:** P1 · **Owner:** `SettingsPage tabs general/profile, AccountSecuritySettings` · **Dependencies:** release #645 auth errors separate

- [ ] **I15.01** Audit General vs Profile information hierarchy to remove redundant platform metadata without hiding support/diagnostics.
- [ ] **I15.02** Review settings tabs as tabs (selection/arrow navigation/activation/focus) on 320/375/768/desktop including deep-linked active tab.
- [ ] **I15.03** Validate readability/theme preference persistence, large text, reduced motion, focus contrast and browser/native accessibility.
- [ ] **I15.04** Recheck profile email/owner session and security actions against actual supported backend calls; no fictitious device activity metadata.
- [ ] **I15.05** Verify messages/copy in Greek, timestamps, login/session failure instructions and no unsupported claims about encryption/recovery.

### I16. Settings — Accounts and Financial Providers — 0/6

**Priority:** P1 · **Owner:** `AccountManagementSettings, FinancialProviderManagementSettings` · **Dependencies:** #647 ST-03 complete

- [ ] **I16.01** Preserve fixed provider summary spacing/technical ID only in edit field; guard long Greek names and heading alignment.
- [ ] **I16.02** Verify account create/edit/default/reorder/deactivate/delete eligibility and exact dependency blockers without changing historical references.
- [ ] **I16.03** Check IBAN data provenance/secure store, missing account details, owner+AAL2 server validation, clipboard and masked display where contracted.
- [ ] **I16.04** Test bankmark/logo chooser upload/replacement/delete/partial success with rollback and no orphan secrets or storage assets.
- [ ] **I16.05** Cover account/provider modal focus, keyboard search, 320/375 mobile panels, long form errors and receipt-driven status.
- [ ] **I16.06** Keep one coherent account/provider component ownership model and avoid per-page duplicate dropdown/action styling.

### I17. Settings — Categories, Icons and Automation Rules — 0/6

**Priority:** P1 · **Owner:** `CategoryIconsWorkspace, taxonomy and BudgetRuleSettings` · **Dependencies:** live approved 20/6+71; no mass overwrite

- [ ] **I17.01** Inventory exact approved 20 expense +6 income/71 subcategories and aliases from current source; guard counts and no silent legacy rewrite.
- [ ] **I17.02** Review taxonomy editor density: progressive disclosure and grouped actions that preserve all existing subcategory controls and keyboard access.
- [ ] **I17.03** Compute actual icon-resolution coverage per pack and user preference; distinguish missing direct mapping from runtime missing icon before patch.
- [ ] **I17.04** Test approved taxonomy changes, category retirement/dependency blockers, history-safe references and protected finance revisions.
- [ ] **I17.05** Check rule priorities, edit/reorder/disable conflict, pending/rejected receipts and deep-link-to-editor from reports/command palette.
- [ ] **I17.06** Guard mobile/dark icon picker previews, input ARIA, Greek hierarchy and category labels with stress content.

### I18. Settings — Data, backup, restore and device security — 1/6

**Priority:** P0 · **Owner:** `Settings data/import, DesktopBackupPanel, DeviceAccessSettings` · **Dependencies:** #646 X-01/X-06/X-07 review; destructive restore approval

- [x] **I18.01** Make in-app FinanceData JSON backup coverage explicit: vault/card secrets, IBAN, provider logos/storage, local receipts and device/PIN are excluded where true.
- [ ] **I18.02** Design and verify independently restorable non-destructive PostgreSQL+Storage checkpoint procedure; do not run production restore or overwrite without explicit approval.
- [ ] **I18.03** Recheck backup freshness/status by revision and timestamp, invalid/corrupt archive, retention/history boundaries, device-specific desktop backup path.
- [ ] **I18.04** Test import preview/size validation, pre-import backup/confirmation, conflict and interrupted partial failure; no destructive migration or silent real-data replacement.
- [ ] **I18.05** Verify device session list, revocation denial paths, stale access, active owner+AAL2 authorization and red failure vs genuine green save receipt.
- [ ] **I18.06** Run desktop backup panel empty/restore/failure/retry/light/dark/mobile accessibility with no physical device gate.

### I19. Quick Entry, payments, local receipts and spending capture — 0/7

**Priority:** P0 · **Owner:** `QuickAdd, ContextualQuickAdd, ReceiptAwareQuickAdd, payment flows` · **Dependencies:** cross-store partial writes and domain posting

- [ ] **I19.01** Audit all create/edit transaction types and actual account/source-target-result editors via shared MoneyInput/Category/Date and keyboard/validation.
- [ ] **I19.02** Guarantee each payment posts exactly one canonical logical event and correct ledger legs across credit, loans, lending, recurring and savings.
- [ ] **I19.03** Verify receipts remain local/authorized, filename/image restrictions, OCR limitations, mapping, ambiguous matches, duplicate imports and no exfiltration.
- [ ] **I19.04** Test independent asset upload/metadata and finance revision partial-success states, cleanup, retry/idempotency and conflict feedback.
- [ ] **I19.05** Recheck Quick Entry discard/dirty close, confirmation, focused error, pending mutation disabled fields, undo and no false success.
- [ ] **I19.06** Guard legacy transaction reclassification/splits/Pay&Save/IRIS semantics and taxonomic owner-approved aliases without inference from note alone.
- [ ] **I19.07** Inspect responsive desktop/tablet/mobile dialogs, dark/light, offline, long labels, keyboard and text-size effects.

### I20. Shared dialogs, History, Command Palette and confirmations — 0/6

**Priority:** P1 · **Owner:** `DialogShell, ConfirmDialog, HistoryDialog, CommandPalette` · **Dependencies:** shared-system changes require sibling sweep

- [ ] **I20.01** Review DialogShell focus trap, dialog labels, Escape, nested confirm, inert background and focus restore under route/scroll changes.
- [ ] **I20.02** Audit shared confirmation danger/destructive/undo copy and cancel paths; do not confuse archive vs permanent writeoff/delete.
- [ ] **I20.03** Verify command palette search exact entity ranking and destination focus for transactions, persons, credit, recurring, budgets and schedules.
- [ ] **I20.04** Audit History time travel, undo/redo, conflict/restore/partial write, crossed branches and provenance without silently rewinding immutable ledger.
- [ ] **I20.05** Reproduce tooltips/popovers/overflow at topbar and bottom sheet, anchored flipping and reduced motion, with shared regression geometry.
- [ ] **I20.06** Exercise copied sensitive value, clipboard fallback, live status/error role, text truncation and mobile reduced-viewport dialogs.

### I21. Windows desktop-only shell, updates and app lock — 0/5

**Priority:** P1 · **Owner:** `Windows/Electron titlebar, loopback, app lock, updater, backup` · **Dependencies:** never require physical hardware as baseline

- [ ] **I21.01** Validate installed-user launch/first run/loopback without runtime configuration prompts or packaging secret credentials.
- [ ] **I21.02** Audit app-owned PIN lock/recovery/rate limit, owner+AAL2 session timing, lock-after-idle and foreground/background visibility.
- [ ] **I21.03** Recheck desktop titlebar, updates, tray/minimize/close navigation, zoom/keyboard/dark/light and error-recovery affordances.
- [ ] **I21.04** Verify desktop backup/restore native file semantics, safe file picker/permission denied, no partial restore and exact user-visible scope.
- [ ] **I21.05** Inspect automated Windows installer/lifecycle/rendered QA artifacts on final review head and preserve installer-size/security limits.

### I22. Finance/API/Supabase authorization and multi-store correctness — 0/7

**Priority:** P0 · **Owner:** `canonical domain, API, migrations, RLS, storage and vault` · **Dependencies:** reviewed migrations only; never direct prod DML

- [ ] **I22.01** Add read-only financial reconciliation fixtures for events/legs/account references, same-date running values, historical snapshots, refunds, savings and cash sign parity.
- [ ] **I22.02** Exercise owner UID+AAL2 and provenance failure paths on each finance/metadata/RPC/storage/vault endpoint; keep public client key separate from offline admin secrets.
- [ ] **I22.03** Review three app-lock SECURITY DEFINER RPC grants and private RLS performance WARNs with negative-path tests; do not widen policies to silence advisors.
- [ ] **I22.04** Review leaked-password protection security advice against supported Supabase auth settings and risk; apply config only through approved secure change.
- [ ] **I22.05** Guard revision conflicts, FIFO mutation acknowledgements, backup/history revision consistency and ancillary-vault/storage partial success without false-green save state.
- [ ] **I22.06** Test material financial definitions: booked vs due vs estimated, receivable vs cash, credit purchase vs payment and positive-only distribution vs net worth.
- [ ] **I22.07** Establish sensitive-data/redaction invariants for diagnostics, screenshots, browser console, Windows logs and app memory while testing recovery.

### I23. Cross-app rendered QA, accessibility, performance and regression tooling — 0/7

**Priority:** P1 · **Owner:** `scripts/run-rendered-qa, visual-evidence, defect intelligence` · **Dependencies:** on last coherent batch only

- [ ] **I23.01** Fix visual evidence capture stability: Transactions staggered enter/virtual rows, Dashboard deferred charts, fonts/images/layout ready before full-page screenshot.
- [ ] **I23.02** Build a durable interface-state coverage manifest covering 12 routes × breakpoints/themes plus 7 settings tabs, auth, modals, error/empty/loading/conflict/offline.
- [ ] **I23.03** Expand meaningful regression locks for focus, aria-live, keyboard, 200% zoom, responsive overflow, hover/focus/danger, reduced motion and long Greek labels.
- [ ] **I23.04** Add selective visual geometry/data provenance fixtures rather than screenshot-pixel overrides, and document confirmed defect classes in quality/defect-patterns.json.
- [ ] **I23.05** Retain exact-page source tests and narrow browser preflight for changes; run complete rendered + WebKit + Lighthouse + Windows matrix only on final coherent Ready heads.
- [ ] **I23.06** Audit bundle budgets, loading skeleton shift, large-data route responsiveness and accessibility contrasts without weakening thresholds.
- [ ] **I23.07** Ensure immutable artifact provenance (head SHA, QA fixture, date, viewport, theme, privacy state) and direct assistant inspection before accepting UI changes.

## Evidence and release acceptance — separate from code implementation counters
1. **Baseline/ownership:** read latest `AGENTS.md`, #266, task issue/branch plan, live open PRs, current develop and relevant changed files before each batch. Prefer the latest branch plan over summaries.
2. **Defect class and state model:** for each item record A/B/C/D/S classification, reproducible fixture, source ownership, sibling blast radius, related existing guard, intended acceptance and exceptions. If unsupported, mark **REJECTED/no patch**, revise denominator and rationale; do not distort implementation completion.
3. **Narrow preflight:** relevant Vitest/domain/source/TS/build, `npm run defects:preflight` if executable, exact failing breakpoint and representative sibling states. No budget, accessibility, bundle or test weakening.
4. **Rendered acceptance:** inspect generated Chromium and WebKit desktop/tablet/mobile evidence for modified state(s), Light/Dark and relevant empty/populated/large/error/conflict/keyboard/zoom/reduced-motion dimensions. Capture actual page after visual steady state; do not accept a screenshot showing not-yet-painted rows as a content defect or as a normal state.
5. **Financial/security acceptance:** test positive/negative owner+AAL2, finance event legs/revision/history, partial backend success, account/date/report semantics and backup exclusions whenever touched.
6. **Final gates:** run full required CI, CodeQL, rendered/browser/accessibility, Lighthouse, installer/Windows, DB/security/release gates at each final coherent review head; observe actual check conclusion and inspect artifacts. Optional final 216-image acceptance is only invoked after normal gates and focused surfaces pass.
7. **Integration:** merge to `develop` only with clean protected required gates and no unresolved review comments; update issue/PR/plan and audited final merge SHA. `main` is production-only through separately approved release PR and observed Vercel production smoke, not a side effect of this plan.
8. **Manual review definition:** direct assistant inspection of generated browser/CI screenshots/logs/artifacts. No physical Windows hardware requirement unless explicitly asked.
9. **Backup/security boundary:** obtain non-destructive independent recovery evidence; *do not* reset/restore the live production DB, delete files, import history, rotate secrets or modify Supabase policies without an explicitly reviewed and approved path.
10. **Progress template, required on all substantive updates:** `Implementations X/23 completed · Sub-implementations A/132 completed`, then independent **Validation/CI**, **Integration/merge**, **Production/release** sections. Keep #647 and #648 counters separate; do not call this audit plan completed remediation.

## Audit closeout and immediate next safe action
- This branch intentionally stores a **plan and evidence matrix only**; no product source code changed, no Android/production/DB mutation.
- **First:** complete and directly inspect PR #647's last 24 route screenshots and exact-head diff, verify all required checks `SUCCESS` and protected-merge conditions; reconcile only accepted delta into develop. This gate is owned by #646 and is not counted as I01 or a new #649 fix.
- **Second:** rebase/reconcile #648 onto new develop and complete Dashboard cash-sign subitem without touching separate Android work; its own progress remains 1/2 and 2/3 until implemented.
- **Third:** start the highest-priority unblocked P0 issue from this map with one coherent owned batch. If recovery capability needs external destructive approval, do not block safe read-only/a11y/layout investigations; document that exact blocker.

## First implementation checkpoint — 2026-10-29 (#649 I18.01)
- Gate 0: #647 PR merged to `develop@f10b963f650a5b9c185512986d62d572c7ef4420` after exact [CI #40921547456](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40921547456) SUCCESS and direct 24-route screenshot inspection. This accepted earlier work remains excluded from the new 132.
- Previous finance UX #648 reconciled onto current develop, **2/2 implementations · 3/3 sub-implementations code complete**, [draft PR #651](https://github.com/MariosGiannakaras/MyFinHub/pull/651) at `deca7e588e5467abc5b4910f0f760fc890cc5649`. Draft CI pending at initial checkpoint; no merge.
- **I18.01 complete as code** on `fix/652-financedata-backup-scope-copy@c8b64ccc292a3550c4a8b648c6c80d773a5e3fbf` in [draft PR #653](https://github.com/MariosGiannakaras/MyFinHub/pull/653): corrected Settings Data backup/import/JSON copy explicitly excludes Card Vault/IBAN/Storage/local receipts/PIN and distinguishes the finance JSON from full PostgreSQL+Storage restoration. Added focused source guard. No backend/data mutation. **Implementation counters: 0/23 · 1/132, I18 = 1/6.** Validation/CI and integration are separate and pending.
- I18.02 independent full DB+Storage restore test still **not proven**, and is not implicitly authorized by UI copy work. No production DB restore, destructive migration or release.
- **Next safe action:** inspect draft CI/CodeQL for #651 and #653, correct any failures in bounded batches, use one final Ready QA matrix per coherent head, inspect real browser screens. Do not merge pending/failed checks. When both independently pass, merge to develop in safe order, reconcile this docs PR #650 with the updated develop head, and continue the highest-priority P0 subitem.

## Mass-audit cross-surface source evidence checkpoint — 2026-10-29
- The entire planned **23-area** matrix has been mapped to all 45 generated suite surface categories, with representative direct screenshot and source owners, without claiming 23/23 audit closeout. [Evidence mapping and confirmed screenshot-timing root](./WHOLE_APP_PHASE1_CROSS_SURFACE_TRIAGE_649.md).
- Confirmed instrumentation defect: `ui-ux-visual-evidence-qa.mjs` routes wait 120 ms after heading while table rows can start 90 ms late and animate 170 ms; same-run Transactions baseline has many visible rows but final full-page captures mostly blank/faded ones. Treat as screenshot-paint timing failure class, not finance ledger data loss; **no patch during phase 1**.
- Existing #651 Ready CI [#40937113673](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40937113673) on `deca7e588e5467abc5b4910f0f760fc890cc5649` completed SUCCESS; it was initiated before the owner switched to bulk CI, so no new small Ready run should follow. #653 staged draft and #650 audit-only.
- **Progress:** Phase 1 audited/inventoried **23/23 surface groups**, fully **closed 0/23** after strict per-group triage; Phase 2 **Implementations 0/23 · Sub-implementations 1/132**. Avoid new micro-PR/full CI. Keep existing source unchanged.

## Phase-1 bulk audit triage accepted: 3/23 areas (2026-10-29)
- [I05, I11 and I18 closed audit **classification**, not implementation](./WHOLE_APP_PHASE1_TRIAGED_649.md). Existing source, focused tests and exact-head screenshots correlated, negative/runtime gaps explicitly parked for Phase-2 acceptance; other 20 area triages remain open.
- **New verified UI state bug BK-02**: Settings Data import success/error messaging inherits the `backupMessageIsError` flag rather than using an operation-specific result tone. Oversize file/failed import may have non-error role, and import success after backup failure may remain red. Proposed fix is one shared feedback owner and regression guard under existing I18.04 plus sibling I02/I20 audit, **not a new standalone micro implementation/CI**.
- Still no owner-dependent recurring missed-cycle policy, no independent PostgreSQL+Storage restore, no authenticated live owner recovery test, no claim that 736 PNG states were individually inspected.
- **Phase 1: 3/23 triaged; Phase 2: Implementations 0/23 completed · Sub-implementations 1/132 completed**. Existing draft #651/#653 preserved. Full CI only after final coherent implementation head.

## Live security and migration concordance triage — 2026-10-29
- **Phase 1 = 5/23 fully classified**, leaving 18. I03 Login/MFA/owner/PIN and I22 Finance/API/Supabase audit triage recorded in [WHOLE_APP_PHASE1_SECURITY_TRIAGED_649.md](./WHOLE_APP_PHASE1_SECURITY_TRIAGED_649.md) with live read-only evidence, exact tests, reviewer/approval limitations and advisor docs. Previous 3/23 checkpoint is historical.
- Supabase public tables **16/16 RLS enabled**; **58 current live migrations match 58 repository versions**. Security advisor 3 authenticated SECURITY DEFINER RPC WARN, 2 RLS no-policy INFO on purposely direct-denied PIN tables, 1 disabled leaked-password protection WARN. Performance: 2 RLS initplan WARN and 10 unused-index INFO. No unexplained production migration-version drift, but no runtime exploit/proof test and **do not** change grants or drop indexes merely to clear lints.
- **Phase 2 = Implementations 0/23 completed · Sub-implementations 1/132 completed** from prior #652. No new code/full CI, no main/deploy/Android/production mutations. Next: I19 payment/vault/receipt and I02/I20 shared feedback audit then remaining 16 areas before final deduplicated backlog freeze.

## Phase 1 source/QA triage checkpoint — I19 + I20, 2026-10-29
- **Current macro-task 1 triage: 7/23**, leaving sixteen areas. [Quick Entry, local receipts, vault, dialogs, history and commands](./WHOLE_APP_PHASE1_INTERACTIONS_TRIAGED_649.md) joins the previously accepted I03/I05/I11/I18/I22 classification. Historical 5/23 checkpoints are superseded for current counters.
- New source-backed QE-03: a successful finance submit is followed by an unhandled asynchronous IndexedDB receipt-draft delete. Test protects save-before-delete but not cleanup failure. Treat as an unhandled partial-success path, not proven double posting; group it with vault/provider partial-write feedback and BK-02 incorrect import result tone.
- **Macro-task 2: Implementations 0/23 completed · Sub-implementations 1/132 completed** (pre-existing #652 source only). No new runtime code, CI, merge or production release; preserve staged #648/#652 for a consolidated implementation after audit completion.

## Phase 1 shared shell/theme/Dashboard audit — 2026-10-29
**Current audited-and-triaged 10/23**, thirteen open. [Accepted source, guard and QA classification for I01/I02/I04](./WHOLE_APP_PHASE1_SHELL_UI_TRIAGED_649.md). Preserve default Dashboard privacy for the four explicitly scoped pages, avoid a speculative all-app mask or duplicate #648 sign fix, correct shared feedback and typography at owning components only when proven. **Implementation 0/23 packages · 1/132 pre-staged subitems**, not 10 code fixes. No full CI during this docs-only audit.

## Phase 1 finance-route bulk triage checkpoint — 2026-10-29
- **18/23 areas classified**, leaving I15/I16/I17/I21/I23. [Eight finance-route audits with direct source/test/visual provenance](./WHOLE_APP_PHASE1_FINANCE_ROUTES_TRIAGED_649.md).
- **CARD-649-01 ERRATUM / REJECTED defect:** the superseding #266 2026-10-27 owner decision requires exactly **16 numeric PAN digits for NEW/EDIT/PUT**, while allowing read-only legacy values up to 32 digits without truncation/revalidation. Current strict writer is expected; the old audit incorrectly promoted an earlier 32-digit legacy statement over the newer rule. Preserve current writer and legacy-read compatibility with focused regression guards, no new feature/patch.
- Preserve annual/monthly recurring, owner finance accounting, 16 current security RLS tables, exact saved history and explicit user product decisions. **Phase 2 implementation remains 0/23 · 1/132**, no new code, merge or CI in Phase 1. Next: close last five Settings/Windows/QA audit areas and freeze a deduplicated large-batch implementation plan with risk-gated CI.

## Authoritative Phase-1 CLOSEOUT / Phase-2 OPEN — 2026-10-30
- **Macro-task 1/2 COMPLETE at audit classification level: 23/23 surface areas, 132/132 original actions given a reasoned A/V/K/P/S/F disposition.** [Full proposed-action ledger](./WHOLE_APP_PHASE1_132_DISPOSITIONS_649.md), [last five area reports](./WHOLE_APP_PHASE1_FINAL_FIVE_TRIAGED_649.md), [single consolidated Phase-2 integration implementation program](./WHOLE_APP_PHASE2_CONSOLIDATED_BATCH_649.md). The earlier 0/23, 5/23, 7/23, 10/23, 18/23 checkpoints in this append-only master plan are history, not current progress.
- **Owner #266 superseding PAN rule corrected before any card editing:** 2026-10-27 NEW/EDIT/server PUT exactly 16 digits, legacy encrypted READ to 32 digits preserved. No new 32-digit write implementation, no test weakening. Prior CARD-649-01 “bug” classification withdrawn.
- **Macro-task 2/2 now active, code counters still Implementations 0/23 completed · Sub-implementations 1/132 completed** pending meaningful source batch. Existing #651 and #653 drafts preserved; one combined integration owner, no per-tiny-edit CI, no automatic PR merge or main release. Owner-dependent financial model P and independent recovery credential/restore proof S remain gated.
