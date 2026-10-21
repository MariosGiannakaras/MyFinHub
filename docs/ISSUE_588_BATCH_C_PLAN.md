# #588 Batch C — receipt intelligence and counterparties (active draft plan)

**Owner roadmap:** #588 features **#6 stable merchants/beneficiaries** and **#3 detailed local receipt OCR and owner-reviewed purchase matching**. **Integration baseline:** `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2` (Batch A merged). **Task branch:** `feat/588-receipt-counterparties-batch-c`; not dependent on or owner of other task branches. Date: 2026-10-21.

**Accepted roadmap progress:** **Implementations 2/12 completed · Sub-implementations 4/24 completed**. **Batch C:** 0/2 implementations · 0/4 sub-implementations accepted. Do not mark partial implementations accepted.

## Live concurrency and precedence

- PR #590 (`feat/588-canonical-accounting-batch-b`) owns canonical finance events, credit statements, reconciliation, fee links, lending, database migrations and shared money workflow while review checks run; **do not touch or compete on those files**. C must reconcile with B after safe integration.
- PR #591 (`feat/588-forecast-scenarios-batch-d`) owns forecast/scenario calculations; do not overlap.
- Batch C initial files `src/lib/receiptParser.ts`, `src/lib/receiptDrafts.ts`, receipt-only tests and the ReceiptInbox review surface are isolated from B/D. Persist unposted OCR drafts only to the existing local IndexedDB. No private image raw data, credentials or OCR text in Git.
- `AGENTS.md`, durable owner issue #266, UX standards, owner approval issue #588 and branch-local checkpoint govern implementation. Protect single-owner AAL2/RLS, revision/history, exactly-once spending and privacy-first local OCR.

## Existing architecture (verified on baseline)

- `src/lib/receiptOcr.ts`: Tesseract worker, Greek+English fully local served assets, cancel/timeout and processed image. `src/lib/receiptImage.ts`: signature/size/dimension checks. `src/lib/receiptDrafts.ts`: local IndexedDB with 30 draft/60 MB bounds.
- `src/lib/receiptParser.ts`: merchant/date/currency and total candidate parser with confidence; no line items before this batch.
- `src/components/ReceiptInbox.tsx`: owner edits proposal, normalized EUR total, full `CategorySelectInput`; `ReceiptAwareQuickAdd.tsx` deletes local receipt only after actual finance-save success.
- Never auto-book a receipt. Matching candidates to existing transactions must be advisory, with owner choosing to associate/reuse or deliberately create a new event. Category suggestions must use complete live taxonomy, not hardcoded subsets.

## Coherent implementation slices

### C1 — receipt OCR line items and EUR conservation (#3, partial)
- [ ] Recognize candidate description + exact two-decimal amount per OCR line in Greek/English, exclude grand total/VAT/cash/change/date/card/POS/phone, cap bounded input/count. No inferred discounts or tax booking.
- [ ] Surface editable owner-reviewed lines, category/subcategory tree and balance indicator against EUR grand total; preserve historical drafts and explicit correction controls. Unknown/foreign currency never silently converts.
- [ ] Support owner-approved category split via the canonical one-parent `split` event only after confirming no match to existing purchase and ensuring independent draft persistence receipt. Do not duplicate parent expense on creation.
- [ ] Test OCR confidence, 0.01 rounding, different currencies, discounts, line quantities, corrupt data, mobile/dark/large text/keyboard, OCR aborted and failed durable save.

### C2 — stable counterparties, reviewed association (#6, partial)
- [ ] Introduce opt-in stable merchant/beneficiary identity with mutable display name and immutable ID while preserving free-form historic notes; do not automatically reclassify or rewrite old transactions.
- [ ] Deterministic normalized candidate matching to reviewed existing transaction notes/dates/amount/currency; deduplicate by event IDs, cap candidates; **never** auto-associate, auto-delete or create transaction.
- [ ] Category suggestions from repeated reviewed merchant signals and complete live taxonomy; expose review/skip actions without bank/receipt data leaving device without owner command.
- [ ] Add server/finance data contract and appropriate forward-only migration only once B has integrated common schema changes; test revision conflicts, changes/undo/redos, import/export and RLS.

## Current progress, validation, next action

Initial item parsing and local draft metadata underway; no item-to-ledger mutation. Narrow Vitest/TS/hygiene and privacy guards on draft while building. For feature acceptance require rendered desktop/tablet/mobile Light/Dark source and real synthetic artifacts manually inspected plus appropriate CI/CodeQL/Windows/DB/Real Stack/performance gates. Keep draft; never merge pending/failing gates. Final roadmap 216-image Visual QA belongs at the owner-approved final boundary. No Production/main/Android actions.

**Exact next action:** run narrow parser tests on first draft commit; wire item review UI to existing ReceiptInbox without parallel form primitives, and add a no-posting existing-purchase matching candidate helper. Before any persisted finance-event schema edit, check live merge status of B and reconcile common types deliberately. Keep issue #588 progress unchanged until accepted.


### C1 non-posting purchase-candidate checkpoint — 2026-10-21

- Added a **read-only** helper `src/lib/receiptPurchaseMatches.ts` for advisory existing-purchase candidates, using canonical posted `expense`/`card_purchase`/expense-only `split` events and effective (overridden/non-deleted/reviewed) legacy purchases. Requires a valid calendar date within three days, **exact positive EUR cents** and no recognized non-EUR source. Matches are source-scoped, sorted deterministically, limited to 12, with optional normalized merchant agreement and safe truncated note. **No finance mutation, automatic receipt association, history rewrite or uploaded OCR text**.
- Added five synthetic tests for EUR/date boundaries, merchant/amount/date, non-expense exclusion, legacy overrides/tombstones/review semantics, split parts, determinism, and read-only behavior. **Not yet run** (draft branch). This is backend-independent proposal infrastructure, **not completed #3/#6 acceptance**.
- Next: check draft CI source/TS/Vitest; then integrate optional owner-visible candidate review and editable OCR item proposals in the existing `ReceiptInbox`, with complete taxonomy and EUR total balancing. No shared finance-schema changes before upstream #590 reconciliation. Overall counters unchanged **Implementations 2/12 completed · Sub-implementations 4/24 completed**; Batch C 0/2 · 0/4 accepted.
