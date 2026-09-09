# MyFinHub code-health changing plan

Status: **ACTIVE**
Tracking issue: **#357 — Code health: canonical UI primitives and release-safe cleanup**

This file is the checked-in continuation source of truth for the post-Phase-1 cleanup. A future chat/session must read this file, root `AGENTS.md`, applicable checked-in rules and issue #357, then recover the live GitHub branch/PR/check state before changing code. Do not rely on prior chat memory.

## Protected constraints

- GitHub issue #266 is excluded from this workflow. Do not open, inspect, quote, summarize, comment on, modify, relabel, close, reopen or use it.
- `develop` is the integration branch. `main` is release-only.
- Do not create or merge `develop -> main`, release or deploy without separate owner authorization.
- Preserve owner-approved Phase-1 visuals, geometry, density and interaction semantics.
- Preserve finance/accounting, authentication, MFA, RLS, persistence, API and database invariants unless a separately reviewed compatibility stage explicitly requires a change.
- Prefer behavior-preserving refactors with narrow tests before broad CI.
- Do not replace app-owned controls with browser-native popups.

## Baseline recovered on 2026-09-09

- `develop`: `6d1cba01fc0880e06671067431919e72cad5339c`
- `main`: `4782fd3c6ab8f56661623cb36b3792a7ee7f7ee6`
- `develop` vs `main`: diverged, 44 commits ahead and 2 commits behind.
- Main-only production compatibility fix: `/api/android-update` is routed through the existing `api/data.ts` serverless function to keep the Vercel production function count inside the deployed plan limit.
- Current `develop` still has a standalone `api/android-update.ts` plus newer account/device API routes, so the main-only routing fix must be reconciled into `develop` before routine cleanup continues.
- Active implementation branch: `chore/357-code-health-foundation`, based on the exact `develop` SHA above.

## Canonical UI contracts

| Concern | Canonical contract | Notes |
| --- | --- | --- |
| Text input | `AppTextInput` | Base visual contract through `.app-control`. |
| Multiline | `AppTextarea` | Base visual contract through `.app-control`. |
| Select/dropdown | `AppSelectInput` | App-owned listbox/popover, keyboard and focus behavior. |
| Date | `AppDateInput` | App-owned calendar; keep date bounds/keyboard behavior. |
| Money | `MoneyInput` | Semantic specialization of the shared control contract. |
| Category | `CategorySelectInput` | Category-specific specialization of shared selection. |
| Validation | `FormError` | Shared visible/accessible validation surface. |
| Focus/modal behavior | `useModalFocus` | Keep Escape, focus trap and focus restoration behavior centralized. |
| Application shell | `AppShell` | No page-owned sidebar/topbar. |
| Page frame | `page-stack` + `page-heading` | Retain common routed-page structure. |
| Theme | semantic light/dark tokens | Runtime JS should own token application, not broad selector styling long-term. |
| Buttons | shared `Button` + `IconButton` | Introduce typed variants while preserving current approved look. |
| Dialogs | shared `DialogShell` | `ConfirmDialog`, `MoneyEditDialog`, `CardCreateDialog` remain semantic specializations. |
| Generic surfaces | shared `Surface` base | Raised/flat/inset only; do not flatten semantically distinct finance cards. |

## Known cleanup findings

1. Buttons are visually normalized by CSS selector groups rather than a typed shared React primitive.
2. `ConfirmDialog` and `MoneyEditDialog` duplicate backdrop/motion/focus/header/footer structure; `CardCreateDialog` owns a third modal shell.
3. Generic surface styling is spread across `neo-raised`, `neo-flat`, `neo-inset`, KPI/summary/page-specific classes.
4. CSS ownership has hidden coupling: generic components import numeric `partNN.css` files that load unrelated page redesign layers.
5. `AccountIban.tsx` currently imports `part47.css`, `part50.css`, `part52.css`; `part47.css` itself imports multiple later numeric files and page-specific approved-target styles.
6. `BankBrandMark.tsx` imports `part53.css`, while that file also contains Dashboard-specific presentation.
7. `src/lib/theme.ts` applies semantic tokens but also injects a large global selector stylesheet with many `!important` rules.
8. `DESIGN_SYSTEM.md` and `PAGE_PATTERNS.md` remain bootstrap/TBD despite the completed Phase-1 approvals.
9. Current `npm run check` covers security/tests/build but the repository does not yet have a dedicated lint/format/dead-export/dependency-cycle gate.

## Staged implementation plan

### Stage 0 — Production-hotfix back-sync into develop
State: **IN PROGRESS**

- [ ] Move the Android update request handler out of standalone `api/android-update.ts` into a non-serverless server module.
- [ ] Route `/api/android-update` through `api/data.ts` using the reviewed main rewrite pattern.
- [ ] Preserve the current develop owner + AAL2 + device-session behavior and release-channel isolation.
- [ ] Remove the standalone API function after the route bridge is covered.
- [ ] Add/retain regression coverage for the public route bridge and absence of standalone API function.
- [ ] Verify Vercel config/function count constraint.
- [ ] Run focused Android update/API tests, then full `npm run check` and relevant CI/CodeQL gates.
- [ ] Merge the Stage-0 PR to `develop` only when current-head gates pass.

### Stage 1 — Persist approved design-system contracts and code inventory
State: **NOT STARTED**

- [ ] Update `docs/ui-redesign/DESIGN_SYSTEM.md` from bootstrap/TBD to actual approved shared contracts.
- [ ] Update `docs/ui-redesign/PAGE_PATTERNS.md` with established shell/page/input/data-density patterns.
- [ ] Add an inventory of button/dialog/surface/CSS ownership and classify legitimate variants vs duplication.
- [ ] No intended visual change.

### Stage 2 — Shared Button / IconButton foundation
State: **NOT STARTED**

- [ ] Add typed `Button` and `IconButton` primitives.
- [ ] Preserve existing class hooks/approved appearance during first migration.
- [ ] Variants: primary, secondary, danger, ghost/text only where established; icon-only actions require accessible labels.
- [ ] Migrate representative adopters first, then remaining safe adopters in bounded batches.
- [ ] Add source/accessibility tests.

### Stage 3 — Shared DialogShell
State: **NOT STARTED**

- [ ] Extract common backdrop, ARIA, focus trap, Escape, reduced-motion, close/header/footer composition.
- [ ] Keep confirmation, money edit and card creation domain behavior separate.
- [ ] Preserve busy/destructive behavior and rendered appearance.

### Stage 4 — Shared Surface foundation
State: **NOT STARTED**

- [ ] Add `Surface` base with `raised`, `flat`, `inset` presentation.
- [ ] Migrate only generic containers.
- [ ] Keep KPI/account/payment/attention semantics distinct.

### Stage 5 — CSS ownership cleanup
State: **NOT STARTED**

- [ ] Remove generic-component imports that act as hidden loaders for unrelated page CSS.
- [ ] Replace numeric `partNN.css` chains incrementally with named base/primitives/patterns/page layers.
- [ ] Move broad selector CSS out of runtime `theme.ts`; keep runtime token application.
- [ ] Reduce `!important` dependence only where cascade ownership is explicit.
- [ ] Never do a whole-stack CSS rewrite in one change.

### Stage 6 — Code-hygiene tooling
State: **NOT STARTED**

- [ ] Compatibility-review lint/format/dead-code/dependency-cycle tooling before adoption.
- [ ] Enable unused-code checks incrementally.
- [ ] Do not mass-delete code based on one static-tool result.
- [ ] Add CI gates only after the active tree passes reliably.

### Stage 7 — Full application cleanup verification
State: **NOT STARTED**

- [ ] Audit every routed page/shared component.
- [ ] Remove confirmed dead code/CSS/exports/compatibility aliases only when active contracts do not depend on them.
- [ ] Run full application/API/rendered/desktop/security gates.
- [ ] Capture fresh representative screenshots and verify Phase-1 visual parity.

### Stage 8 — Release-readiness audit
State: **NOT STARTED**

- [ ] Recompare final `develop` with `main`.
- [ ] Separate UI changes from backend/auth/database/Android/Desktop production-impacting differences.
- [ ] Verify Vercel function count/routing, migrations and release/smoke prerequisites.
- [ ] Stop before release; owner authorization is required for any `develop -> main` PR/merge/deploy.

## Resume procedure for any future chat/session

1. Read `AGENTS.md`.
2. Read applicable docs under `docs/ui-redesign/` and this file.
3. Read issue #357.
4. Fetch current `develop` and `main` heads and compare them.
5. Find the active stage branch/PR by issue number; do not create duplicates.
6. Read the latest PR checkpoint and current checks.
7. Continue only the first incomplete stage.
8. Before ending the session, update this file and issue #357 with:
   - current stage/state,
   - active branch/PR,
   - latest product commit,
   - checks run/result,
   - exact next action,
   - any blocker.

## Validation baseline

Use the narrowest relevant tests first. Before merging a behavior-preserving UI/code-health stage, the expected broad baseline remains at least:

- `npm run check`
- relevant rendered frontend QA when the stage can affect UI presentation/interactions
- CodeQL and configured CI gates
- desktop checks when shared renderer/runtime code is affected

Do not weaken tests to make a refactor pass.

## Completion rule

Issue #357 is complete only when all stages are checked off, the checked-in design system matches the actual approved implementation, hidden CSS-loading dependencies are gone, common primitives have one documented canonical contract, confirmed dead redesign debris has been removed, hygiene gates are automated, full regression/visual verification is green, and final `develop` vs `main` release readiness has been documented without performing a release.