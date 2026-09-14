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

- [x] Introduce typed `Button` variants and accessible `IconButton` while preserving approved CSS hooks.
- [x] Migrate bounded safe adopter groups while preserving intentional domain/composite raw controls.
- [x] Remove compatibility aliases after active adopters no longer depend on them.
- [x] Verify keyboard/focus/disabled/submit semantics and fresh rendered evidence.

Delivery history: bounded PRs #363–#379. Final Stage-2 completion PR #379 squash-merged to `develop@84fc1c3b70533f0519b26a69f884fd756d7c965d`; post-merge CI `34679070861`, CodeQL `34679070828`, Windows Desktop `34679070906` passed.

Intentional raw exceptions remain where a button is a domain/composite control rather than a generic action primitive: card-design radios, payment-card interactions, row/domain navigation controls, segmented/sort controls, taxonomy/composite selectors, and comparable documented cases.

### Stage 3 — Canonical `DialogShell` — COMPLETE

Goal: centralize common modal-shell mechanics only where presentation and behavior contracts genuinely match; do not force pickers/popovers or specialized domain surfaces into one abstraction.

- [x] Establish shared `DialogShell` ownership for canonical backdrop, modal ARIA container, `useModalFocus`, Escape/dismiss behavior and reduced-motion transition policy.
- [x] Batch 1: migrate `ConfirmDialog` and `MoneyEditDialog`.
- [x] Batch 2: migrate `QuickAdd` while preserving dirty-close nested confirmation and focus ownership.
- [x] Batch 3: add explicit no-motion shell support and migrate `LegacyTransactionEditor`.
- [x] Batch 4: migrate the special static `ContextualQuickAdd` modal.
- [x] Complete an exact-tree eligibility audit and stop when the matching quick-modal family is exhausted.
- [x] Keep specialized body/form/destructive/busy behavior domain-owned and keep native `alert`/`confirm`/`prompt` prohibited.

Delivery history:
- PR #380 -> `develop@490dec1badaf2e0b6571f59d01f3b3be01baaab7`; post-merge CI `34683195957`, CodeQL `34683195937`, Windows `34683195943`.
- PR #381 -> `develop@da82108b0ef8c552e958d241db4e8fd47a1e1574`; post-merge CI `34701157385` attempt 2, CodeQL `34701157366`, Windows `34701157384`.
- PR #382 -> `develop@c962ee5ccc90036584aba16fe397ef0f097dee98`; post-merge CI `34703684734` attempt 2, CodeQL `34703684736`, Windows `34703684715`.
- PR #383 -> `develop@ee83da00b66f0d2dde7b23d817fe67ec3f5c6a03`; post-merge CI `34729068520`, CodeQL `34729068487`, Windows `34729068512`.

Final Stage-3 audit found no additional current `DialogShell` adopter: card creation remains a picker/card-preview composite, command palette keeps palette-specific combobox/listbox and motion geometry, Receipt Inbox keeps OCR lifecycle plus nested-confirm ownership, routed finance editors remain a separate `editor-backdrop + editor-dialog` family, and app-owned select/date/navigation overlays remain specialized controls.

### Stage 4 — Canonical `Surface` — COMPLETE

Goal: centralize generic elevation ownership without erasing semantic/domain component boundaries or changing approved rendering.

- [x] Batch 1 foundation: introduce polymorphic `Surface` with explicit `raised` / `flat` / `inset` variants mapped to the existing `neo-*` compatibility hooks, with no CSS changes.
- [x] Batch 1 adopters: migrate `KeyboardShortcutsPanel` and `ReadabilitySettings` outer shells while preserving semantic hosts and ARIA.
- [x] Batch 2: migrate active Settings generic raised shells in `DesktopUpdatePanel` and Data-tab backup/import cards while preserving safety and Windows-update behavior.
- [x] Batch 3: migrate generic application-chrome elevation hosts in `AppShell` plus the matching loading-shell sidebar while leaving overlay/state-specific ownership specialized.
- [x] Batch 4: extend polymorphic native props with React 19 `ComponentPropsWithRef<T>` and migrate only the generic `PageErrorBoundary` raised host while preserving focus, alert semantics and Dashboard recovery ordering.
- [x] Complete a bounded adopter audit and stop rather than migrating semantic domain cards solely because they use `neo-*` classes.
- [x] Retain `neo-raised` / `neo-flat` / `neo-inset` as compatibility hooks; CSS ownership/re-layering remains Stage 5 work.

Batch 1 delivery: PR #384 squash-merged to `develop@f3d895736066ba689c8f20607cd2a52035a6826f`. Exact-head CI `34730999549`, CodeQL `34730999696`, Cross-engine `34730999589`, Performance `34730999623`, Windows `34730999574` passed; fresh artifact `10309636017` (`sha256:145847c0d48183431e1e3acd43921c0d72af4e9c31e8696c269fc70c50f2edf0`) was inspected. Post-merge CI `34731699612` attempt 3, CodeQL `34731699557`, Windows `34731699551` passed.

Batch 2 delivery: PR #385 squash-merged to `develop@4a9743949f4499f4e45ac90b91a095030b54bb42`. Exact cleanup-head CI `34750309313`, CodeQL `34750309377`, Cross-engine `34750309390`, Performance `34750309318`, Windows `34750309323`, plus ready-triggered Performance `34754456357` passed. Fresh artifact `10315820595` (`sha256:b1200075dee68db25637221419982e009b41bdb03e538dc3e7efe8a1e0a66e12`) was inspected. Post-merge CI `34754599030`, CodeQL `34754599047`, Windows `34754599020` passed.

Batch 3 delivery: PR #387 squash-merged to `develop@08be1340c369c676b3f3162f672010ae5bf8fdd5`. Validated head `888c8b404f04fbe9dab7d4cc0266ea991a6a11d2` passed CI `34758351866` attempt 2, CodeQL `34758351882`, Cross-engine `34758351916`, Performance `34758351907`, Windows `34758351859`, plus ready-triggered Performance `34768656684`. Fresh artifact `10321174226` (`sha256:9359fd9c655401d99878dfb643b3b3b617daaf52f0e10e8a30da7bc5adae6dc4`) was inspected. Post-merge CI `34768843217`, CodeQL `34768843133`, Windows `34768843185` passed.

Batch 4 delivery: PR #389 squash-merged to `develop@d0e267790612c625b352a484cb2d79e00d4e0e42` (tree `3612f712e6f7f72ed25794a7290e75863459320e`). Exact cleanup-head `9423a8204801b41898f9db305d25d2d626c9a035` passed CI `34778535110`, CodeQL `34778535094`, Cross-engine `34778535100`, Performance `34778535097`, Windows `34778535096`, plus ready-triggered Performance `34784263050`. Fresh artifact `10322922717` (`sha256:9906b28cd80e34f96da1fd6bbf7616b0dfd7fa4ca4fc95a9e5d7f339b609b103`) was inspected for page-error focus/recovery parity. Post-merge integration is 3/3 green: CI `34784419600`, CodeQL `34784419544`, Windows Desktop `34784419514`.

Stage-4 completion boundary: KPI/account/payment/attention/credit/loan/lending/recurring/planning/report and other domain surfaces remain semantic components. Specialized overlays and stateful domain cards are not migrated by `neo-*` class name. A stale duplicate PR #388 was closed without merge and must not be reused.

### Stage 5 — CSS ownership cleanup — ACTIVE

Goal: replace hidden global-style ownership and numeric loader coupling incrementally, while preserving exact CSS cascade, login/root budget boundaries, approved rendering and semantic theme behavior.

- [x] Stage-1 inventory documented the current numbered-file graph and hidden loader coupling.
- [x] Batch 1: eliminate unrelated domain-components-as-global-stylesheet-loaders by giving the late compatibility tail one explicit lazy workspace owner.
- [ ] Batch 2: give the preserved late-workspace compatibility sequence one named stylesheet entrypoint without changing the sequence or declarations.
- [ ] Replace numeric loader chains incrementally with named tokens/base/primitives/patterns/pages ownership.
- [ ] Reduce selector duplication and unnecessary `!important` only with proven visual parity.
- [ ] Keep runtime theme code focused on semantic token application rather than broad selector styling.
- [ ] Maintain deterministic visual regression evidence at every batch.

Batch 1 delivery: PR #390 squash-merged to `develop@167e30a9dd21e3436598263794d5aea512319afe` (tree `c7ddb6d4a9329bc0e1ad6dd080aa649170ba8251`). The root/login budget remains `part1.css`–`part46.css`, then `part57.css`; `WorkspaceStyleLayer` became the explicit lazy owner of the preserved late sequence; unrelated domain components no longer own global stylesheet side effects. Final exact-head CI `34824091916`, CodeQL `34824092106`, Cross-engine `34824092051`, Performance `34824092026`, Windows `34824091936` passed. Fresh artifact `10340640122` (`sha256:d33c769c8ccd10369f3850c7726dd5450f828078c10871784c16c6afe142bbcc`) was inspected. Post-merge integration is 3/3 green on the exact merge tree: CI `34825830962` attempt 2, CodeQL `34825831023`, Windows Desktop `34825830963`; CI attempt 1 had an isolated Chromium/CDP error in `ledger-foundations-qa.mjs` and the unchanged-tree targeted rerun passed.

Active Batch 2: PR #391, branch `chore/357-css-ownership-batch-2`, based exactly on verified `develop@167e30a9dd21e3436598263794d5aea512319afe`.

Batch-2 architecture:
- add `src/styles/workspace-compat.css` as the named owner for the exact preserved late sequence `part47.css -> part50.css -> part52.css -> part53.css`;
- make `WorkspaceStyleLayer` import only `workspace-compat.css`;
- keep the intentional direct `part50.css` compatibility import even though `part47.css` also reaches it transitively;
- keep `src/styles.css` unchanged, so root/login loading remains `part1.css`–`part46.css`, then `part57.css`;
- update source guards only to follow the named entrypoint while preserving the same approved-target requirements;
- change no existing CSS declaration, selector, specificity, media query, theme token or finance/domain behavior.

Batch-2 source implementation `05ef4447db234b8c2dc9644a1dbd0035d0af1f2f` has tree `5456fcb1b7fd13899dd8a849169f0e29e0ad838c`. Visual-QA run `34840347317` completed successfully and produced bot commit `f6d8367e90cb0a1ae6172e052729d9bdff1e6e3a`; source-to-bot comparison was generated-only under `visual-qa/**`. Fast-forward cleanup `50a71d837845764cf50545ebf5ca55ccd1d0aa8e` restored the exact source tree without force-pushing. Base-to-cleanup net scope is exactly five intended files, +24/−15.

Cleanup-head validation on `50a71d837845764cf50545ebf5ca55ccd1d0aa8e`: CI `34860435186`, CodeQL `34860435413`, Cross-engine `34860435235`, and Performance `34860435272` passed. Fresh CI artifact `10353979802` (`sha256:4a01241b748948527f8712160945cf7581e2fe20f0c261e2534fdecfd89e498a`) was inspected across Loans desktop/mobile, Settings mobile, and Recurring editor mobile with no missing styles, cascade break, overflow or responsive regression. Windows Desktop `34860435164` is blocked by an external `electron-builder` HTTP 504 during asset download: both the initial job and one targeted unchanged-tree rerun passed 139/139 test files, 697/697 tests, production build, bundle budgets, desktop checks and installer validation before failing at the same external Gateway Time-out. No source/workflow threshold has been changed to mask the upstream failure.

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

## Current checkpoint — 2026-09-14

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 5/9 (Stages 0, 1, 2, 3, 4).
- **Active stage:** Stage 5 — CSS ownership cleanup.
- **Verified integration base:** `develop@167e30a9dd21e3436598263794d5aea512319afe` (tree `c7ddb6d4a9329bc0e1ad6dd080aa649170ba8251`); Batch-1 post-merge CI `34825830962` attempt 2, CodeQL `34825831023`, and Windows Desktop `34825830963` are green.
- **Active delivery:** draft PR #391 / `chore/357-css-ownership-batch-2`.
- **Validated cleanup tree before docs sync:** `5456fcb1b7fd13899dd8a849169f0e29e0ad838c` at cleanup head `50a71d837845764cf50545ebf5ca55ccd1d0aa8e`; CI, CodeQL, Cross-engine and Performance are green and fresh rendered evidence is inspected.
- **Current blocker:** Windows run `34860435164` hit the same external `electron-builder` HTTP 504 Gateway Time-out on the original job and one targeted unchanged-tree rerun, after all application tests/build/budgets and desktop validation passed. Treat as upstream availability; do not weaken packaging checks or change source merely to bypass it.
- **Next action:** this documentation synchronization creates a new exact head. Verify the resulting base-to-head scope, clean any generated-only Visual-QA bot commit if one appears, then require fresh exact-head CI/CodeQL/Cross-engine/Performance/Windows. If Windows is green, inspect the fresh CI artifact, check reviews/threads, mark ready, wait for any ready-triggered required run, and squash-merge only to `develop` with an expected-head guard. If the external 504 recurs, keep the PR draft and do not merge. After merge, require exact-merge `develop` CI + CodeQL + Windows 3/3 before the next Stage-5 write batch.

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
