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
- [x] Batch 3: name the unchanged root/login compatibility sequence behind `src/styles/root-compat.css`. PR #394 merged to `develop@6aa86bcf4173999f0bfa992e0d1f12b5c097c3eb`; final cleanup head `97565d361c4a45484f0bbd6c75c70b67bbd96fed` passed CI `35088827003`, CodeQL `35088827013`, Cross-engine `35088827051`, Performance `35088827047`, Windows `35088827006`; post-merge CI `35263899309`, CodeQL `35263899322`, Windows `35263899320` green.
- [x] Batch 4: name the coherent terminal app-control/focus owner as `app-controls.css` without changing CSS bytes or root cascade position. PR #395 merged to `develop@655c434071f501d484a7661556fc1765b90d262d`; final head `ea7754d7c26039ace77dc7e83a0e966b28375de1` passed CI `35367396491`, CodeQL `35367396377`, Cross-engine `35367396430`, Performance `35367396461`, Windows `35367396384`; post-merge CI `35527706593`, CodeQL `35527706580`, Windows `35527706606` green.
- [x] Batch 5: name the coherent Dashboard command-search desktop geometry owner as `dashboard-command-search-geometry.css` without changing CSS bytes or either existing workspace cascade position. PR #396 merged to `develop@cfccbe9ed637e2300f2692dbac3928cb7646f933`; final head `ae8aeb56ee29bc10a3c4270f3727d6f205bef1b5` passed CI `35579293676`, CodeQL `35579293667`, Cross-engine `35579293699`, Performance `35579293648`, Windows `35579293733`; ready-triggered Performance `35590833747`; post-merge CI `35591065324`, CodeQL `35591065346`, Windows `35591065317` green.
- [ ] Batch 6: name the coherent Dashboard desktop fidelity/type-scale owner currently stored as `part52.css`, reusing the exact blob and preserving its workspace cascade position. Active branch `chore/357-css-ownership-batch-6`.
- [ ] Replace remaining numeric loader chains incrementally with accurate named tokens/base/primitives/patterns/pages ownership; do not give mixed legacy files misleading names.
- [ ] Reduce selector duplication and unnecessary `!important` only with proven visual parity.
- [ ] Keep runtime theme code focused on semantic token application rather than broad selector styling.
- [ ] Maintain deterministic fresh visual regression evidence at every batch.

#### Stage 5 Batch 6 checkpoint

Exact base is verified `develop@cfccbe9ed637e2300f2692dbac3928cb7646f933` after Batch-5 post-merge CI `35591065324`, CodeQL `35591065346`, and Windows Desktop `35591065317` passed.

The bounded Batch-6 scope is intentionally limited to the coherent `part52.css` Dashboard desktop fidelity/type-scale layer. The new `dashboard-desktop-fidelity.css` path reuses the exact existing blob `6d74401895feb5aa95f83b957a560e02860ec201` and stays in the exact current `workspace-compat.css` position after `dashboard-command-search-geometry.css` and before `part53.css`.

No CSS declaration, selector, specificity, media query, theme token, root/login import, import order, finance/domain behavior, API, persistence, auth or Windows packaging behavior changes in this batch. Source guards are updated only to follow the semantic filename while preserving the same import-order assertions. Historical Stage-1/Batch-1 documents remain historical and are not rewritten to pretend the old numeric filename never existed.

Require exact-head CI / CodeQL / Cross-engine / Performance / Windows, fresh rendered evidence, and clean reviews/threads before ready/merge. After merge, require exact-merge CI + CodeQL + Windows 3/3 before another Stage-5 write batch.

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

## Current checkpoint — 2026-09-21

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 5/9 (Stages 0–4).
- **Active stage:** Stage 5 — CSS ownership cleanup.
- **Verified integration base:** `develop@cfccbe9ed637e2300f2692dbac3928cb7646f933`; Batch-5 post-merge CI `35591065324`, CodeQL `35591065346`, Windows Desktop `35591065317` are green.
- **Active delivery:** branch `chore/357-css-ownership-batch-6`, bounded to the named Dashboard desktop fidelity/type-scale owner.
- **Implementation contract:** reuse the exact `part52.css` blob as `dashboard-desktop-fidelity.css`; preserve its exact workspace import position; change no CSS rule; update only focused guards and Stage-5 documentation.
- **Next action:** validate the atomic Batch-6 head with narrow source checks followed by required CI / CodeQL / Cross-engine / Performance / Windows; inspect fresh rendered evidence; clean any generated-only Visual-QA bot commit non-force; re-check reviews/threads; then squash-merge only to `develop` with expected-head protection and verify exact-merge CI + CodeQL + Windows before another write batch.

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
