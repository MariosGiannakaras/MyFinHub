# MyFinHub Code Health — Changing Plan

## Purpose

This file is the durable continuation plan for the post-Phase-1 code-health cleanup. It is intentionally self-contained so a future ChatGPT session can continue from GitHub without relying on chat memory.

## Protected constraints

- Never inspect, open, quote, summarize, comment on, modify, or use GitHub issue #266.
- `develop` is the integration branch. `main` is release-only.
- Do not perform `develop -> main`, release, publish, deploy, or production migration without separate explicit owner authorization.
- Preserve the owner-approved Phase-1 UI appearance unless a later owner-approved visual target explicitly changes it.
- Preserve finance/accounting semantics, auth/MFA/RLS/security behavior, persistence, routes, APIs, database contracts and Windows/Desktop behavior unless a stage explicitly requires a compatible fix.
- Code-health work is behavior-preserving refactoring by default. Do not weaken tests, audits, accessibility or security gates to make a change pass.
- Keep native browser dialogs/controls out where current app-owned primitives already own the interaction.
- Work in bounded stages and PRs. Do not combine unrelated cleanup into one large rewrite.
- Before every write, recover the real GitHub branch/PR/head state and resume existing work rather than creating duplicates.

## Canonical UI contracts

These are the current approved choices. Later stages should converge implementations toward these contracts without redesigning their appearance.

| Concern | Canonical contract |
| --- | --- |
| Text input | `AppTextInput` |
| Textarea | `AppTextarea` |
| Select/dropdown | `AppSelectInput` |
| Date | `AppDateInput` |
| Money/amount | `MoneyInput` |
| Category | `CategorySelectInput` |
| Validation message | `FormError` |
| Modal/focus behavior | `useModalFocus` |
| App frame | `AppShell` |
| Page frame | `page-stack` + `page-heading` |
| Theme | existing semantic light/dark tokens |
| Buttons | future shared `Button` + `IconButton`, preserving the approved primary/secondary/danger/icon visual language |
| Dialogs | future shared `DialogShell`, preserving the approved modal appearance |
| Generic cards/surfaces | future shared `Surface` base with raised/flat/inset variants; domain cards remain semantic components |

## Stage plan

### Stage 0 — Production-hotfix back-sync into `develop`

**Goal:** remove the known release blocker before routine cleanup.

- [x] Preserve `/api/android-update` while routing it through an existing Vercel function.
- [x] Preserve `develop` account/device capabilities while routing their Vercel paths through an existing auth function.
- [x] Reduce the Vercel TypeScript serverless entrypoint count from 15 to exactly 12.
- [x] Add source-level regression coverage for the Vercel function budget and affected routes.
- [x] Preserve the existing underlying account/device/update handlers and their security policy.
- [x] Make approved-style source tests platform-safe without weakening their semantic assertions.
- [x] Refresh the Desktop transitive `js-yaml` lock resolution to patched `4.3.2` while retaining the high-severity audit gate.
- [x] Complete exact-head CI, API/build/rendered QA, CodeQL, cross-engine, performance and all Windows gates.
- [x] Merge Stage 0 to `develop` and verify the resulting `develop` integration state.

**Completed delivery:** PR #358 / `develop@399253c35740a0c6666e60ec2d0eb131d82fb17d`.

### Stage 1 — Persist design-system contracts and inventory

**Goal:** turn the approved UI into an explicit, durable design-system contract before broad refactors.

- [x] Update checked-in design-system/page-pattern documentation from bootstrap/TBD state.
- [x] Inventory raw buttons, modal/dialog shells, generic surface aliases and CSS ownership.
- [x] Record allowed exceptions where a domain component is intentionally specialized.
- [x] Add source-level adoption guards only where they express durable behavior/ownership, not incidental file formatting.

**Active delivery:** issue #357 / branch `chore/357-design-system-inventory`. Runtime/UI behavior is intentionally unchanged; validation and PR delivery remain before Stage 1 can be considered integrated.

### Stage 2 — Canonical `Button` / `IconButton`

**Goal:** replace the selector-net button contract with typed shared primitives while preserving visuals and behavior.

- [ ] Introduce shared `Button` variants for primary, secondary, danger and appropriate ghost/text actions.
- [ ] Introduce accessible `IconButton` with mandatory accessible naming.
- [ ] Migrate bounded page groups incrementally.
- [ ] Retain temporary compatibility aliases only while required; remove them once adoption is complete.
- [ ] Verify keyboard/focus/disabled/loading/submit semantics and screenshots after each bounded migration.

### Stage 3 — Canonical `DialogShell`

**Goal:** remove repeated overlay/focus/motion/header/footer mechanics.

- [ ] Extract common dialog backdrop, ARIA, focus trapping, Escape/close, reduced-motion, header and footer behavior.
- [ ] Migrate `ConfirmDialog`, `MoneyEditDialog`, create/edit dialogs and other eligible overlays incrementally.
- [ ] Preserve specialized dialog body/form behavior.
- [ ] Keep native `alert`/`confirm`/`prompt` prohibited.

### Stage 4 — Canonical `Surface`

**Goal:** centralize generic surface geometry/elevation without flattening semantic domain components.

- [ ] Introduce raised/flat/inset base surface ownership.
- [ ] Migrate generic panels/cards where the abstraction is genuinely shared.
- [ ] Keep KPI, account, payment, attention and other domain cards as semantic components that may compose `Surface`.

### Stage 5 — CSS ownership cleanup

**Goal:** remove hidden loader coupling and make stylesheet ownership explicit.

- [ ] Inventory the `partN.css` graph and document which approved rules each file owns before moving anything.
- [ ] Eliminate unrelated component-as-stylesheet-loader coupling.
- [ ] Replace numeric loader chains with named layers/owners in bounded steps: tokens/base/primitives/patterns/pages.
- [ ] Reduce selector duplication and unnecessary `!important` reliance only when visual parity is proven.
- [ ] Keep runtime theme code focused on semantic tokens rather than acting as a broad selector engine.
- [ ] Maintain exact visual regression coverage throughout.

### Stage 6 — Code-hygiene tooling

**Goal:** make dead/duplicate code detectable rather than relying on CI build success alone.

- [ ] Add an appropriate lint/static-analysis baseline without mass unrelated reformatting.
- [ ] Add unused import/export and dependency-cycle checks where signal is reliable.
- [ ] Add formatting enforcement only after establishing a low-noise baseline.
- [ ] Review dependency/audit debt, including Desktop transitive packages, without relaxing severity gates.

### Stage 7 — Full cleanup verification

**Goal:** prove the refactored implementation still behaves and looks like the verified Phase-1 product.

- [ ] Full application/API checks.
- [ ] Cross-page shared-control adoption checks.
- [ ] Rendered desktop/mobile QA for every routed surface.
- [ ] Keyboard/focus/accessibility pass.
- [ ] Windows Desktop / First Run / Clean Launch gates.
- [ ] CodeQL, cross-engine and performance gates.
- [ ] Personally inspect representative fresh visual evidence.
- [ ] Remove proven dead compatibility code and stale temporary aliases only after coverage confirms they are unused.

### Stage 8 — Release-readiness audit

**Goal:** determine whether `develop` is safe to promote; this stage does **not** authorize promotion.

- [ ] Compare current `develop` against `main` again.
- [ ] Confirm the Vercel function budget and production routing are still compatible.
- [ ] Review migrations/backend/auth/device/provider differences explicitly.
- [ ] Verify there are no unresolved code-health blockers.
- [ ] Produce a release-readiness checkpoint.
- [ ] Wait for separate explicit owner authorization before any `develop -> main`, release or deploy action.

## Current checkpoint — 2026-09-09

- **Overall tracker:** #357 — OPEN.
- **Completed stage:** Stage 0 — merged and verified on `develop@399253c35740a0c6666e60ec2d0eb131d82fb17d`; post-merge workflows include successful CodeQL and Windows gates on that exact integration head.
- **Active stage:** Stage 1 — design-system contracts and ownership inventory.
- **Branch:** `chore/357-design-system-inventory`, based exactly on `develop@399253c35740a0c6666e60ec2d0eb131d82fb17d`.
- **Implementation status:** 4/4 Stage-1 implementation tasks complete on the branch. `DESIGN_SYSTEM.md` and `PAGE_PATTERNS.md` now describe the approved Phase-1 contracts; `docs/code-health/UI_INVENTORY.md` records button/dialog/surface/CSS ownership and intentional domain exceptions; `tests/shared-ui-adoption-source.test.ts` adds a durable modal-focus ownership guard.
- **CSS inventory finding:** `src/styles.css` directly loads `part1.css`–`part46.css` and `part57.css`. `AccountIban` / `AccountMetadataSettings` load `part47.css`, which in turn loads unrelated Dashboard/Transactions/Quick Entry/Savings and approved-target styles. This hidden component-as-global-stylesheet-loader coupling is documented for Stage 5 and intentionally unchanged in Stage 1.
- **Theme inventory finding:** semantic Light/Dark token application is canonical, while the broad runtime selector stylesheet in `src/lib/theme.ts` is documented compatibility debt for Stage 5; no theme/runtime changes are made here.
- **Validation state:** branch source changes are documentation plus a source-level test only; no runtime/CSS/component behavior changed. PR/check validation is still required before integration.
- **Next action:** open the bounded Stage-1 PR against `develop`, run required checks, fix only Stage-1 regressions, then merge and verify `develop` before starting Stage 2.

## Resume procedure for a future chat

1. Read root `AGENTS.md` and all directly applicable checked-in rules.
2. Read this file completely.
3. Read issue #357 and the active PR named in the current checkpoint. Do **not** inspect excluded issue #266.
4. Fetch the real `develop`, `main`, active branch and PR heads; never trust a stale SHA in this file over GitHub.
5. Inspect current workflow/check state and any unresolved review comments.
6. Continue the first incomplete item in the active stage. Do not skip ahead to later stages while a blocker is open.
7. Use the narrowest tests first, then the required full gates. Never weaken behavioral/security/audit tests to make them pass.
8. For UI-affecting refactors, use fresh real rendered desktop/mobile evidence and personally compare against the approved Phase-1 appearance before merge.
9. After every meaningful checkpoint, update this file and the active issue/PR with: last completed, exact head, validation state, blocker if any, and exact next action.
10. After a bounded stage is merged and verified on `develop`, create/resume a new bounded branch/PR for the next stage. Do not pile all stages into one PR.
11. Keep #357 open until all stages are complete. No `main`, release or deploy without separate explicit owner authorization.