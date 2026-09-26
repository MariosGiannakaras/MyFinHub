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

### Stage 5 — CSS ownership cleanup — COMPLETE

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
- [x] Batch 9: name the three coherent root owners as navigation/action contrast, transaction split/editor visuals, and category-icon workspace with byte-identical CSS and preserved cascade positions. PR #402 merged to `develop@87f7e329c2bee5031e6250530f5bf273e135d2c1`; final head `66f295e723071bbc5440965b326f03a59285b487` passed CI `36113860264`, CodeQL `36113860274`, Cross-engine `36113860313`, Performance `36113860312`, Windows `36113860267`; ready-triggered Performance `36115493605`; post-merge CI `36115788288`, CodeQL `36115788300`, Windows `36115788226` green.
- [x] Batch 10: bulk-name 26 already-coherent numeric root owners. PR #405 merged to `develop@478a1cae07d6363c3b32cd9fa5a7e0d8cb48c96f`; final head `4b3268b242db5c687545ec6965cf36e5d135fee4` passed CI `36142885461`, CodeQL `36142885527`, Cross-engine `36142885530`, Performance `36142885533`, Windows `36142885614`; post-merge CI `36144156598`, CodeQL `36144156621`, Windows `36144156630` green.
- [x] Batch 11: split mixed `part5.css` into three semantic owners and name coherent `part27.css` / `part53.css` owners. PR #409 merged to `develop@072665a4b391b85ef4355fa3ad28226cc9160962`; final head `6948d5820ed5b60ffa6a425db57dc11b0ff87385` passed CI `36151941082`, CodeQL `36151941190`, Cross-engine `36151940938`, Performance `36151940936`, Windows `36151940943`; post-merge CI `36158915409`, CodeQL `36158915229`, Windows `36158915239` green.
- [x] Batch 12: split mixed `part42.css` and `part47.css` into semantic owners. PR #410 merged to `develop@a5f8f2713858a2ed8e5411ca6403e483fedb77f8`; final head `32c14ac2dd5df5f2ebc95298923fade27edf23cb` passed CI `36166371111`, CodeQL `36166371268`, Cross-engine `36166371060`, Performance `36166371094`, Windows `36166371123`; post-merge CI `36181339794`, CodeQL `36181339647`, Windows `36181339762` green.
- [x] Batch 13: split small mixed `part12.css`, `part16.css`, and `part35.css`, and name coherent `part43.css`. PR #411 merged to `develop@60c62bc14d47f9ef3b358cacf88c252d65fee550`; final head `6f13acef865dfb7ae026a15180f2447b705cb63f` passed CI `36185756631`, CodeQL `36185756615`, Cross-engine `36185756736`, Performance `36185756677`, Windows `36185756686`; post-merge CI `36187504193`, CodeQL `36187504036`, Windows `36187504422` green.
- [x] Batch 14: split residual small `part9.css`, `part33.css`, `part41.css`, and `part46.css`. PR #412 merged to `develop@83d6b1a751c4ffc10bc763b3dc0c2657924358ed`; final head `7d99aafbb10aa39181ba2665b15c6f5976797d68` passed CI `36200428929`, CodeQL `36200428988`, Cross-engine `36200428928`, Performance `36200428986`, Windows `36200429183`; post-merge CI `36201674597`, CodeQL `36201674663`, Windows `36201674621` green.
- [x] Batch 15: finish numeric CSS ownership. PR #413 merged to `develop@dcca883b8c267e0e77be48bcf7379bd979e2cd68`; final head `5bb7f8b097582d284170353558cfc23afe214b6b` passed CI `36204577287`, CodeQL `36204577357`, Cross-engine `36204577302`, Performance `36204577424`, Windows `36204577310`; post-merge CI `36205978753`, CodeQL `36205978766`, Windows `36205978767` green.
- [ ] Replace remaining numeric loader chains incrementally with accurate named tokens/base/primitives/patterns/pages ownership; do not give mixed legacy files misleading names.
- [ ] Reduce selector duplication and unnecessary `!important` only with proven visual parity.
- [ ] Keep runtime theme code focused on semantic token application rather than broad selector styling.
- [ ] Maintain deterministic fresh visual regression evidence at every batch.

#### Stage 5 Batch 10 checkpoint

Exact base is verified `develop@87f7e329c2bee5031e6250530f5bf273e135d2c1` after Batch-9 post-merge CI `36115788288`, CodeQL `36115788300`, and Windows Desktop `36115788226` passed.

To reduce repeated Actions cycles, Batch 10 groups 26 already-coherent numeric root owners into one atomic byte-identical rename set. No CSS declaration, selector, specificity, media query, token, import position, finance/domain behavior, auth, persistence, API/database contract or Windows/Desktop behavior changes. Direct source guards for the owned popover, UI-hardening, Planning and command-palette styles move to the semantic paths in the same commit; the root ownership guard continues to assert the complete 47-entry sequence.

The batch intentionally leaves genuinely mixed owners numeric for later split/re-layering, including `part5.css`, `part9.css`, `part12.css`, `part16.css`, `part27.css`, `part33.css`, `part35.css`, `part41.css`, `part42.css`, `part43.css`, `part46.css`, plus mixed workspace loaders `part47.css` and `part53.css`. Large base/card layers `part1.css`–`part4.css`, `part26.css`, and `part29.css` also remain for deliberate later ownership work rather than receiving ambiguous names.

Require one exact-head CI / CodeQL / Cross-engine / Performance / Windows cycle for the complete bulk batch, fresh representative desktop/mobile evidence across auth/navigation, mobile finance, reports/planning/attention, cards/credit/loans, budget/receipts and owned controls, then squash-merge only to `develop` and require exact-merge CI + CodeQL + Windows.

### Stage 6 — Code-hygiene tooling — ACTIVE

- [x] Add a low-noise lint/static-analysis baseline without mass unrelated reformatting. Batch 1 / PR #415 merged to `develop@5ab3ef121502aa4e2dff2f18038acf1d6f8adb7c`; post-merge CI `36235115168`, CodeQL `36235115151`, Windows Desktop `36235115048`, Windows First Run `36235115060`, and Windows Clean Launch `36235115124` are green.
- [ ] Add reliable unused import/export and dependency-cycle checks. Batch 2 / PR #416 made TypeScript unused-local/import diagnostics blocking with zero findings and merged to `develop@9903288525917907e2883bb89b1240ebb6be8fb7`; post-merge CI `36240315073`, CodeQL `36240315077`, Windows Desktop `36240315093`, Windows First Run `36240315082`, and Windows Clean Launch `36240315114` are green. **Batch 3 active:** add a conservative report-only unused-export graph so export debt is measured before any removal or enforcement.
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

## Current checkpoint — 2026-09-26

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 6/9 (Stages 0–5).
- **Active stage:** Stage 6 — Code-hygiene tooling.
- **Verified integration base:** `develop@9903288525917907e2883bb89b1240ebb6be8fb7`; Stage-6 Batch-2 post-merge CI `36240315073`, CodeQL `36240315077`, Windows Desktop `36240315093`, Windows First Run `36240315082`, and Windows Clean Launch `36240315114` are green.
- **Active delivery:** branch `chore/357-stage6-unused-exports-baseline`, adding a conservative report-only unused-export graph across app/server/API modules with tests/scripts/desktop code treated as consumers.
- **Implementation contract:** use the existing TypeScript parser only for syntax-safe module/export discovery, resolve only repository-local relative module edges, conservatively treat namespace/dynamic imports and star re-exports as using the full target surface, and exempt framework-owned API exports. Do not delete exports in the baseline batch.
- **Next action:** run one exact-head CI cycle, capture the export baseline from the hygiene log, classify only high-confidence findings, then decide the next bounded enforcement/cleanup checkpoint without speculative bulk deletion.

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
