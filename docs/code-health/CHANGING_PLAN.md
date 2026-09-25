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
- [x] Batch 6: name the coherent Dashboard desktop fidelity/type-scale owner as `dashboard-desktop-fidelity.css` without changing CSS bytes or cascade position. PR #397 merged to `develop@6cabfbeadae0a4c1043bce76a7134814ac08b9d1`; final head `c17f31847fdbe5aca3e42018fdc3ce13b9e2ded9` passed CI `35729312592`, CodeQL `35729312280`, Cross-engine `35729312016`, Performance `35729311994`, Windows `35729311856`; ready-triggered Performance `35795834975`; post-merge CI `35796034260`, CodeQL `35796034170`, Windows `35796034238` green.
- [x] Batch 7: name the three remaining coherent Dashboard shell/route/alignment owners as `dashboard-approved-target.css`, `dashboard-route-shell-continuity.css`, and `dashboard-desktop-alignment.css` without changing CSS bytes or `part47.css` cascade order. PR #398 merged to `develop@88266ef3ee4a60d07924d301f5d5132d0945cd31`; final head `d36ad8c102eb70b108ec79408e07dc30892b8b24` passed CI `35798482719`, CodeQL `35798482720`, Cross-engine `35798482707`, Performance `35798482766`, Windows `35798482734`; ready-triggered Performance `35889132219`; post-merge CI `35889432260`, CodeQL `35889432337`, Windows `35889432372` green.
- [x] Batch 8: name the three coherent route/composition owners as `transactions-desktop-shell.css`, `quick-entry-desktop-composition.css`, and `savings-desktop-composition.css` without changing CSS bytes or `part47.css` cascade order. PR #399 merged to `develop@588aed1b1fffa8a91af942223ee2360cbed55806`; final head `c48142fcfa75deb8fb31592f5a0122d8bed0c0fa` passed CI `35983012768`, CodeQL `35983012827`, Cross-engine `35983012505`, Performance `35983012503`, Windows `35983012957`; ready-triggered Performance `36110275493`; post-merge CI `36110560744`, CodeQL `36110560685`, Windows `36110561009` green.
- [ ] Batch 9: name three coherent root owners `part32.css`, `part36.css`, and `part45.css` as navigation/action contrast, transaction split/editor visuals, and category-icon workspace while preserving exact blobs and root/login cascade positions. Active branch `chore/357-css-ownership-batch-9`.
- [ ] Replace remaining numeric loader chains incrementally with accurate named tokens/base/primitives/patterns/pages ownership; do not give mixed legacy files misleading names.
- [ ] Reduce selector duplication and unnecessary `!important` only with proven visual parity.
- [ ] Keep runtime theme code focused on semantic token application rather than broad selector styling.
- [ ] Maintain deterministic fresh visual regression evidence at every batch.

#### Stage 5 Batch 9 checkpoint

Exact base is verified `develop@588aed1b1fffa8a91af942223ee2360cbed55806` after Batch-8 post-merge CI `36110560744`, CodeQL `36110560685`, and Windows Desktop `36110561009` passed.

The bounded Batch-9 scope groups three coherent root/login compatibility owners that can be named without splitting mixed files or changing CSS bytes:

- `part32.css -> navigation-action-contrast.css`, exact blob `f1058585a369a13dc237c9f47650ada2f471ea70`;
- `part36.css -> transaction-split-editor.css`, exact blob `abfa9640b084f9a81f560510bb6bfc04645c6c47`;
- `part45.css -> category-icon-workspace.css`, exact blob `cf7a310c03a6d7453b8e28b32d9a013761441394`.

The root import positions remain unchanged: semantic filenames replace only numeric names at slots 32, 36, and 45. The root ownership source guard continues to assert the complete 47-entry root sequence, now with a three-entry semantic substitution map rather than weakening order checks.

Mixed or cross-cutting candidates remain untouched: `part33.css` mixes owned-input sizing, credit over-limit, and lending-person suggestions; `part35.css` mixes brand-mark styling with privacy-toggle sizing; `part41.css` mixes Dashboard/history/mobile reconciliation; `part43.css` mixes brand-home and category-editor affordances; `part46.css` mixes category-taxonomy styling with a Transactions mobile-filter rule. No CSS declaration, selector, specificity, media query, theme token, root/login load budget, finance/domain behavior, API, persistence, auth or Windows packaging behavior changes in this batch.

Require exact-head CI / CodeQL / Cross-engine / Performance / Windows, fresh rendered evidence for navigation/mobile command action, transaction split/editor surfaces, and category-icon workspace, plus clean reviews/threads before ready/merge. After merge, require exact-merge CI + CodeQL + Windows 3/3 before another Stage-5 write batch.

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

## Current checkpoint — 2026-09-25

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 5/9 (Stages 0–4).
- **Active stage:** Stage 5 — CSS ownership cleanup.
- **Verified integration base:** `develop@588aed1b1fffa8a91af942223ee2360cbed55806`; Batch-8 post-merge CI `36110560744`, CodeQL `36110560685`, Windows Desktop `36110561009` are green.
- **Active delivery:** branch `chore/357-css-ownership-batch-9`, bounded to three coherent root owners: navigation/action contrast, transaction split/editor visuals, and category-icon workspace.
- **Implementation contract:** reuse exact `part32.css`, `part36.css`, and `part45.css` blobs under accurate semantic names; preserve exact root/login import positions; change no CSS rule; update only the root ownership guard plus Stage-5 documentation.
- **Next action:** validate the atomic Batch-9 head with required CI / CodeQL / Cross-engine / Performance / Windows, inspect fresh affected-surface evidence, clean any generated-only Visual-QA bot commit non-force, re-check reviews/threads, then squash-merge only to `develop` with expected-head protection and verify exact-merge CI + CodeQL + Windows before another write batch.

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
