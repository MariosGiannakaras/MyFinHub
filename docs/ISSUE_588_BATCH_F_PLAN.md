# Issue #588 — Batch F (#9 enhanced budgets)

**Implementation owner:** `feat/588-enhanced-budgets-batch-f` (branch from `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2`). The owner requested larger cohesive coding batches and full CI/repair only once after coherent code. **No Production/main/Android changes.** Keep the PR draft while implementation churn is active.

**Accepted roadmap counters:** **Implementations 2/12 completed · Sub-implementations 4/24 completed.** #9 is still **0/1 implementation · 0/2 sub-implementations accepted**; code is not acceptance.

## Scope ownership / concurrency

- Separate actively owned PRs: #590 accounting (#2/#4/#5/#12, exact-head full gates active); #591 forecast (#7); #592 OCR/counterparties (#3/#6); #593 variable recurring (#8); #594 savings goals (#13); #595 dashboard chart owner work. This branch owns only **#9** (budgets), does not change their branches.
- Budget changes are additive on the existing `FinanceData.state.budgets` JSON state, not bank movements, loan/payment posting, settlement calculations or production data. Existing revision-aware `onUpsertBudget`/`onDeleteBudget` still own persistence and History/Undo/Redo. Avoid speculative integration into independently owned forecast source.
- Read `AGENTS.md`, issue #266, `PROJECT_RULES.md`, and the UI/UX standards/concept reconciliation before UI work. Shared `BudgetRuleSettings`, `MoneyInput`, `CategorySelectInput` and shared buttons retained.

## Batch F1 — model, security, UI and accounting changes (coded, review pending)

- [ ] **#9.1:** Allow category or **subcategory** limits with exact-cent amounts and optional stable `categoryIdentityId`/`subcategoryIdentityId` pointers backed by the canonical taxonomy, with alias-aware old spending. Parent category includes subcategories but sums actual expenses once. Confirmed legacy splits/new split portions, refunds and zero-spend internal transfers remain correct.
- [ ] **#9.1:** Opt-in **positive-only** month-to-month carryover, strictly scoped by category/subcategory/overall; never transfer budget as actual money. Previous month budgets must exist; stop chain at missing period and bounded history. Effective limit = monthly base + unspent prior allowance, with explicit breakdown.
- [ ] **#9.2:** Conservative projection of known future **pending scheduled expenses** and active recurring items that have a real due date/known amount, excluding matched scheduled duplicates, paid recurring and completed obligations. Actual used is separate from `projectedDue`, `projectedUsed` and forecast status. No phantom postings or inferred unknown loan/credit amounts.
- [ ] **#9.2:** Validate structural and semantic rules at server save/import boundary, protect category IDs and optional flags, historical as-of periods, safe integer cents, amount edit/Undo/Redo and duplicate commitment handling.

## Evidence and QA

Initial coherent code blob bundle includes new `BudgetScope`, optional taxonomy IDs/carryover flag, cent-exact allocation and projection, editor UX, server structural constraints, responsive CSS and focused regression tests. **No checks, browser renders or DB validations have been called PASS for the new branch.**

Before acceptance:
1. Run cheap branch/draft TS/hygiene/Vitest/API source checks **once after coherent code**, fix the complete class of faults together.
2. Add or extend `budget-rules-qa.mjs` rendered owner QA for desktop/tablet/mobile and failure/pending save, actual vs projection, first-month rollover, subcategory selector and parent rollups. Directly inspect evidence including dark/light, focus and clipping.
3. Inspect any residual finance/identity mismatch with other PRs; integrate only after owner branches are merged, never overwritten. Keep income/expense and on-save revision boundaries.
4. Mark PR ready only on final review-head candidate; run all required CI/security/Chromium+WebKit/Lighthouse/Windows and Real Stack if appropriate. No threshold relaxation; no merge pending/failing gates.

## Exact next action

Commit coherent feature code as a draft PR referencing issue #588. Then extend rendered QA and run narrow static/financial preflight. Do not wait for #590 CI to finish to develop independent #9 code. Counters remain **2/12 · 4/24** until fully accepted and integrated.

## Reports/Attention sibling integration — bundled with F1

- Reports overview now deduplicates hierarchical budget scopes for the aggregate (overall budget takes precedence; otherwise parent categories cover their children and independent subcategory budgets enter only once). Category and subcategory limits still retain their own health/attention rows.
- Replaced heuristic extrapolation from elapsed days in this budget overview with the conservative `verified actual + known pending obligations` projection. The forecast explicitly excludes unknown spending and does not book future transactions.
- Attention labels distinguish subcategory paths from parent categories; existing actual near/exceeded severity remains based on booked expenditure, not merely advisory projected overrun.
- Shared Reports DOM, mobile summary, semantic progressbar, finance precision, accounts and optimistic save/history contracts stay intact. These source changes require rendered sibling QA and limit validation before acceptance.

**Implementation progress:** code bundled into draft PR #596, accepted subitems **0/2**; roadmap **2/12 · 4/24**. Exact next action: finish integrated browser evidence and focused type/finance tests, batch any failures once, then final required review gates.

## Second coherent coding slice — historical aliases, safe identity references

- Historical category and subcategory budget spending preserves display names from the **actual posting part**, including confirmed legacy splits whose historical labels were later removed from the current taxonomy; budget matching still uses normalized ID/alias identity keys.
- The editor stores stable category/subcategory IDs only when those IDs actually exist in canonical persistent identity state. No synthetic lookup-only IDs are stored in a legacy state; old name-only budgets remain writable.
- Server category identity validation now rejects forged, missing, wrong-kind, wrong-parent or cross-category stable budget references. The category tree remains canonical and historic alias read compatibility is not rewritten.
- Recurring/scheduled dedup is conservative: both **same amount, account, category, date AND same named obligation** must match; two different real obligations with identical amount are retained. Added regression for distinct bills and reviewed historical split.
- No reviewed production finance history changed. Code is committed on draft PR; **no acceptance or full gate PASS claimed**. Next step is one grouped narrow preflight and rendered workflow extension.

**Counters remain Implementations 2/12 completed · Sub-implementations 4/24 completed.**

## Third coherent coding slice — revision-safe budget editing

- Existing budget rows now have a dedicated accessible **Edit** control (shared IconButton/Pencil), loading the exact stored scope/category/subcategory/amount/threshold/**carryover flag**. A user editing only the amount no longer accidentally clears carryover. Uses the same single `onUpsertBudget` revision as creation; no separate mutation path.
- Delete remains distinct and revisioned; edit mode resets on confirmed save/deletion and preserves values on save failure. Current Reports period still owns its month; no duplicate hidden date selection.
- Expanded grid places separate 44px edit/delete targets and keeps mobile progress meter on its own row without truncating the category/subcategory label. Actual rendered QA pending.
- Existing uncommitted browser evidence/test cases may be batched after implementation; **no full CI gate or source PASS claimed** for this newer draft head.

**Counters: Implementations 2/12 completed · Sub-implementations 4/24 completed.**

## Grouped QA evidence (authored, not yet accepted)

- Added isolated synthetic `budget-enhanced` QA fixture with an exactly known July expense/allowance, one August actual expense, one August pending scheduled obligation and a current subcategory taxonomy. No external account or real database record.
- Extended the existing rendered `budget-rules-qa.mjs` to create a subcategory budget, explicitly enable carryover, assert **base 80 + 30 July unused = 110 effective**, distinguish August actual 20 and known pending 30 from posted history, then edit to base 100 **without duplicate budget rows or losing carryover**. Captures desktop, 375×812 mobile and 834×1112 tablet screenshot evidence; retains no-overflow and 40px touch-target assertions.
- Added server taxonomy-ref tests for valid old category aliases, forged ID, cross-parent ID and name-only historic budgets. Existing title/label/readability/a11y requirements were not relaxed.
- This branch's high-churn draft CI may run narrow checks automatically, but **no rendered artifact has been inspected or marked PASS**. Continue only with exact-head batch-level validation, fix gathered failures coherently, and inspect actual resulting screenshots.

**Counters unchanged: Implementations 2/12 completed · Sub-implementations 4/24 completed.**

## One grouped draft TypeScript preflight correction

- Earlier high-churn draft heads 7de2b0a6–266e9ef2 stopped at a shared static contract failure (not browser QA): an older ReviewDecision has no `subcategory`, the internal forecast allocation maps must include their display-label dictionaries, and test-only `createEvent` arguments cannot include direct subcategory metadata. Preserved ReviewDecision's exact established type; used legacy transaction subcategory where applicable and preserved confirmed split-part taxonomy separately.
- New regression fixtures now append optional subcategory to the canonical event **after** the unchanged money/event builder, matching actual application ownership. The finance engine and security constraints remain unchanged.
- Batching these issues together rather than individual source-only reruns. Next head needs type/hygiene/unit/API validation; no test or performance threshold reduced.

**Accepted roadmap progress remains 2/12 · 4/24; #9 subitems unaccepted.**

## Safe independent TypeScript QA fixture fix — 2026-10-22

- The exact #596 draft [CI #39631527187](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39631527187) **failed at hygiene TypeScript** on only two synthetic `src/qa.tsx` lines (416,418): the canonical `createEvent` argument contract has no `subcategory` input. Preserved this accepted canonical finance constructor; moved optional subcategory metadata to the **resulting synthetic `FinanceEvent`**, which natively supports that field. Scheduled synthetic subcategory remains an independent accepted structural field. No production finance event creation, strict budget, code threshold or UI changed.
- This repair unblocks narrow draft static/finance checks but **is not an accepted feature**. #596 is still based on an older 2026-10-21 `develop`, and will require independent semantic reconciliation with the accepted Batch B/C `develop@315304c` and #8/#7 forecast obligations when stable. Current roadmap **8/12 (67%) · 16/24 (67%) formally accepted**, #9 estimated **55% engineering maturity** pending QA and integration. Next: read exact-head draft validate, resolve any remaining full failure class, then live browser QA and owner-branch reconciliation before review.

### Draft source guard reconciliation — 2026-10-22

- After the canonical synthetic fixture fix, exact draft [CI #39806597444](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39806597444) passed hygiene TypeScript and **1,440/1,442** source/finance tests, with two stale source assertions: old category-only budget selector and only one destructive IconButton. Owner-approved #9 now has scope-conditional **full category/subcategory tree** and two distinct shared accessible **Edit/Delete** controls. Aligned assertions with both contracts, retaining the type-safe and shared-component checks; **no threshold relaxed or product behavior reverted**.
- Next: current draft TypeScript/unit preflight, then semantic reconciliation of shared schema with accepted `develop@315304c` and sibling #8/#7 forecast sources before final Ready. Carryover, 375px/834px responsive and failed-save browser evidence still required. Overall roadmap **8/12 · 16/24 accepted**, #9 approximately **55% engineering maturity**.

### Budget schema ownership correction: structural server validator — 2026-10-22

- Exact draft [CI #39807664531](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39807664531) **SUCCESS** after aligning stale source tests to approved category/subcategory budget UI, plus [CodeQL](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39807664594) SUCCESS.
- Pre-integration audit identified a **real validator bug**: new `categoryIdentityId`, `subcategoryIdentityId` and `carryover` checks were accidentally added to `validateLegacyTransaction`, with duplicated `subcategory` validation, while `validateBudget` did not validate those new optional fields. Moved new fields into the correct `validateBudget` owner and preserved all legacy transaction fields. Also explicitly reject category identity on `overall` scope.
- Added direct synthetic `validateFinanceData` boundary tests: valid legacy category budget and valid boolean carryover pass, forged string carryover / non-string category identity / overall identity / invalid child scope fail. These are new tests: **not yet executed at this head**. This corrects the owning backend validation layer without changing any finance history, data migration or UI behavior; security + exact-head CI must validate it.
- Branch remains DRAFT and based on old integration baseline; next semantic integration with accepted `develop@315304c` must preserve B/C event and merchant validators as well as this corrected budget validation. Overall **8/12 · 16/24 accepted**, #9 approximately **60% engineering progress** after isolated source preflight, still unaccepted.

## Verified develop integration and real budget browser QA — 2026-10-22

- Exact branch semantic two-parent integration `0a26de81` combined #9-only delta with accepted `develop@315304c` after PRs #590/#592. Preserved every newer B/C finance event, revision, RLS, linked-fee, counterparty and source category contract; only budget fields/validations and Reports projection details were surgically composed into current shared owners. The Reports future/projection semantics now distinguish actually posted usage from **known unpaid due commitments**, rather than using unsupported automatic extrapolation as committed spending.
- After integration exact draft [CI #39810784001](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39810784001) **SUCCESS**, [CodeQL #39810783806](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39810783806) **SUCCESS**. This proves static, unit/security source/bundle gates but not the rendered browser.
- Created temporary draft-only focused browser workflow `.github/workflows/588-budget-focused-qa.yml` that runs existing `scripts/budget-rules-qa.mjs` end to end against synthetic local QA fixtures in primary Chromium, covering known existing Reports/Rules/Savings interactions plus new category/subcategory rollover, 375px phone, 834px tablet, edit without carryover reset, no double count and rejected save. Strict native Chromium startup preflight retries only bootstrap failures; never changes assertion thresholds or permits fallback. **Remove this temporary workflow from final Ready review head**, because the browser suite already belongs to standard `scripts/run-rendered-qa.mjs`.
- **Must inspect actual evidence** and run final Ready WebKit, Windows, Lighthouse, CodeQL and real Stack as appropriate before protected develop merge. Until then #9 **≈70% technical maturity, 0/2 accepted**, roadmap **Implementations 8/12 · Sub-implementations 16/24 accepted (67%)**, estimated roadmap engineering maturity ≈88% (provisional). No main/Production/Android action.
