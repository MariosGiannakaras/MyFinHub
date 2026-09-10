# MyFinHub Code Health — Changing Plan

## Purpose

Durable continuation plan for the post-Phase-1 code-health cleanup. A future ChatGPT session must be able to resume from GitHub without relying on chat memory.

## Protected constraints

- Never inspect, open, quote, summarize, comment on, modify, or use GitHub issue #266.
- `develop` is the integration branch. `main` is release-only.
- No `develop -> main`, release, publish, deploy, production migration, or production-data mutation without separate explicit owner authorization.
- Preserve the owner-approved Phase-1 UI appearance unless a later owner-approved target explicitly changes it.
- Preserve finance/accounting semantics, auth/MFA/RLS/security behavior, persistence, routes, APIs, database contracts and Windows/Desktop behavior unless a stage explicitly requires a compatible fix.
- Code-health work is behavior-preserving by default. Never weaken tests, audits, accessibility, performance, security or installer gates to make a change pass.
- Keep app-owned inputs/selects/date controls; do not regress to browser-native controls where the app already owns the interaction.
- Work in bounded stages/PRs. Recover the real GitHub state before every write and resume existing work rather than creating duplicates.

## Canonical UI contracts

| Concern | Canonical contract |
| --- | --- |
| Text input | `AppTextInput` |
| Textarea | `AppTextarea` |
| Select/dropdown | `AppSelectInput` |
| Date | `AppDateInput` |
| Money/amount | `MoneyInput` |
| Category | `CategorySelectInput` |
| Validation | `FormError` |
| Modal/focus behavior | `useModalFocus` |
| App frame | `AppShell` |
| Page frame | `page-stack` + `page-heading` |
| Theme | existing semantic light/dark tokens |
| Buttons | shared `Button` + `IconButton`, preserving approved primary/secondary/danger/icon class hooks and visual language |
| Dialogs | future shared `DialogShell`, preserving existing semantic dialog specializations |
| Generic surfaces | future shared `Surface` base (`raised` / `flat` / `inset`); domain cards remain semantic components |

## Stage plan

### Stage 0 — Production-hotfix back-sync into `develop` — COMPLETE

- [x] Preserve `/api/android-update` while routing it through an existing Vercel function.
- [x] Preserve develop-only account/device capabilities while keeping the Vercel function budget at 12.
- [x] Add regression coverage for routing/function budget.
- [x] Fix Windows CRLF-sensitive source assertions without weakening contracts.
- [x] Refresh Desktop transitive `js-yaml` to patched `4.3.2` while retaining the high-severity audit gate.
- [x] Full required gates green and merged.

Completed delivery: PR #358, `develop@399253c35740a0c6666e60ec2d0eb131d82fb17d`.

### Stage 1 — Persist design-system contracts and inventory — COMPLETE

- [x] Replace bootstrap/TBD design-system and page-pattern docs with approved Phase-1 contracts.
- [x] Inventory buttons, dialogs, generic surfaces and CSS ownership.
- [x] Record intentional domain exceptions.
- [x] Add durable source-level adoption guards.
- [x] Validate, merge and verify integration.

Completed delivery: PR #359, `develop@11f1e9995a332ee2b5b039281701db3db031e98d`. PR-head CI/CodeQL/cross-engine/performance were green; the resulting `develop` CI and CodeQL were also green.

### Stage 2 — Canonical `Button` / `IconButton` — ACTIVE

Goal: replace the selector-net button contract with typed shared primitives without changing approved visuals, geometry or behavior.

- [x] Introduce typed `Button` variants for primary, secondary, danger and ghost/text-compatible actions while preserving existing CSS class hooks.
- [x] Introduce accessible `IconButton` with a required accessible `aria-label` and safe default `type="button"`.
- [ ] Migrate bounded safe adopter groups incrementally. Batch 1 (`ConfirmDialog`, `MoneyEditDialog`, reusable `CardCreateDialog` actions) merged via PR #363. Batch 2 (`DesktopUpdatePanel`, `PageErrorBoundary`, `PersistenceNotice`, `AccountMetadataSettings`) merged via PR #364. Batch 3 (`AppDateInput`, `AppSelectInput`, `CommandPalette` generic icon actions) merged via PR #365. Batch 4 (Lending generic primary/secondary/ghost/icon actions) merged via PR #366. Batch 5 (Recurring generic page-heading, mobile payment and editor primary/secondary/icon actions) merged via PR #367. Batch 6 (Loans generic page-heading and editor primary/secondary/icon actions) merged via PR #368. Batch 7 (Cards generic bank-creation heading/dialog actions) merged via PR #369. Batch 8 is active and migrates only `LegacyTransactionEditor` generic dialog close/cancel/save actions to shared primitives.
- [ ] Retain compatibility aliases only while active non-migrated code still depends on them; remove only after adoption is proven complete.
- [ ] Verify keyboard/focus/disabled/loading/submit semantics and fresh rendered screenshots after each bounded migration.

Active delivery: issue #357 / branch `chore/357-button-adopters-batch-8`.

### Stage 3 — Canonical `DialogShell`

- [ ] Extract common backdrop, ARIA, focus trapping, Escape/close, reduced-motion, header and footer mechanics.
- [ ] Migrate `ConfirmDialog`, `MoneyEditDialog`, `CardCreateDialog` and other eligible dialog shells incrementally.
- [ ] Preserve specialized body/form/destructive/busy behavior.
- [ ] Keep native `alert`/`confirm`/`prompt` prohibited.

### Stage 4 — Canonical `Surface`

- [ ] Introduce raised/flat/inset generic surface ownership.
- [ ] Migrate genuinely generic panels/cards only.
- [ ] Keep KPI/account/payment/attention and other domain cards semantic.

### Stage 5 — CSS ownership cleanup

- [x] Stage-1 inventory documented the current numbered-file graph and hidden loader coupling.
- [ ] Eliminate unrelated component-as-global-stylesheet-loader coupling.
- [ ] Replace numeric loader chains incrementally with named tokens/base/primitives/patterns/pages ownership.
- [ ] Reduce selector duplication and unnecessary `!important` only with proven visual parity.
- [ ] Keep runtime theme code focused on semantic token application rather than broad selector styling.
- [ ] Maintain deterministic visual regression evidence at every batch.

### Stage 6 — Code-hygiene tooling

- [ ] Add a low-noise lint/static-analysis baseline without mass unrelated reformatting.
- [ ] Add reliable unused import/export and dependency-cycle checks.
- [ ] Add formatting enforcement only after a low-noise baseline exists.
- [ ] Review dependency/audit debt without relaxing severity gates.

### Stage 7 — Full cleanup verification

- [ ] Full application/API checks.
- [ ] Cross-page shared-control adoption audit for every routed page/shared component.
- [ ] Rendered desktop/mobile QA for every routed surface.
- [ ] Keyboard/focus/accessibility pass.
- [ ] Windows Desktop / First Run / Clean Launch.
- [ ] CodeQL, cross-engine and performance gates.
- [ ] Personally inspect representative fresh visual evidence.
- [ ] Remove only confirmed dead compatibility code, CSS, imports/exports and obsolete aliases.

### Stage 8 — Release-readiness audit — NO RELEASE AUTHORIZATION

- [ ] Compare final `develop` against `main` again.
- [ ] Confirm Vercel function budget and production routing compatibility.
- [ ] Review migrations/backend/auth/device/provider differences explicitly.
- [ ] Verify no unresolved code-health blockers.
- [ ] Produce a release-readiness checkpoint.
- [ ] Stop before `develop -> main`, release or deploy unless separately authorized by the owner.

## Current checkpoint — 2026-09-10

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 2/9 (Stage 0, Stage 1).
- **Active stage:** Stage 2 — shared Button / IconButton.
- **Verified Batch-1 integration:** PR #363 merged to `develop@c97a618d4b817bed1aed3d57c6f258dda32e0e18`; post-merge CI, CodeQL and Windows Desktop passed.
- **Verified Batch-2 integration:** PR #364 squash-merged to `develop@fc6d38de49e9f235b03f2e0394e9f470daf16215`. Integration CI `34396227607`, CodeQL `34396227577`, and Windows Desktop `34396227578` all passed, including fresh rendered frontend QA and the Windows package/install/uninstall checks.
- **Verified Batch-3 integration:** PR #365 squash-merged to `develop@a664c31e8dd1327f6677a4d252ade611c7eba9ef`. PR exact-head CI `34399965066`, CodeQL `34399965089`, Cross-engine `34399965069`, Performance `34399965077`, and Windows Desktop `34399965067` passed. Post-merge integration CI `34401094200`, CodeQL `34401094220`, and Windows Desktop `34401094263` also passed, including fresh rendered frontend QA and Windows package/install/uninstall validation.
- **Verified Batch-4 integration:** PR #366 squash-merged to `develop@68ebce7c337f8996adb2d809edf15d59a8e1e699`. PR final exact-head CI `34409570750`, CodeQL `34409570735`, Cross-engine `34409570830`, Performance `34409570716`, and Windows Desktop `34409570727` passed after rendered QA caught and the branch fixed the shared ghost/text compatibility geometry. Post-merge integration CI `34451302610`, CodeQL `34451302579`, and Windows Desktop `34451302654` also passed, including rendered frontend QA, audits, package/install/uninstall and checksum validation.
- **Verified Batch-5 integration:** PR #367 squash-merged to `develop@8aa95989289cd3e35b3c738f5dc26f09b9c3e8d5`. PR final exact-head CI `34461507413`, CodeQL `34461507374`, Cross-engine `34461507406`, Performance `34461507522`, and Windows Desktop `34461507384` passed after fresh Recurring full-page desktop/mobile and editor desktop/mobile evidence was personally inspected. Snapshot persistence rerun `34452765557` passed after a transient CDP context failure, and generated `visual-qa/**` churn was removed from the source diff. Post-merge integration CI `34462899174`, CodeQL `34462899192`, and Windows Desktop `34462899248` all passed, including rendered frontend QA, audits and Windows package/install/launch/uninstall/checksum validation.
- **Verified Batch-6 integration:** PR #368 squash-merged to `develop@db82651aac043923dbbfccf8d1fe9592454561d2`. PR final exact-head CI `34464474191`, CodeQL `34464474300`, Cross-engine `34464474127`, Performance `34464474116`, and Windows Desktop `34464474210` passed. Fresh Cards-independent Loans desktop/mobile rendered evidence was inspected from the CI artifact; no dedicated loan-editor screenshot was emitted or claimed. Post-merge integration CI `34466727382`, CodeQL `34466727336`, and Windows Desktop `34466727238` all passed, including rendered QA, audits and Windows package/install/launch/uninstall/checksum validation.
- **Verified Batch-7 integration:** PR #369 squash-merged to `develop@5bd0af236beeb28d38974d606b5ca4a157149453` (tree `c4e3f027f64b98bd155ff86c107651f4a4ac5344`). Final PR head `400a391799363c7f640c745b8681a71531307f97` had an exact four-file net diff with generated `visual-qa/**` churn removed. Final exact-head CI `34485658967`, CodeQL `34485659077`, Cross-engine `34485658966`, Performance `34485658978`, and Windows Desktop `34485658971` all passed; additional ready-for-review Performance `34487260907` also passed. Fresh Cards evidence was inspected for 4/4 available views (desktop/mobile full-page plus desktop/mobile core-flow); no dedicated new-bank-dialog screenshot was emitted or claimed. Post-merge integration CI `34487569960`, CodeQL `34487569967`, and Windows Desktop `34487569954` all passed.
- **Superseded work:** stale pre-integration PR #360 was closed without merge; it diverged from the bounded Batch-1 path and is not a continuation branch.
- **Active Batch-8 branch/base:** `chore/357-button-adopters-batch-8`, created exactly from verified `develop@5bd0af236beeb28d38974d606b5ca4a157149453`.
- **Current Batch-8 implementation commits:** `60967443791bc362ea85cffe888f3b60650bf30b` migrates `LegacyTransactionEditor` close/cancel/save to one shared `IconButton` plus two shared `Button` instances while preserving explicit button types, accessible close name, handlers, focus semantics and the existing `icon-button` / `secondary` / `save-button` visual hooks. `6e7fe83e9c39963e069c92847554e1c0bcc80c59` adds a dedicated source ownership guard.
- **Batch-8 target controls:** 3/3 migrated in the current implementation (dialog close, cancel, save). No domain/accounting/auth/API/database/persistence/route/Windows/release/deploy behavior is intentionally changed.
- **Stage-2 progress:** 2/5 checklist items complete; the bounded migration item remains in progress across incremental batches.
- **Validation state:** Batch 8 still requires narrow source/test validation, a draft PR, exact-head application/API/CodeQL/cross-engine/performance/Windows gates, fresh rendered evidence that actually exercises the legacy transaction editor if available, generated snapshot cleanup if needed, and review-thread verification before merge.
- **Intentional exceptions remain:** card-design radio options, Cards card-domain/composite controls, Lending domain/composite controls, Recurring row/menu/history controls, Loans row actions, Planning row/horizon/kind controls and other documented domain composites stay raw until a semantically equivalent typed API exists.
- **Next action:** open a bounded Batch-8 draft PR, run exact-head validation, inspect fresh evidence without overclaiming unavailable dialog states, clean any generated snapshot churn, resolve real regressions/review threads, then squash-merge to `develop` only when final-head gates are green and verify the integration push.

## Resume procedure for a future chat

1. Read root `AGENTS.md` and directly applicable checked-in rules.
2. Read this file completely and issue #357. Do not inspect excluded issue #266.
3. Fetch the real `develop`, `main`, active branch/PR, latest commits, checks and unresolved review threads.
4. Treat GitHub as source of truth over any SHA/checkpoint recorded here if the repository has moved.
5. Continue the first incomplete item in the active stage; do not skip an open blocker.
6. Use narrow tests first, then required full gates. Never weaken behavioral/security/audit tests.
7. For UI-affecting refactors, inspect fresh real desktop/mobile rendered evidence before merge.
8. After every meaningful checkpoint update this file plus the active issue/PR with: completed X/Y, exact head, validation state, blocker if any, and exact next action.
9. After a bounded PR is merged and verified on `develop`, create/resume the next bounded branch/PR rather than piling unrelated stages together.
10. Keep #357 open until all stages are complete. No `main`, release or deploy without separate explicit owner authorization.
