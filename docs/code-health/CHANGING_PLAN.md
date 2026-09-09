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
- [ ] Migrate bounded safe adopter groups incrementally. Batch 1 (`ConfirmDialog`, `MoneyEditDialog`, reusable `CardCreateDialog` actions) merged via PR #363. Batch 2 is active in PR #364 and covers `DesktopUpdatePanel`, `PageErrorBoundary`, `PersistenceNotice`, and `AccountMetadataSettings`.
- [ ] Retain compatibility aliases only while active non-migrated code still depends on them; remove only after adoption is proven complete.
- [ ] Verify keyboard/focus/disabled/loading/submit semantics and fresh rendered screenshots after each bounded migration.

Active delivery: issue #357 / PR #364 / branch `chore/357-button-adopters-batch-2`.

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
- **Verified integration:** Batch 1 merged via PR #363 to `develop@c97a618d4b817bed1aed3d57c6f258dda32e0e18`. Exact integration push CI `34388151300`, CodeQL `34388151446`, and Windows Desktop `34388151376` passed.
- **Superseded work:** stale pre-integration PR #360 was closed without merge; it diverged from the bounded Batch-1 path and is not the continuation branch.
- **Active PR:** #364 — `Code health: migrate shared Button adopters batch 2`.
- **Branch/base:** `chore/357-button-adopters-batch-2`, created exactly from `develop@c97a618d4b817bed1aed3d57c6f258dda32e0e18`.
- **Current implementation commit:** `ac054a48fa43410111c449d8365eed80ae38d833` migrates `DesktopUpdatePanel`, `PageErrorBoundary`, `PersistenceNotice`, and `AccountMetadataSettings` to the existing shared `Button` primitive and extends the durable source guard.
- **Stage-2 progress:** 2/5 checklist items complete; the bounded migration item is in progress across incremental batches.
- **Validation state:** PR #364 exact-head workflows are required before merge. Fresh rendered evidence must be inspected for representative affected settings/recovery/persistence surfaces; no gate may be weakened.
- **Intentional exceptions remain:** card-design radio options and other documented domain composites stay raw until a semantically equivalent typed API exists.
- **Next action:** complete PR #364 exact-head CI/API/CodeQL/cross-engine/performance/Windows/rendered validation, fix only real regressions, inspect fresh evidence, then merge to `develop` if green and verify the integration head before starting the next bounded Stage-2 adopter batch.

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
