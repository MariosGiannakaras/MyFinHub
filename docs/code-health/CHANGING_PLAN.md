# MyFinHub Code Health — Changing Plan

## Purpose

Durable continuation plan for the post-Phase-1 code-health cleanup. A future ChatGPT session must be able to resume from GitHub without relying on chat memory. GitHub is the source of truth; recorded SHAs/checks are checkpoints, not permission to ignore newer repository state.

## Protected constraints

- Never inspect, open, quote, summarize, comment on, modify, or use GitHub issue #266.
- `develop` is the integration branch. `main` is release-only.
- No `develop -> main`, release, publish, deploy, production migration, or production-data mutation without separate explicit owner authorization.
- Preserve the owner-approved Phase-1 UI appearance unless a later owner-approved target explicitly changes it.
- Preserve finance/accounting semantics, auth/MFA/RLS/security behavior, persistence, routes, APIs, database contracts and Windows/Desktop behavior unless a stage explicitly requires a compatible fix.
- Code-health work is behavior-preserving by default. Never weaken tests, audits, accessibility, performance, security or installer gates to make a change pass.
- Keep app-owned inputs/selects/date controls; do not regress to browser-native controls where the app already owns the interaction.
- Work in bounded stages/PRs. Recover the real GitHub state before every write and resume existing work rather than creating duplicates.
- Merge code-health PRs back to `develop` with the repository-required validation green; verify the resulting `develop` integration before starting the next write branch.

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
| Dialog shell | `DialogShell` for eligible quick/static/editor shells; preserve specialized picker/palette/popover semantics |
| App frame | `AppShell` |
| Page frame | `page-stack` + `page-heading` |
| Theme | existing semantic light/dark tokens |
| Buttons | shared `Button` + `IconButton`; intentional domain/composite controls may remain raw |
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

Completed delivery: PR #359, `develop@11f1e9995a332ee2b5b039281701db3db031e98d`.

### Stage 2 — Canonical `Button` / `IconButton` — COMPLETE

Goal: replace selector-net generic action ownership with typed shared primitives without changing approved visuals, geometry or behavior.

- [x] Introduce typed `Button` variants for primary, secondary, danger and ghost/text-compatible actions while preserving approved CSS hooks.
- [x] Introduce accessible `IconButton` with required accessible `aria-label` and safe default `type="button"`.
- [x] Migrate bounded safe adopter groups incrementally while preserving intentional domain/composite raw controls.
- [x] Remove compatibility aliases after active adopters no longer depend on them.
- [x] Verify keyboard/focus/disabled/submit semantics plus fresh rendered evidence through the bounded migrations.

Delivery history: bounded PRs #363–#379. Final Stage-2 completion PR #379 squash-merged to `develop@84fc1c3b70533f0519b26a69f884fd756d7c965d`; post-merge CI `34679070861`, CodeQL `34679070828`, and Windows Desktop `34679070906` passed.

Intentional raw exceptions remain where a button is a domain/composite control rather than a generic action primitive: card-design radios, payment-card interactions, row/domain navigation controls, segmented/sort controls, taxonomy/composite selectors, and comparable documented cases.

### Stage 3 — Canonical `DialogShell` — ACTIVE

Goal: centralize common modal-shell mechanics only where presentation and behavior contracts genuinely match; do not force pickers/popovers or specialized domain surfaces into one abstraction.

- [x] Establish shared `DialogShell` ownership for canonical modal ARIA, `useModalFocus`, Escape/dismiss behavior and quick-shell reduced-motion transition policy.
- [x] Batch 1: migrate `ConfirmDialog` and `MoneyEditDialog` while preserving alert/dialog roles, busy guards, validation relationships, actions and CSS/DOM contracts.
- [x] Batch 2: migrate `QuickAdd` while preserving dirty-close nested confirmation, parent/child focus ownership, split-field autofocus, form semantics and approved Quick Entry presentation.
- [x] Batch 3: add an explicit no-motion quick-shell path and migrate `LegacyTransactionEditor` without changing rendered backdrop/surface classes, ARIA, focus or dismissal behavior.
- [x] Batch 4: migrate the special static `ContextualQuickAdd` modal to the validated no-motion quick shell while preserving its dynamic description/error relationship, generic QuickAdd route and all payment/domain semantics.
- [ ] Batch 5: add an explicit `editor` presentation contract and migrate the first bounded editor-family adopters (`LendingPage`, `SavingsPage`) while preserving the existing `editor-backdrop + panel neo-raised editor-dialog` DOM/classes and CSS-owned animation/reduced-motion policy.
- [ ] Migrate the remaining genuinely matching editor-family adopters only after Batch 5 is integrated and freshly re-audited.
- [ ] Keep `CardCreateDialog`, `CommandPalette`, command/history palettes, Receipt Inbox, product-specific pickers and app-owned select/date popovers specialized unless a separate stable contract is proven; do not add arbitrary surface/backdrop escape-hatch props to `DialogShell`.
- [ ] Add header/footer abstractions only if multiple later adopters prove a stable common contract; specialized body/form/destructive/busy behavior remains domain-owned.
- [x] Keep native `alert`/`confirm`/`prompt` prohibited through existing guards.

Batch 1 delivery: PR #380 squash-merged to `develop@490dec1badaf2e0b6571f59d01f3b3be01baaab7` (tree `52df6b2261c3ae4690901d06f5aeb008e87bd145`). Final exact-head CI `34682517666`, CodeQL `34682517632`, Cross-engine `34682517694`, Performance `34682517646`, Windows Desktop `34682517680`, plus ready-triggered Performance `34683083931` passed. Post-merge integration is 3/3 green: CI `34683195957`, CodeQL `34683195937`, Windows Desktop `34683195943`.

Batch 2 delivery: PR #381 squash-merged to `develop@da82108b0ef8c552e958d241db4e8fd47a1e1574` (tree `8f771e132cbf497e6c814a95372d737e2db56565`). Final exact-head required gates and ready-triggered Performance passed. Post-merge integration is 3/3 green: CI `34701157385` attempt 2, CodeQL `34701157366`, Windows Desktop `34701157384`.

Batch 3 delivery: PR #382 squash-merged to `develop@c962ee5ccc90036584aba16fe397ef0f097dee98` (tree `56ab592bf41dc38cd0f2d891e56af33fa478011c`). Final exact-head CI `34702873522`, CodeQL `34702873521`, Cross-engine `34702873518`, Performance `34702873514`, Windows Desktop `34702873530`, plus ready-triggered Performance `34703532465` passed. Fresh PR artifact `10300746480` (`sha256:4810c95fbbe24d3e2d7c128ae9b6c223943f5e7fe928816d151d79f6665fc3c6`) was inspected. Post-merge CI `34703684734` attempt 2, CodeQL `34703684736`, and Windows Desktop `34703684715` passed; attempt 1 had an isolated Chromium/CDP context failure and the unchanged exact-tree rerun passed.

Batch 4 delivery: PR #383 squash-merged to `develop@ee83da00b66f0d2dde7b23d817fe67ec3f5c6a03` (tree `ab1cadf1347d4f0d134ff7f702b129646685080b`). Final exact-head CI `34715186905`, CodeQL `34715186925`, Cross-engine `34715186930`, Performance `34715186910`, Windows Desktop `34715186953`, plus ready-triggered Performance `34728958901` passed. Fresh PR artifact `10304778189` (`sha256:3628be5882fc3d46bf0d02106ea57e5d23223063597011a7cf1bc01c5187ecb4`) was inspected. Post-merge integration is 3/3 green: CI `34729068520`, CodeQL `34729068487`, Windows Desktop `34729068512`; post-merge artifact `10309077513` has digest `sha256:d41d4f702677678f9562bb9727286095662bdce596a961d8547628f125ef93de`.

Active Batch 5: branch `chore/357-dialog-shell-editor-batch-5`, based exactly on verified `develop@ee83da00b66f0d2dde7b23d817fe67ec3f5c6a03`.

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

## Current checkpoint — 2026-09-13

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 3/9 (Stages 0, 1, 2).
- **Active stage:** Stage 3 — shared `DialogShell`.
- **Verified integration base:** `develop@ee83da00b66f0d2dde7b23d817fe67ec3f5c6a03` (tree `ab1cadf1347d4f0d134ff7f702b129646685080b`); Batch-4 post-merge CI `34729068520`, CodeQL `34729068487`, and Windows Desktop `34729068512` are green.
- **Active delivery:** `chore/357-dialog-shell-editor-batch-5`, based exactly on that verified integration commit.
- **Final Stage-3 audit result:** the exact `modal-backdrop + quick-modal` family is exhausted. `CommandPalette`/change history use a distinct command-palette motion/combobox contract; `CardCreateDialog` and card/bank archive dialogs are picker-family composites; `AppSelectInput`/`AppDateInput` are portal popovers; `ReceiptInbox` is a unique OCR workspace with nested confirmation. None justifies widening the quick shell. In contrast, Lending, Savings, Loans, Recurring, Planning and Credit Card form a genuine repeated `editor-backdrop + panel neo-raised editor-dialog` family with direct `useModalFocus` and CSS-owned `rh-backdrop-in` / `rh-dialog-in` animation plus existing reduced-motion CSS.
- **Batch-5 implementation checkpoint:** `DialogShell` now has a constrained `presentation='quick'|'editor'` contract. The editor path renders plain DOM with `editor-backdrop` and `panel neo-raised editor-dialog <domain-class>`, so existing CSS remains the sole owner of editor animation/reduced-motion. No arbitrary backdrop/surface class props were introduced. `LendingPage` and `SavingsPage` now delegate only shell/focus/ARIA/dismissal ownership to the editor presentation; their form controls, validation, event creation, savings-source assignment and finance semantics remain page-owned.
- **Current source head:** `31b8ae287a36270413302cdd98c2e178dc3ff65b` (tree `51b586f224b4201eb81580f96e41f78f7470119f`) before this plan-sync commit. Base→source-head contains only `DialogShell`, Lending, Savings and the focused source guard; no CSS, API, auth, persistence, database, Windows packaging, release/deploy or production-data paths.
- **Next action:** verify the post-plan exact diff, open a draft PR to `develop`, run exact-head CI/CodeQL/Cross-engine/Performance/Windows gates and inspect fresh Lending/Savings editor evidence on desktop/mobile including focus, Escape/backdrop dismissal, nested AppSelect/AppDate interactions, validation association and reduced-motion behavior. Resolve any generated visual persistence/review blockers, then ready/squash-merge only to `develop`; require fresh post-merge CI + CodeQL + Windows 3/3 before any next write batch.

## Resume procedure for a future chat

1. Read root `AGENTS.md` and directly applicable checked-in rules.
2. Read this file completely and issue #357. Do not inspect the protected excluded issue.
3. Fetch the real `develop`, `main`, active branch/PR, latest commits, checks and unresolved review threads.
4. Treat GitHub as source of truth over any SHA/checkpoint recorded here if the repository has moved.
5. Continue the first incomplete item in the active stage; do not skip an open blocker.
6. Use narrow tests first, then required full gates. Never weaken behavioral/security/audit tests.
7. For UI-affecting refactors, inspect fresh real desktop/mobile rendered evidence before merge.
8. After every meaningful checkpoint update this file plus the active issue/PR with completed scope, exact head where useful, validation state, blockers and exact next action.
9. After a bounded PR is merged and verified on `develop`, create/resume the next bounded branch/PR rather than piling unrelated stages together.
10. Keep #357 open until all stages are complete. No `main`, release or deploy without separate explicit owner authorization.
