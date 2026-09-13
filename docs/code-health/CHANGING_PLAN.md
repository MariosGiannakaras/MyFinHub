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
| Dialog shell | `DialogShell` for eligible modal shells; preserve specialized dialog/picker semantics |
| App frame | `AppShell` |
| Page frame | `page-stack` + `page-heading` |
| Theme | existing semantic light/dark tokens |
| Buttons | shared `Button` + `IconButton`; intentional domain/composite controls may remain raw |
| Generic surfaces | shared `Surface` (`raised` / `flat` / `inset`) for genuinely generic hosts; domain cards remain semantic components |

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

### Stage 3 — Canonical `DialogShell` — COMPLETE

Goal: centralize common modal-shell mechanics only where presentation and behavior contracts genuinely match; do not force pickers/popovers or specialized domain surfaces into one abstraction.

- [x] Establish shared `DialogShell` ownership for canonical backdrop, modal ARIA container, `useModalFocus`, Escape/dismiss behavior and reduced-motion transition policy.
- [x] Batch 1: migrate `ConfirmDialog` and `MoneyEditDialog` while preserving alert/dialog roles, busy guards, validation relationships, actions and CSS/DOM contracts.
- [x] Batch 2: migrate `QuickAdd` while preserving dirty-close nested confirmation, parent/child focus ownership, split-field autofocus, form semantics and approved Quick Entry presentation.
- [x] Batch 3: add an explicit no-motion `DialogShell` path and migrate the static `LegacyTransactionEditor` shell without changing rendered backdrop/surface classes, ARIA, focus or dismissal behavior.
- [x] Batch 4: migrate only the special static `ContextualQuickAdd` modal to the validated no-motion shell while preserving its dynamic description/error relationship, generic QuickAdd route and all payment/domain semantics.
- [x] Perform a final exact-tree eligibility audit and stop when the matching quick-modal family is exhausted rather than forcing picker/palette/editor/OCR overlays through the abstraction.
- [x] Defer header/footer abstractions because the completed adopter set did not prove a stable additional contract beyond shell ownership; specialized body/form/destructive/busy behavior remains domain-owned.
- [x] Keep native `alert`/`confirm`/`prompt` prohibited through existing guards.

Batch 1 delivery: PR #380 squash-merged to `develop@490dec1badaf2e0b6571f59d01f3b3be01baaab7` (tree `52df6b2261c3ae4690901d06f5aeb008e87bd145`). Final exact-head CI `34682517666`, CodeQL `34682517632`, Cross-engine `34682517694`, Performance `34682517646`, Windows Desktop `34682517680`, plus ready-triggered Performance `34683083931` passed. Post-merge integration is 3/3 green: CI `34683195957`, CodeQL `34683195937`, Windows Desktop `34683195943`.

Batch 2 delivery: PR #381 squash-merged to `develop@da82108b0ef8c552e958d241db4e8fd47a1e1574` (tree `8f771e132cbf497e6c814a95372d737e2db56565`). Final exact-head required gates and ready-triggered Performance passed. Post-merge integration is 3/3 green: CI `34701157385` attempt 2, CodeQL `34701157366`, Windows Desktop `34701157384`. CI attempt 1 had a non-reproducing compact-mobile subpixel touch-target result; the full targeted rerun passed on the identical tree without source or threshold changes.

Batch 3 delivery: PR #382 squash-merged to `develop@c962ee5ccc90036584aba16fe397ef0f097dee98` (tree `56ab592bf41dc38cd0f2d891e56af33fa478011c`). Final exact-head CI `34702873522`, CodeQL `34702873521`, Cross-engine `34702873518`, Performance `34702873514`, Windows Desktop `34702873530`, plus ready-triggered Performance `34703532465` passed. Fresh PR artifact `10300746480` (`sha256:4810c95fbbe24d3e2d7c128ae9b6c223943f5e7fe928816d151d79f6665fc3c6`) was inspected. Post-merge CodeQL `34703684736` and Windows Desktop `34703684715` passed. Post-merge CI `34703684734` attempt 1 hit an isolated Chromium/CDP `Cannot find context with specified id` failure in `icon-packs-qa.mjs`; the unchanged exact-tree rerun attempt 2 passed the full rendered matrix, audits and evidence upload. Fresh post-merge artifact `10304577099` has digest `sha256:b6c0a0eba4f28880a082812d03cf405cf2b685036b9b068764ed7948ca43aeaf`.

Batch 4 delivery: PR #383 squash-merged to `develop@ee83da00b66f0d2dde7b23d817fe67ec3f5c6a03` (tree `ab1cadf1347d4f0d134ff7f702b129646685080b`). Final exact-head CI `34715186905`, CodeQL `34715186925`, Cross-engine `34715186930`, Performance `34715186910`, Windows Desktop `34715186953`, plus ready-triggered Performance `34728958901` passed. Fresh artifact `10304778189` (`sha256:3628be5882fc3d46bf0d02106ea57e5d23223063597011a7cf1bc01c5187ecb4`) was inspected for contextual payment/action flows and mobile containment. Post-merge integration is 3/3 green: CI `34729068520`, CodeQL `34729068487`, Windows Desktop `34729068512`.

Final Stage-3 audit on exact `develop@ee83da00b66f0d2dde7b23d817fe67ec3f5c6a03` found no additional current `DialogShell` adopter: `CardCreateDialog` remains a picker/card-preview composite, `CommandPalette` keeps palette-specific combobox/listbox and motion geometry, `ReceiptInbox` keeps OCR lifecycle plus nested-confirm ownership, the routed lending/savings/loans/recurring/planning/credit forms remain a separate `editor-backdrop + editor-dialog` presentation family, and app-owned select/date/navigation overlays remain specialized controls.

### Stage 4 — Canonical `Surface` — ACTIVE

Goal: centralize generic elevation ownership without erasing semantic/domain component boundaries or changing approved rendering.

- [x] Batch 1 foundation: introduce polymorphic `Surface` with explicit `raised` / `flat` / `inset` variants mapped to the existing `neo-*` compatibility hooks, with no CSS changes.
- [x] Batch 1 adopters: move only the generic `KeyboardShortcutsPanel` and `ReadabilitySettings` outer shells to `Surface` while preserving semantic `section` hosts, ARIA relationships and existing panel-specific classes.
- [x] Validate Batch 1 with exact-head app/API checks, rendered Settings desktop/mobile evidence, cross-engine, performance and Windows gates; merge only to `develop` and require post-merge 3/3 integration.
- [x] Batch 2: migrate only the active Settings generic raised shells in `DesktopUpdatePanel` and the Data-tab backup/import action cards while preserving `article`/`section` semantics, ARIA, backup/import safety and Windows-update behavior.
- [x] Batch 3: migrate only generic application-chrome elevation hosts in `AppShell` plus the matching loading-shell sidebar to `Surface`, preserving exact semantic tags/classes and leaving overlay/state-specific `neo-*` ownership specialized.
- [ ] Batch 4: allow the polymorphic `Surface` to carry the host element's typed React 19 `ref`, then migrate only the generic `PageErrorBoundary` raised host while preserving its `section`, alert semantics, programmatic focus and same-route Dashboard recovery ordering.
- [ ] Continue bounded adopter audits after integration; prefer genuinely generic shells and avoid migrating semantic domain cards solely because they use `neo-*` classes.
- [ ] Keep KPI/account/payment/attention/loan/lending/recurring/planning/report and other domain surfaces semantic; composition with `Surface` is allowed only when it clarifies generic elevation ownership without flattening domain behavior.
- [ ] Retain `neo-raised` / `neo-flat` / `neo-inset` as compatibility CSS hooks during Stage 4. CSS ownership/re-layering remains Stage 5 work.

Batch 1 delivery: PR #384 squash-merged to `develop@f3d895736066ba689c8f20607cd2a52035a6826f` (tree `0c6d6ec0e3f46ebdd422c0a04002da7dbe4bc5d7`). Exact-head CI `34730999549`, CodeQL `34730999696`, Cross-engine `34730999589`, Performance `34730999623`, and Windows Desktop `34730999574` passed; fresh artifact `10309636017` (`sha256:145847c0d48183431e1e3acd43921c0d72af4e9c31e8696c269fc70c50f2edf0`) was inspected for Settings desktop/mobile parity. Post-merge integration is 3/3 green: CI `34731699612` attempt 3, CodeQL `34731699557`, Windows Desktop `34731699551`. The successful post-merge artifact is `10315576660` (`sha256:8cfba1c931b7f07ba68f6488c9313adf80902959718872faff89508133b73b56`).

Batch 2 delivery: PR #385 squash-merged to `develop@4a9743949f4499f4e45ac90b91a095030b54bb42` (tree `2781e41c6d10f3db582fa6cb5cf39fc20fa27992`). Exact cleanup-head CI `34750309313`, CodeQL `34750309377`, Cross-engine `34750309390`, Performance `34750309318`, Windows Desktop `34750309323`, plus ready-triggered Performance `34754456357` passed. Fresh artifact `10315820595` (`sha256:b1200075dee68db25637221419982e009b41bdb03e538dc3e7efe8a1e0a66e12`) was inspected for Settings General/Data desktop/mobile parity. Post-merge integration is 3/3 green: CI `34754599030`, CodeQL `34754599047`, Windows Desktop `34754599020`.

Batch 3 delivery: PR #387 squash-merged to `develop@08be1340c369c676b3f3162f672010ae5bf8fdd5` (tree `dff7519b969a891fce1fe00bd29087efe76be81c`). Exact validated head `888c8b404f04fbe9dab7d4cc0266ea991a6a11d2` passed CI `34758351866` attempt 2, CodeQL `34758351882`, Cross-engine `34758351916`, Performance `34758351907`, Windows Desktop `34758351859`, plus ready-triggered Performance `34768656684`. Fresh artifact `10321174226` (`sha256:9359fd9c655401d99878dfb643b3b3b617daaf52f0e10e8a30da7bc5adae6dc4`) was inspected for desktop/mobile/loading-shell parity. Post-merge integration is 3/3 green: CI `34768843217`, CodeQL `34768843133`, Windows Desktop `34768843185`.

Active Batch 4: branch `chore/357-surface-batch-4`, based exactly on verified `develop@08be1340c369c676b3f3162f672010ae5bf8fdd5`. Source/test milestone `789133d5b6e3408177ba7b4075f4560821000b5a` changes only `Surface`, `PageErrorBoundary` and the focused Surface source guard: `Surface` now derives native props from `ComponentPropsWithRef<T>` so React 19 can pass the host's typed `ref` through the existing `createElement` spread, and `PageErrorBoundary` composes the canonical raised `Surface` while retaining its same `createRef<HTMLElement>`, focus callback, `role="alert"`, title relationship, `tabIndex=-1`, recovery ordering and buttons. No CSS or finance/accounting/auth/API/persistence/routing/database/Windows/release behavior changes.

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
- **Completed stages:** 4/9 (Stages 0, 1, 2, 3).
- **Active stage:** Stage 4 — canonical generic `Surface` ownership.
- **Verified integration base:** `develop@08be1340c369c676b3f3162f672010ae5bf8fdd5` (tree `dff7519b969a891fce1fe00bd29087efe76be81c`); Batch-3 post-merge CI `34768843217`, CodeQL `34768843133`, and Windows Desktop `34768843185` are green.
- **Active delivery:** `chore/357-surface-batch-4`, based exactly on that verified integration commit.
- **Batch-4 scope:** expose the native host `ref` through `Surface` using React 19 typed props and migrate only `PageErrorBoundary` from raw `panel neo-raised workspace-error` to `Surface as="section" variant="raised"`. Preserve the existing `createRef<HTMLElement>`, programmatic error focus, alert/title semantics, safe user-facing copy, retry/Dashboard/reload actions and same-route recovery ordering.
- **Source/test milestone:** `789133d5b6e3408177ba7b4075f4560821000b5a`; the existing `shared-ui-source` and rendered `recovered-surface-qa.mjs` contracts continue to guard focus and same-page Dashboard recovery, while `tests/surface-source.test.ts` now also guards typed ref ownership and the canonical adopter markup.
- **Eligibility boundary:** domain cards and specialized overlays remain out of scope. No mass migration by `neo-*` class name. The stale duplicate PR #388 was closed without merge after concurrent integration was detected and must not be reused.
- **Next action:** verify the exact base→head diff after plan sync, open a draft Batch-4 PR to `develop`, run required CI/CodeQL/Cross-engine/Performance/Windows gates and inspect fresh `recovered-page-error-focus` plus representative desktop/mobile shell evidence. Resolve any source-test, type, generated visual persistence or review blocker at root cause; then mark ready, wait for ready-triggered required checks, squash-merge only to `develop`, and require fresh post-merge CI + CodeQL + Windows 3/3 before another Stage-4 write batch.

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
