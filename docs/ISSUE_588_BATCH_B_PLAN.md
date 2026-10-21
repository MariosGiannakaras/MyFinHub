# Issue #588 — Batch B canonical accounting extension (active working plan)

**Baseline:** `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2` following successfully merged Batch A PR #589. **Active implementation branch:** `feat/588-canonical-accounting-batch-b`. **Issue:** [#588](https://github.com/MariosGiannakaras/MyFinHub/issues/588). **Scope owner:** this branch owns #4/#5/#12/#2 only; no Android repository or Production/main changes.

**Accepted roadmap progress:** **Implementations 2/12 completed · Sub-implementations 4/24 completed** (#10/#11 merged). **Batch B accepted:** **0/4 implementations · 0/8 sub-implementations**; *planning and a branch are not feature completion*.

## Owner's 2026-10-21 execution acceleration

The owner authorizes **pipelining the next safe independent work while full CI is running**, instead of waiting at routine batch boundaries. Build coherent logical slices and keep high-churn PRs draft. It is safe to prepare other nonoverlapping batch plans/fixtures during validation; **do not concurrently mutate overlapping canonical finance files or combine unreviewed changes from independent branches**. Never merge a failing/pending exact head. Do not auto-deploy `main`. This supersedes the earlier task-local instruction to stop all next-batch work after Batch A; repository security/release protections remain in force.

## Confirmed starting evidence

- All Batch A postmerge develop CI (run 39493329514), CodeQL (39493329545), Windows Desktop (39493329580), Windows Clean Launch (39493329594) and Windows First Run (39493329612) succeeded on the exact merge SHA above.
- Only other open PRs when starting Batch B are Dependabot #585/#586/#587, separately owned. No concurrent active #588 implementation PR discovered.
- Domain `src/types.ts` defines 12 `EventKind` values and canonical `FinanceEvent {amount,legs,receivableDelta,creditDelta,parts,cardId}`. `createEvent` in `src/lib/domain.ts` creates one logical event, including non-spending reconciliation and loan/credit payments. `flowImpactEvent` determines exactly-once reporting; `accountBalances` applies legs; `netWorth` combines balances, credit liability and receivables.
- `src/lib/ledgerFoundations.ts` has robust integer-cent transfer and split builders, but existing split distributes **categories on one account**, not **funding on multiple accounts**. Do not reuse the category split type as payment legs without an explicit contract.
- `server/validation.ts` enumerates event kinds, `server/financeSemanticValidation.ts` checks matching amounts/legs/deltas, and `supabase/migrations/20260930122054_relational_finance_ledger_cutover.sql` has a database check restricting event kinds. **Any new event kind requires coordinated server and versioned database migration plus a real DB/CI boundary**, not a frontend-only type change.
- Credit ownership/statements in `src/lib/cards.ts` and credit pages currently filter `card_purchase` / `card_payment`; any mixed cash+credit purchase must affect only its actual credit portion and correct card statement/archival checks. Never count the full purchase as card debt or as two expenses.
- `src/lib/lending.ts` uses seeded `outstanding` as a legacy opening fact; `lendingHistory` currently synthesizes a running timeline from dated seed entries. Historical as-of must not invent an opening balance from entries whose provenance predates the available snapshot. Manual write-offs must be a new auditable noncash action, never an income or expense and never silent seed modification.
- `QuickAdd` currently saves a single event via `onCreate`; linked transfer+fee creation must be **atomic in one revisioned persisted finance write** (or one canonical compound event) rather than two unchecked sequential network saves. Editing/deletion/Do–Undo–Redo should affect the coherent logical operation.
- Existing reconciliation QuickAdd computes correction against previous amount when editing. Batch B #2 must compare user-verified balances or statement figures to canonical as-of ledger without importing external files or touching unreviewed transactions.

## Coherent implementation slices — ordered by shared data contracts

### B1 — #4 mixed-source purchase contract and balanced legs
- [ ] Establish one economic purchase identifier, funding allocation in integer cents, distinct account/card identities, and explicit debt-only credit leg semantics.
- [ ] Wire canonical builder, frontend/backend validation, DB migration where required, reports/categories, account balances, credit statements/card archive, controlled UI and persisted revision workflow.
- [ ] Test 0.01 rounding, duplicate funding, mismatched total, existing historical payments, edit/delete and Do–Undo–Redo, server tampering and synthetic read-after-save.
- **Acceptance:** both #4 roadmap subitems only after integrated real rendered/DB proof; not yet complete.

### B2 — #5 linked fees (same finance contract boundary)
- [ ] Define principal transaction reference and linked distinct fee expense, with commission charged once to correct account; internal transfer principal remains non-spending.
- [ ] Commit principal/fee atomically; protect missing links, amount/date edits, refunds, reconciliation, deletion and reversibility. If a new event type is avoidable, prefer existing canonical expense + stable linkage with server-side referential validation.
- **Acceptance:** both #5 roadmap subitems only after integrated tests/UI.

### B3 — #12 personal lending settlement/write-offs
- [ ] Add owner-confirmed dated installment/recovery plan **without booking future cash**; booked repayment reduces receivable, not income. Partial write-off is a dated noncash receivable adjustment with audit metadata and no bank account leg.
- [ ] Verify per-person available outstanding as-of entry date, historical net worth, seeded legacy provenance, Do–Undo–Redo and failed-save; negative outstanding and over-writeoff blocked, with server validation of full dataset.
- **Acceptance:** both #12 roadmap subitems only after comprehensive proofs.

### B4 — #2 manual bank reconciliation
- [ ] Provide explicit account/date/verifiable statement-balance comparison, unmatched candidate display against canonical movements and readable difference. Do not parse or import bank files, connect to banks or guess matches.
- [ ] Require confirmation per correction through the existing non-spending reconciliation kind; protect duplicate adjustments, editing against balance without old leg, as-of/revision/conflicts, reports and Undo/Redo.
- **Acceptance:** both #2 roadmap subitems only after comprehensive proofs.

## Validation and PR batching

1. Use narrow source/finance tests while the draft PR is evolving; avoid CI per trivial edit. Preserve real money histories, owner+AAL2/RLS, revision locks and true pending/success/failure save-progress.
2. For event kind/schema migrations, first run a higher-risk intermediate security/DB boundary before building UI on an unverified contract.
3. Finish one coherent review head, run all required CI/security/real-stack/Chromium responsive Light/Dark/WebKit/Lighthouse/Windows gates and directly inspect screenshots. Do not weaken any limits.
4. Squash merge to `develop` only with required gates green; verify postmerge runs; Batch C/D planning may be done **while CI is running** if branches/file ownership do not overlap.
5. After every meaningful accepted checkpoint, synchronize issue #588 checkboxes, this plan and the PR. Never increase counters for partial code or exploratory documents.

## Exact next action

Inspect relational migration constraints/persistence validation and all credit-event consumers in detail; specify the mixed-funding purchase contract and database migration boundary first. Then add focused red/green money-conservation tests and implementation together as the first coherent slice. Review broader UI standards and source screenshots before editing shared UI, with sibling blast-radius QA. The branch currently has **no accepted Batch B implementation**. Do not start alternative incompatible ledger models concurrently.

## Safety

No Bank Excel/CSV/OFX import, third-party bank connector, automatic Euribor, card interest posting, destructive historical migration, Production or Android changes. No fake PASS for tests not executed. Current counters remain 2/12 · 4/24.

## B4 implementation underway — 2026-10-21

- Added pure as-of manual statement review model with 7-day event/legacy candidates, optional known statement transaction amount, difference in EUR cents and explicit duplicate/no-op/review confirmation checks.
- Existing QuickAdd reconciliation now computes canonical date-specific balance excluding an edited event rather than current-day balance; UI surfaces evidence and requires a verified checkbox. Created narrow finance regressions. Full validation pending (draft head), B4 **not yet accepted**; no checklist/counter increments.
- Ensure rendered QA exercises the new dialog and errors; inspect sibling shared controls and security/history before acceptance. Continue B1/B2/B3 on this single finance owner after safe preflight.

### Draft preflight result on 6cea2675
- `CI` draft validate stopped at TypeScript hygiene TS2741: missing required `id` on the new duplicate-warning `FormError`. Fixed as one minor correctness batch along with an end-to-end Chromium rendered QA addition to the existing ledger foundations suite (review preview, explicit confirmation, saved event, duplicate guard and screenshot). Previous draft CI is **FAIL** and not acceptance evidence; do not mark green until rerun on the exact newer head.

## B2 shared contract in progress — 2026-10-21
- Added optional `feeForEventId` to a standalone expense event referencing an internal transfer, withdrawal or card payment. Fee has the real outgoing account and exact EUR cents, while the principal remains non-spending. Backend validates link existence, date/account consistency and uniqueness. No new SQL event kind (existing relational `payload` persists linkage); full real-stack gate remains necessary before acceptance.
- Introduced one immutable reducer `replaceLinkedTransferWithFee`, with one update/history revision rather than sequential saves, stable IDs on edits and atomic removal. Narrow finance/tamper regression tests added. UI/wiring and deletion/history/QA still pending; **do not check #5 complete**.

### B2 UI and persistence integration
- Transfer QuickAdd now records an optional linked commission with the shared MoneyInput, live expense-category choices and one `finance.updateDurably` contract call. QA uses one Do/Undo point; fee edit resolves the parent, and parent delete cascades to fees. This is a draft partial slice; card-payment fee UI, comprehensive browser and failure cases still require acceptance evidence.

### Draft TypeScript check at a881e246
- Read failed draft TypeScript hygiene: the receipt-aware QuickAdd wrapper did not yet forward the new linked transfer callback (TS2322 in ContextualQuickAdd). The owning shared wrapper now accepts and forwards it unchanged while continuing to clean receipt drafts **only after a successful finance save**. This is still an unaccepted draft validation cycle.

### B2 rendered regression added
- Existing `ledger-foundations-qa.mjs` now checks optional transfer fee creation, distinct report expense, one-step Undo/Redo group restoration and desktop screenshot. One-file source contract locks that both App and synthetic QA use the same atomic state recipe and ReceiptAwareQuickAdd forwards the callback. Browser execution/visual artifact remain **pending review-head QA**, not claimed PASS.

### Draft preflight failure class — unused exports
- Draft `validate` at `515ddaca` passed TS symbol checks but caught two unconsumed exported TypeScript-only interfaces from the reconciliation utility. Kept them file-private and bounded displayed candidate note length for responsive surfaces. Also rejected sub-cent fee inputs instead of rounding them silently. These are small repairs batched with implementation preflight; no accepted progress increment.

### Draft QA/hygiene root-cause correction
- On `0bd8e624` draft `validate`, TypeScript symbols and exports were clean, but formatting hygiene caught trailing whitespace at ledger browser QA line 61. The same line also contained an unterminated embedded Chromium runtime function string, which source formatting could not detect. Fixed **both** together before any full browser QA review-head run; do not claim rendered PASS without runtime evidence.

## B1 funding-conservation preflight (not persisted yet)
- Added pure multi-source purchase allocation contract `src/lib/multiFunding.ts`: exact safe integer-cents totals, distinct real accounts, one verified active credit card, net negative legs and **credit liability equal only to the credit-funded share** (never the whole economic purchase). New source tests cover cash+bank+credit, cash+bank, 0.1+0.2 precision, duplicates, stale cards, missing accounts and subcent rejection.
- No new `EventKind`, database write, card statement mutation, or visual control has been enabled at this stage. The B1 acceptance gates still require full canonical event contract and coordinated SQL migration, server credit validation, statements/card archive/reporting/UI and rendered security evidence. Do not misreport isolated allocation proof as completed #4.

### B1 integration dependency inventory
- Credit financial consumers requiring integration before any persisted mixed-source event: `src/lib/cards.ts` (debt/archival), `src/lib/creditStatements.ts` (cycle grouping, linked events, as-of totals), `src/pages/CreditCardPage.tsx` (history amount), `server/cardStateValidation.ts` (card/statement references), `src/lib/domain.ts` (one expense and correct credit legs), `src/pages/TransactionsPage.tsx` and `CardsPage.tsx` (avoid duplicate listing), `server/financeSemanticValidation.ts` plus `server/validation.ts`, and the relational SQL `event_kind` check (new forward-only migration, not editing old migration).
- The funding helper is **not a production transaction kind** and cannot itself write to finance history. Future event/statement UI must explicitly use *only the credit-funded share* for card debt and statements; parent full price is counted once as expense. Do not create multiple independent purchases or pair unmatched cash and credit events.
- Corrected the pure contract regression arithmetic to sum money amounts first, then convert the final aggregate to cents rather than repeatedly scaling an already-cent accumulator.

## B3 safe projection preflight (not persisted)
- Introduced `src/lib/lendingPlans.ts` owner-specified future settlement projection with exact cent-rounding remainder, month-end due dates, bounded installments and outstanding checks as-of selected date. New tests explicitly verify zero future cash entries/phantom report income and unchanged receivable/net worth. It creates **no actual finance event**, no write-off, and no saved repayment plan at this stage; B3 #12 is still unaccepted until durable owner confirmation, partial write-off kind/server/SQL and full History/Undo/Redo are integrated.

### B1 domain event foundation
- Persist multi-funding as one existing `expense` parent with optional exact-cent `funding` and negative ledger legs including only the credit-funded share. The existing SQL event-kind check stays valid; no destructive migration or new event kind is needed. Server input and semantic validators verify distinct funding sources, exact EUR-cent total, debit legs, first real account and credit delta. Credit/card statement owners must integrate before real UI uses this feature; no user-facing enablement yet.

### B1 credit consumers ready for financial integration
- Card debt and permanent deletion now include mixed-funded expense only for its credit liability portion. Statement grouping, persisted cycle attachment, as-of purchase/payment totals and unlinked history likewise count only that credit portion, not full economic spend. Credit page purchase/statement views show the funded share. `server/cardStateValidation.ts` permits an expense carrying a verified credit funding source and preserves card/statement ownership checks. QA/end-to-end proof and funding UI are still pending, no #4 acceptance yet.

### B1 shared entry UI wired
- Generic expense QuickAdd now exposes opt-in multi-source funding with real cash/bank and active credit selection, per-source MoneyInput EUR cents, total preview and bounded add/remove controls; existing ordinary expense remains unchanged. Uses the canonical `createMultiSourcePurchaseEvent` via dynamic import to respect eager bundle budget. Editing recognizes the persisted `funding` parts. Source-level and synthetic rendered/Real Stack contract checks still needed before this can be called accepted.

### B1 system-level regression proof
- Added complete FinanceData synthetic single-event integration tests for exact 100 EUR expense from cash/bank/credit, net worth, category once, credit liability of only 60 EUR, an as-of credit statement of 60 EUR, account-only multi-funding and cross-validator tamper rejection. Real relational DB read/write and browser QA remain untested.

### Draft source-contract regression reconciliation (2026-10-21)
- Exact draft CI `706e48b2` passed finance source/data checks but 3 historical source assertions failed: generic QuickAdd now has one additional shared ghost button and one additional raw domain remove button; card purchase history must show `creditPurchaseAmount(event)` while ordinary card payments remain `event.amount`. Reconciled source guards to the expanded controls and credit liability semantics while retaining existing accessibility/shared-primitive checks and the historical non-animated row restriction. Do not mark review gates PASS until the new exact head completes.

### Credit-liability semantic hardening — draft
- Current branch head moved concurrently with a source-test assertion fix; that existing change was preserved. New feature-level integrity test rejects a mixed-funded card expense with missing credit delta, since legacy `validateOptionalDelta` allows optional fields for older events. Direct card debt is computed from the explicit financed funding portion, not optional client-supplied `creditDelta`, while backend still requires validated matching delta on new funded credit purchases. Any forged omission must fail server semantic validation without changing reporting/archival liability.

### B1 browser evidence and QA parity — 2026-10-21
- Aligned synthetic QA event creation with the real App's `prepareCreditStatementEvent` reducer, so statement assignment is tested rather than omitted in the fixture. Expanded the existing ledger rendered QA to opt into an actual two-source 100 EUR purchase (bank 40 + QA Visa 60), persist one event, verify card history/statement against only the credit share, and capture desktop evidence for both transactions/card UI. Controls are driven through existing owned select and MoneyInput. Browser execution and screenshot inspection remain pending until review validation.

### B2 credit payment integration (2026-10-21)
- Existing ContextualQuickAdd credit-card repayment now offers a **separate optional real commission**, with MoneyInput and the live expense taxonomy; principal remains a non-expense `card_payment`. A populated fee uses the same `onCreateLinkedTransfer` single `finance.updateDurably` path already used for transfer fees; failed saves keep the payment modal open. Card-payment fee builder regression asserts payer-account debit, fee-only expense and linked semantics. Statement preview now includes mixed-funded purchases with only their credit amount.
- Card-payment commission is not yet counted accepted. Browser payment-fee screenshot, failed receipt, server roundtrip and review-head gates remain pending.

### Draft shared source contract follow-up
- CI on `8de35d12`: 1,377/1,378 tests passed, single source-only budget/rules assertion was stale after QA's statement-aware reducer was renamed from `nextEvent` to `ruledEvent`. Updated the regression to verify the **same rule behavior** and now also require the real `prepareCreditStatementEvent` step. No weakened predicate, production accounting untouched by this repair. Review-head CI remains required.

### B3 auditable writeoff ledger and DB boundary (2026-10-21)
- Introduced `lending_writeoff` as an auditable noncash event kind: mandatory person, empty legs, negative receivable delta, no bank account and no reported income/expense; preserve historical seed baseline unchanged. The forward-only versioned `supabase/migrations/20261021091500_add_lending_writeoff_event_kind.sql` expands the relational `event_kind` CHECK without rewriting finance rows, RLS or audit records.
- Full dataset server semantics now reject a writeoff that would overdraw the person's receivable **as of its date**, after accounting for earlier/same-day payments. Historical UI maps it to the existing `forgiven` action. Focused money-conservation, tamper, date and Undo regressions included. Requires intermediate DB/security gate; user-confirmation UI/persisted plan still pending. **No Batch B acceptance**.

### B3 migration ledger/reconciliation preflight
- The new `20261021091500_add_lending_writeoff_event_kind.sql` was added to `releasePending` in the authoritative production migration source test; it is **not** production-applied and must not be labeled as such. The concurrent QA transaction-rule guard contained doubled regex backslashes (matching literal \\s rather than whitespace) after the QA reducer parity change; corrected to preserve identical actual first-match rule assertions as production App.

### B3 owner-confirmed user workflow — 2026-10-21
- Reused ContextualQuickAdd's real `onCreate` durable persistence for `lending_writeoff`, with amount, exact selected-date outstanding check, noncash semantics, explanatory preview, explicit owner checkbox and failure-keeps-dialog-open path. Added context action + accessible desktop/mobile actions from LendingPage without a separate page-local save mechanism. Source regression covers both routes, confirmation gate and single-save contract.
- Draft contract/unit CI and migration syntax must be revalidated on the new head; the required SQL/Real Stack DB and rendered responsive/interaction evidence have **not** yet run. Plan persistence/settlement UX is still pending. Accepted counters remain **2/12 · 4/24**.

### B3 functional security and UI regression corrections
- Draft `f792aeb9` CI ran 1,381/1,382 source/finance tests, with only historical `LendingPage` shared Button counts now stale after two new desktop/mobile writeoff shared actions. Updated the guard to 13 Buttons (3 primary, 7 secondary, 3 ghost) **and** asserted two actual contextual writeoff triggers. No quality control removed.
- Explicit confirmation now resets on amount/person/date edits; future-dated noncash writeoffs are rejected as actual, not planned events. Full-data semantic validation now also detects repayment dates **after** a writeoff that would make its remaining receivable negative, not merely overdrafts on the writeoff's own day. Added regression. Draft CI/SQL/real-stack still required before acceptance.

### B3 confirmation/reset source preflight
- `cec07211` draft CI passed hygiene and most tests but two longstanding contextual payment source guards expected the shared MoneyInput to retain the direct `onValueChange={setAmount}` prop. Preserved that exact shared binding and strengthened the writeoff checkbox with a captured, explicitly confirmed amount: changing the amount immediately invalidates the prior confirmation both visually and at submit, without altering loan/payment input semantics. Domain-specific B3 source regression updated to require the snapshot comparison.

### B3 confirmed settlement-plan finance state contract
- Added optional `state.lendingPlans` storing one owner-confirmed current plan per person (as-of baseline date, first due date, exact amount, count and frequency, confirmation timestamp). `withConfirmedLendingPlan` produces one immutable finance-state revision, preserves a stable plan ID on changes, and requires explicit consent. It never creates events or counted future receipts.
- Backend structural validation verifies cent precision, bounds and duplicate person/IDs on all mutable document saves/imports. The relational database's residual JSON state carries this non-transaction array, so no new SQL ledger table is required. Focused tests check no financial posting, stable edit and tampered plan rejection. **Still awaiting UI, actual revision receipt, Real Stack roundtrip and final rendered QA.** Counters unchanged.

### B3 confirmed plan UI and exact save receipts (2026-10-21)
- Added `LendingSettlementDialog` using the existing shared DialogShell/AppDateInput/MoneyInput/AppTextInput/AppSelectInput/Button primitives. It previews nonposting installment dates/cent totals, explains the difference from cash collection, resets confirmation on every input change, and keeps the dialog/error visible when durable save fails.
- LendingPage now offers a distinct **Πρόγραμμα επιστροφής** action, and shows the stored plan next to the actual remaining receivable without reducing it. Both App and synthetic QA route plan edits through one revisioned save recipe (`finance.updateDurably` in App and one Undo/Redo snapshot in QA); API/real-stack rendered proof still pending. No generated or automatically booked income.
