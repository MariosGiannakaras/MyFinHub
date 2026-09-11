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
- [ ] Migrate bounded safe adopter groups incrementally. Batch 1 (`ConfirmDialog`, `MoneyEditDialog`, reusable `CardCreateDialog` actions) merged via PR #363. Batch 2 (`DesktopUpdatePanel`, `PageErrorBoundary`, `PersistenceNotice`, `AccountMetadataSettings`) merged via PR #364. Batch 3 (`AppDateInput`, `AppSelectInput`, `CommandPalette` generic icon actions) merged via PR #365. Batch 4 (Lending generic primary/secondary/ghost/icon actions) merged via PR #366. Batch 5 (Recurring generic page-heading, mobile payment and editor primary/secondary/icon actions) merged via PR #367. Batch 6 (Loans generic page-heading and editor primary/secondary/icon actions) merged via PR #368. Batch 7 (Cards generic bank-creation heading/dialog actions) merged via PR #369. Batch 8 (`LegacyTransactionEditor` generic close/cancel/save actions) merged via PR #370. Batch 9 (Planning generic page-heading and editor primary/secondary/icon actions) merged via PR #371. Batch 10 (`CategoryTreeEditor` and `BudgetRuleSettings` explicit save/cancel actions) merged via PR #372. Batch 11 (`QuickAdd` generic close/cancel/submit) merged via PR #373. Batch 12 (`ContextualQuickAdd`, `CategoryIconsWorkspace`, `ReceiptInbox` generic class-hook actions) merged via PR #374. Batch 13 is active and migrates only Credit Card controls already owning canonical `save-button`, `secondary`, or `icon-button` hooks while preserving card-deck/navigation/row/destructive/picker-specific controls raw.
- [ ] Retain compatibility aliases only while active non-migrated code still depends on them; remove only after adoption is proven complete.
- [ ] Verify keyboard/focus/disabled/loading/submit semantics and fresh rendered screenshots after each bounded migration.

Active delivery: issue #357 / branch `chore/357-button-adopters-batch-13`.

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

## Current checkpoint — 2026-09-11

- **Overall tracker:** #357 — OPEN.
- **Completed stages:** 2/9 (Stage 0, Stage 1).
- **Active stage:** Stage 2 — shared Button / IconButton.
- **Verified Batch-1 integration:** PR #363 merged to `develop@c97a618d4b817bed1aed3d57c6f258dda32e0e18`; post-merge CI, CodeQL and Windows Desktop passed.
- **Verified Batch-2 integration:** PR #364 squash-merged to `develop@fc6d38de49e9f235b03f2e0394e9f470daf16215`. Integration CI `34396227607`, CodeQL `34396227577`, and Windows Desktop `34396227578` all passed, including fresh rendered frontend QA and the Windows package/install/uninstall checks.
- **Verified Batch-3 integration:** PR #365 squash-merged to `develop@a664c31e8dd1327f6677a4d252ade611c7eba9ef`. PR exact-head CI `34399965066`, CodeQL `34399965089`, Cross-engine `34399965069`, Performance `34399965077`, and Windows Desktop `34399965067` passed. Post-merge integration CI `34401094200`, CodeQL `34401094220`, and Windows Desktop `34401094263` also passed, including fresh rendered frontend QA and Windows package/install/uninstall validation.
- **Verified Batch-4 integration:** PR #366 squash-merged to `develop@68ebce7c337f8996adb2d809edf15d59a8e1e699`. PR final exact-head CI `34409570750`, CodeQL `34409570735`, Cross-engine `34409570830`, Performance `34409570716`, and Windows Desktop `34409570727` passed after rendered QA caught and the branch fixed the shared ghost/text compatibility geometry. Post-merge integration CI `34451302610`, CodeQL `34451302579`, and Windows Desktop `34451302654` also passed, including rendered frontend QA, audits, package/install/uninstall and checksum validation.
- **Verified Batch-5 integration:** PR #367 squash-merged to `develop@8aa95989289cd3e35b3c738f5dc26f09b9c3e8d5`. PR final exact-head CI `34461507413`, CodeQL `34461507374`, Cross-engine `34461507406`, Performance `34461507522`, and Windows Desktop `34461507384` passed after fresh Recurring full-page desktop/mobile and editor desktop/mobile evidence was personally inspected. Snapshot persistence rerun `34452765557` passed after a transient CDP context failure, and generated `visual-qa/**` churn was removed from the source diff. Post-merge integration CI `34462899174`, CodeQL `34462899192`, and Windows Desktop `34462899248` all passed, including rendered frontend QA, audits and Windows package/install/launch/uninstall/checksum validation.
- **Verified Batch-6 integration:** PR #368 squash-merged to `develop@db82651aac043923dbbfccf8d1fe9592454561d2`. PR final exact-head CI `34464474191`, CodeQL `34464474300`, Cross-engine `34464474127`, Performance `34464474116`, and Windows Desktop `34464474210` passed. Fresh Cards-independent Loans desktop/mobile rendered evidence was inspected from the CI artifact; no dedicated loan-editor screenshot was emitted or claimed. Post-merge integration CI `34466727382`, CodeQL `34466727336`, and Windows Desktop `34466727238` all passed, including rendered QA, audits and Windows package/install/launch/uninstall/checksum validation.
- **Verified Batch-7 integration:** PR #369 squash-merged to `develop@5bd0af236beeb28d38974d606b5ca4a157149453` (tree `c4e3f027f64b98bd155ff86c107651f4a4ac5344`). Final PR head `400a391799363c7f640c745b8681a71531307f97` had an exact four-file net diff with generated `visual-qa/**` churn removed. Final exact-head CI `34485658967`, CodeQL `34485659077`, Cross-engine `34485658966`, Performance `34485658978`, and Windows Desktop `34485658971` all passed; additional ready-for-review Performance `34487260907` also passed. Fresh Cards evidence was inspected for 4/4 available views (desktop/mobile full-page plus desktop/mobile core-flow); no dedicated new-bank-dialog screenshot was emitted or claimed. Post-merge integration CI `34487569960`, CodeQL `34487569967`, and Windows Desktop `34487569954` all passed.
- **Verified Batch-8 integration:** PR #370 squash-merged to `develop@2027fdacbda7d9958392450fa5899a14f39a80ab` (tree `c047726d62fa141064599265497925cd6b5fe7fb`). Final exact head `d561bf9bfddc4a8eadbfe467a3bbbc0b550a6a29` had exactly three intended changed files after generated `visual-qa/**` churn was removed. Final exact-head CI `34493086977`, CodeQL `34493087054`, Cross-engine `34493087007`, Performance `34493087045`, and Windows Desktop `34493087150` all passed. Fresh legacy-transaction evidence was inspected; mobile captured the actual editor open and desktop plus the rendered QA flow covered edit/save behavior without overclaiming the post-save desktop screenshot. Post-merge integration CI `34506871178`, CodeQL `34506871257`, and Windows Desktop `34506871242` all passed, including rendered frontend QA, audits and Windows package/install/launch/uninstall/checksum validation.
- **Verified Batch-9 integration:** PR #371 squash-merged to `develop@03b1c8868156f3ec38bc2d90e80292f37d295403` (tree `f135279080ff6adf810d8113821b9266aec79cb8`). Final exact head `224d689faa175a3ae4570a90cfaed5db059ee410` had exactly three intended changed files after generated `visual-qa/**` churn was removed. Final exact-head CI `34510147315`, CodeQL `34510147147`, Cross-engine `34510147276`, Performance `34510147322`, and Windows Desktop `34510147288` all passed. Fresh Planning desktop/mobile evidence was personally inspected; no dedicated editor screenshot was emitted or claimed, while rendered Planning QA exercised editor autofocus/Escape, create/save, completion submit, lifecycle confirmations, responsive overflow, accessible names and touch targets. Post-merge integration is **3/3 green**: CI `34511977202`, CodeQL `34511976921`, Windows Desktop `34511976866`; Windows package/install/launch/uninstall/checksum validation passed and release publishing was skipped.
- **Verified Batch-10 integration:** PR #372 squash-merged to `develop@d2614c266025fb29c44afbe7265add58401c510e` (tree `271a2047a53275226e791e1a9198d04182a7227b`). Final exact head `de296a3600bde7b65abc9931754f9e8f6e4a8a46` had exactly four intended changed files after generated `visual-qa/**` churn was removed. Final exact-head CI `34537680657`, CodeQL `34537680641`, Cross-engine `34537680638`, Performance `34537680639`, and Windows Desktop `34537680648` all passed; additional ready-for-review Performance `34568833310` also passed. Fresh Settings Categories desktop/mobile, rule-editor desktop/mobile and ordered-rule desktop evidence was personally inspected; no dedicated `CategoryTreeEditor` inline-edit/save screenshot was emitted or claimed. Post-merge integration is **3/3 green**: CI `34569011908`, CodeQL `34569011913`, Windows Desktop `34569011893`; Windows package/install/launch/uninstall/checksum validation passed and release publishing was skipped.
- **Verified Batch-11 integration:** PR #373 squash-merged to `develop@6bd2ebe3eeaeab0ff91ebd69456b47a5012616b0` (tree `4e64dc89104d7bf8ce651a2c8fb341cbd3a3082a`). Final exact head `19c4200e1de28536567931d96c76d73dfe75b87b` had exactly three intended changed files. Final exact-head CI `34571904847`, CodeQL `34571904866`, Cross-engine `34571904929`, Performance `34571904843`, and Windows Desktop `34571904851` all passed; ready-for-review Performance `34584628391` also passed. Fresh QuickAdd editor-open desktop evidence was inspected in light and dark states; the emitted mobile primitive screenshot was post-discard, while the rendered 375×812 flow itself opened QuickAdd and passed dirty-close, nested confirmation, Escape/focus-return and overflow checks. Post-merge integration is **3/3 green**: CI `34597315030`, CodeQL `34597315009`, Windows Desktop `34597315019`.
- **Verified Batch-12 integration:** PR #374 squash-merged to `develop@259a63703fa129f730a4e7f15ff725813aae955a` (tree `d48e6924e10db8532a1148802e2439815e930957`). Batch 12 migrated **19/19** target controls across `ContextualQuickAdd` (3/3), `CategoryIconsWorkspace` (9/9), and `ReceiptInbox` (7/7). Final exact-head required gates were **5/5 green**: CI `34598769718` attempt 2, CodeQL `34598769638`, Cross-engine `34598769631`, Performance `34598769644`, Windows Desktop `34598769651`; ready-for-review Performance `34606682511` also passed. Fresh contextual-payment, taxonomy desktop/mobile + blocked-retirement, and receipt captured/proposal evidence was personally inspected. Review blockers were zero. Post-merge integration is **3/3 green**: CI `34607026267`, CodeQL `34607026236`, Windows Desktop `34607026237`.
- **Superseded work:** stale pre-integration PR #360 was closed without merge; it diverged from the bounded Batch-1 path and is not a continuation branch.
- **Active Batch-13 branch/base:** `chore/357-button-adopters-batch-13`, created exactly from verified `develop@259a63703fa129f730a4e7f15ff725813aae955a`.
- **Current Batch-13 implementation:** `7c02323786a641948fefbfb918c7ea1718d025b4` migrates Credit Card canonical-hook actions to shared primitives; `e04c090176636c0e2829aee9f73cb620c604ca8b` adds a dedicated source guard.
- **Batch-13 target controls:** **16/16 migrated** in `CreditCardPage`: **6/6 primary**, **8/8 secondary**, **2/2 icon-only** controls that previously owned literal `save-button`, `secondary`, or `icon-button` hooks.
- **Preserved raw exceptions in Batch 13:** card-deck mode selectors, horizontal previous/next navigation, inline limit edit, cycle-link affordance, purchase/payment row actions, archive-manager picker close, and destructive card/event actions remain raw domain/composite controls.
- **Current source scope:** **2/2 intended implementation/test files before this plan checkpoint** (`CreditCardPage.tsx`, dedicated source guard); no CSS, finance/accounting, statement-linking, archive/delete semantics, auth, API, database, persistence, routes, Windows, release or deploy changes.
- **Stage-2 progress:** 2/5 checklist items complete; the bounded migration item remains in progress across incremental batches.
- **Validation state:** Batch 13 still requires the draft PR, exact-head application/API/CodeQL/cross-engine/performance/Windows gates, fresh Credit Card rendered evidence where emitted, generated snapshot cleanup if needed, and review-thread verification before merge.
- **Intentional exceptions remain:** card-design radio options, Cards card-domain/composite controls, Lending domain/composite controls, Recurring row/menu/history controls, Loans row actions, Planning row/horizon/kind controls, BudgetRuleSettings budget/rule row controls, QuickAdd kind/frequent/split controls, taxonomy selectors/row controls, receipt destructive/domain controls, Credit Card deck/navigation/row/destructive/picker-specific controls, and other documented domain composites stay raw until a semantically equivalent typed API exists.
- **Next action:** open the bounded Batch-13 draft PR, run exact-head validation, inspect fresh Credit Card evidence without overclaiming unavailable states, clean any generated snapshot churn, resolve real regressions/review threads, then squash-merge to `develop` only when final-head gates are green and verify the integration push.

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
