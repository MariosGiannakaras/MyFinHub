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
