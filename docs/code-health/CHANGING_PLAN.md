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
- [ ] Migrate bounded safe adopter groups incrementally. Batch 1 (`ConfirmDialog`, `MoneyEditDialog`, reusable `CardCreateDialog` actions) merged via PR #363. Batch 2 (`DesktopUpdatePanel`, `PageErrorBoundary`, `PersistenceNotice`, `AccountMetadataSettings`) merged via PR #364. Batch 3 is active in PR #365 and migrates generic icon-only controls in `AppDateInput`, `AppSelectInput`, and `CommandPalette` while preserving raw composite `gridcell` / `option` buttons.
- [ ] Retain compatibility aliases only while active non-migrated code still depends on them; remove only after adoption is proven complete.
- [ ] Verify keyboard/focus/disabled/loading/submit semantics and fresh rendered screenshots after each bounded migration.

Active delivery: issue #357 / PR #365 / branch `chore/357-iconbutton-adopters-batch-3`.

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

## Current checkpoint — 2026-09-09

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 2/9 (Stage 0, Stage 1).
- **Active stage:** Stage 2 — shared Button / IconButton.
- **Verified Batch-1 integration:** PR #363 merged to `develop@c97a618d4b817bed1aed3d57c6f258dda32e0e18`; post-merge CI, CodeQL and Windows Desktop passed.
- **Verified Batch-2 integration:** PR #364 squash-merged to `develop@fc6d38de49e9f235b03f2e0394e9f470daf16215`. Integration CI `34396227607`, CodeQL `34396227577`, and Windows Desktop `34396227578` all passed, including fresh rendered frontend QA and the Windows package/install/uninstall checks.
- **Superseded work:** stale pre-integration PR #360 was closed without merge; it diverged from the bounded Batch-1 path and is not a continuation branch.
- **Active PR:** #365 — `Code health: migrate shared IconButton adopters batch 3`.
- **Branch/base:** `chore/357-iconbutton-adopters-batch-3`, created exactly from verified `develop@fc6d38de49e9f235b03f2e0394e9f470daf16215`.
- **Current implementation commit:** `734dfdfb568f0923b7eb35f2edb3e9a8d85086ad` migrates the five generic icon-only actions in `AppDateInput`, `AppSelectInput`, and `CommandPalette` to shared `IconButton` and extends the source guard. Calendar day grid cells, select options and command result options remain intentional raw composite buttons.
- **Stage-2 progress:** 2/5 checklist items complete; the bounded migration item remains in progress across incremental batches.
- **Validation evidence:** human checkpoint head `41fd978c892d1e2e542f8c2bda991490b11a56bb` passed CI `34397644510`, CodeQL `34397644533`, Cross-engine `34397644503`, Performance `34397644511`, and Windows Desktop `34397644585`. Application/API checks, rendered frontend QA, audits, cross-engine smoke, performance smoke, and Windows package/install/uninstall validation are all green.
- **Rendered evidence:** CI artifact `10122570774` was downloaded and inspected. Fresh Command Palette desktop/mobile screenshots preserve the approved close-button geometry, focus treatment and responsive composition; the fresh Settings category dropdown preserves the shared select popover and close action; the fresh Recurring editor preserves the app-owned date-control presentation. The rendered/cross-engine suites also passed the app-owned date-popover open/Escape/focus path. No material visual or interaction regression was observed.
- **Generated evidence:** snapshot commit `d91c2755e9a03743f47736b9b3817c162a1576d0` contains generated `visual-qa/**` refreshes only. As in Batch 2, these are inspection evidence and will be removed from the source diff before the final exact-head gate.
- **Intentional exceptions remain:** card-design radio options and other documented domain composites stay raw until a semantically equivalent typed API exists.
- **Next action:** remove generated `visual-qa/**` refreshes from the PR source diff without rewriting history, run the repository-required exact-head gates on that cleanup head, mark PR #365 ready and squash-merge to `develop` only when green, then verify the integration push before starting another bounded Stage-2 batch.

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
