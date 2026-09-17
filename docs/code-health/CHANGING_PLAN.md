# MyFinHub Code Health — Changing Plan

## Purpose

Durable continuation plan for the post-Phase-1 code-health cleanup. GitHub is the source of truth; recorded SHAs and run IDs are checkpoints, not substitutes for recovering current repository state before a write.

## Protected constraints

- Never inspect, open, quote, summarize, comment on, modify, or use GitHub issue #266.
- `develop` is the integration branch. `main` is release-only.
- No `develop -> main`, release, publish, deploy, production migration, or production-data mutation without separate explicit owner authorization.
- Preserve the owner-approved Phase-1 UI appearance unless a later owner-approved target explicitly changes it.
- Preserve finance/accounting semantics, auth/MFA/RLS/security behavior, persistence, routes, APIs, database contracts and Windows/Desktop behavior unless a stage explicitly requires a compatible fix.
- Code-health work is behavior-preserving by default. Never weaken tests, audits, accessibility, performance, security or installer gates to make a change pass.
- Keep app-owned inputs/selects/date controls; do not regress to browser-native controls where the app already owns the interaction.
- Work in bounded branches/PRs. Recover real GitHub state before every write, batch coherent fixes, and avoid repeated full CI loops for small changes.
- Merge code-health PRs only to `develop` with required validation green; verify the exact merge integration before starting the next write batch.

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
| Modal focus | `useModalFocus` |
| Dialog shell | `DialogShell` for eligible modal shells; preserve specialized dialog/picker semantics |
| App frame | `AppShell` |
| Page frame | `page-stack` + `page-heading` |
| Theme | existing semantic light/dark tokens |
| Buttons | shared `Button` + `IconButton`; intentional domain/composite controls may remain raw |
| Generic surfaces | shared `Surface` (`raised` / `flat` / `inset`) for genuinely generic hosts; domain cards remain semantic components |

## Stage plan

### Stage 0 — Production-hotfix back-sync — COMPLETE

PR #358 merged and verified on `develop`. Production updater routing/function budget, develop-only account/device behavior, Windows source portability and patched Desktop dependency state were preserved.

### Stage 1 — Design-system contracts and inventory — COMPLETE

PR #359 merged and verified. Approved design-system/page-pattern contracts and UI/CSS ownership inventory are checked in.

### Stage 2 — Canonical `Button` / `IconButton` — COMPLETE

Bounded PRs #363–#379 completed typed shared action primitives, safe adopter migrations, compatibility cleanup and rendered/interaction verification while preserving intentional domain/composite raw controls.

### Stage 3 — Canonical `DialogShell` — COMPLETE

PRs #380–#383 completed shared canonical modal-shell ownership for eligible dialogs, including `ConfirmDialog`, `MoneyEditDialog`, `QuickAdd`, `LegacyTransactionEditor` and the static `ContextualQuickAdd` case. Specialized picker/palette/editor families remain intentionally separate.

### Stage 4 — Canonical `Surface` — COMPLETE

PRs #384, #385, #387 and #389 completed bounded generic elevation ownership. Semantic finance/domain cards and specialized overlays remain domain-owned.

### Stage 5 — CSS ownership cleanup — ACTIVE

Goal: replace hidden global-style ownership and numeric loader coupling incrementally while preserving exact cascade, root/login budget boundaries, approved rendering and semantic theme behavior.

- [x] Stage-1 inventory documented the numbered-file graph and hidden loader coupling.
- [x] Batch 1: replace unrelated domain-components-as-global-style-loaders with one explicit lazy workspace owner. PR #390 merged to `develop@167e30a9dd21e3436598263794d5aea512319afe`; post-merge CI `34825830962` attempt 2, CodeQL `34825831023`, Windows `34825830963` green.
- [x] Batch 2: name the preserved late-workspace compatibility sequence through `src/styles/workspace-compat.css` without changing its sequence or CSS declarations. PR #391 merged to `develop@2c963bbe41d600ff20a904a1a9482a80c874a852`; final validated head `6276c0a122688e8793bce038d95f2e67d9c43487` passed CI `34861930169`, CodeQL `34861930168`, Cross-engine `34861930034`, Performance `34861930053`, Windows `34861930076`; post-merge CI `34954236146`, CodeQL `34954236149`, Windows `34954236137` green.
- [ ] Batch 3: name the unchanged root/login compatibility sequence behind `src/styles/root-compat.css` while preserving exactly `part1.css` through `part46.css`, then `part57.css`. Active PR #394 / branch `chore/357-css-ownership-batch-3`.
- [ ] Replace numeric loader chains incrementally with named tokens/base/primitives/patterns/pages ownership.
- [ ] Reduce selector duplication and unnecessary `!important` only with proven visual parity.
- [ ] Keep runtime theme code focused on semantic token application rather than broad selector styling.
- [ ] Maintain deterministic fresh visual regression evidence at every batch.

#### Stage 5 Batch 3 checkpoint

Exact base is verified `develop@2c963bbe41d600ff20a904a1a9482a80c874a852`.

The Batch-3 source milestone `3a304ad97988a7fb96c2e014aa103faf20028395` preserves the exact previous root import order behind the new named owner and updates only focused ownership guards/documentation. It passed CI `35000747100`, CodeQL `35000747079`, Cross-engine `35000746986`, Performance `35000746987`, and Windows Desktop `35000746977`.

Fresh CI artifact `10410281687` (`sha256:8b3abdc6fa85fd96607e468f9aedf4bbd84f5993f1d680d61d846a94b2209b02`) was inspected across login plus representative desktop/mobile Dashboard and Settings/workspace surfaces. No missing-style, cascade, overflow or responsive regression was found.

Visual-QA persistence then created bot commit `5e88f8ff25f73a9b931768c7cc36c43c6e26b5e6`. Source-to-bot comparison was generated-only under `visual-qa/**`. Non-force fast-forward cleanup commit `99ab3c297f276770247d5b05e7ca9c7ec89f4885` restored the exact validated source tree. This plan sync intentionally creates the final documentation head; require one exact-head CI / CodeQL / Cross-engine / Performance / Windows set before ready/merge.

Current PR net scope before this plan sync is six intended files: `src/styles.css`, new `src/styles/root-compat.css`, three focused source-ownership tests, and `docs/code-health/STAGE5_BATCH3.md`; no generated evidence remains in the net diff. This plan file is the seventh intended file after synchronization. No existing CSS declaration, selector, specificity, media query or theme token changes are in scope.

### Stage 6 — Code-hygiene tooling

- [ ] Add a low-noise lint/static-analysis baseline without mass unrelated reformatting.
- [ ] Add reliable unused import/export and dependency-cycle checks.
- [ ] Add formatting enforcement only after a low-noise baseline exists.
- [ ] Review dependency/audit debt without relaxing severity gates.

### Stage 7 — Full cleanup verification

- [ ] Full application/API checks.
- [ ] Cross-page shared-control adoption audit for routed pages/shared components.
- [ ] Rendered desktop/mobile QA for routed surfaces.
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
- [ ] Stop before `develop -> main`, release or deploy unless separately authorized.

## Current checkpoint — 2026-09-16

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 5/9 (Stages 0–4).
- **Active stage:** Stage 5 — CSS ownership cleanup.
- **Verified integration base:** `develop@2c963bbe41d600ff20a904a1a9482a80c874a852`; Batch-2 post-merge CI `34954236146`, CodeQL `34954236149`, Windows Desktop `34954236137` green.
- **Active delivery:** draft PR #394 / `chore/357-css-ownership-batch-3`.
- **Validated source tree:** tree `05204bbb23fe0018ca1be2b297b11e19b84a700a` at source head `3a304ad97988a7fb96c2e014aa103faf20028395`; all five required PR gates green and fresh rendered evidence inspected.
- **Generated-evidence cleanup:** bot-only `visual-qa/**` commit `5e88f8ff25f73a9b931768c7cc36c43c6e26b5e6` was removed from the net diff by non-force cleanup `99ab3c297f276770247d5b05e7ca9c7ec89f4885`, restoring the exact source tree.
- **Next action:** require one exact-head CI / CodeQL / Cross-engine / Performance / Windows set after this plan sync; inspect the exact-head artifact; re-check reviews/threads; mark ready; wait for any ready-triggered required run; squash-merge only to `develop` with expected-head protection. Then require exact-merge CI + CodeQL + Windows 3/3 before the next Stage-5 write batch.

## Resume procedure

1. Read root `AGENTS.md`, this file, and issue #357. Do not inspect the protected excluded issue.
2. Recover the real `develop`, active branch/PR, latest commits/checks and unresolved review threads.
3. Treat current GitHub state as authoritative over recorded SHAs if the repository moved.
4. Continue the first incomplete active-stage item; do not restart completed audits without new evidence.
5. Use narrow tests first, then required full gates. Never weaken behavioral/security/audit tests.
6. For UI/CSS-affecting refactors, inspect fresh real desktop/mobile evidence before merge.
7. Batch coherent fixes and documentation updates; avoid one-commit/one-CI loops for small corrections.
8. After every meaningful checkpoint, synchronize this file plus the active issue/PR with scope, exact head where useful, validation state, blockers and exact next action.
9. After a bounded PR is merged and verified on `develop`, create/resume the next bounded branch/PR rather than piling unrelated work together.
10. Keep #357 open until all stages are complete. No `main`, release or deploy without separate explicit owner authorization.
