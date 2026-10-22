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


### C1 local advisory review wiring — 2026-10-21

- Parser helper initial draft CI [39674211414](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39674211414) passed hygiene after an unused type-export repair, but its five new exact-cents tests revealed **escaped regex source** incorrectly rejecting all ISO dates. Fixed date and Unicode-normalization regexes at `fbbdc5a`; not yet tested on that head.
- `ReceiptInbox` now derives local duplicate-purchase hints **from the currently reviewed date/merchant/EUR amount**, requiring explicit corrected EUR total before including an OCR foreign-currency proposal. Its accessible advisory surface names the existing record, date, amount and source while explaining no automatic matching/booking; it never mutates finance data or silently drops the local draft. New source contract checks the wiring, conservative max-12 constraint and presentation.
- Item-level editing/canonical split creation and stable counterparty association are **still unimplemented**; do not mark the two Batch C features accepted. Next: draft CI narrow source, exact-cent tests and rendered QA including responsive evidence/owner actions. Follow the upstream canonical finance integration boundary before any event-schema write.

### C1 owner-editable OCR item review checkpoint — 2026-10-22

- Added private `src/lib/receiptItemReview.ts`: exact positive integer-cent normalization, 40-line cap, duplicate-ID/empty-description/unsafe-number rejection, and explicit item sum versus receipt grand total. Five behavior regression boundaries are covered by focused tests; **execution pending** on this draft head.
- Extended existing `ReceiptInbox` rather than creating a parallel editor: editable OCR item descriptions, per-line MoneyInput, complete live `CategorySelectInput` taxonomy, add/remove, saved locally with the existing `saveReceiptProposal` and read-only difference indicator. Invalid line inputs block saving corrections and applying the proposal. Currency provenance `itemsCurrency` stays attached after manually correcting a foreign grand total; foreign OCR amounts are explicitly excluded from EUR item balance/auto-splits. No finance event is constructed or imported; only previously approved Quick Entry flow can save.
- Need actual rendered mobile/tablet/desktop and keyboard/theme evidence, Item/Currency persistence and failure-flow QA before marking either #3 or #6 accepted. Owner-approved split booking and stable beneficiary identities remain outstanding. **Implementations 2/12 completed · Sub-implementations 4/24 completed**; Batch C remains 0/2 · 0/4 accepted.

### Draft TS preflight of OCR item review — 2026-10-22
- Draft [CI #39743481042](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39743481042) halted at TypeScript guard: the new item balance JSX dereferenced nullable `lineReview` within an optional-chain null comparison. Used explicit `lineReview&&lineReview.totalCents!==null` narrowing in both displayed grand-total and difference paths; item arithmetic/validation and EUR thresholds are unchanged. New full draft source/unit/build validation pending. Continue to preserve the local-only/no-posting boundary; acceptance counters unchanged.

### C1 reviewed-item source regression alignment — 2026-10-22
- Draft [CI #39743709932](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39743709932): 1,378/1,381 tests passed; only three source guards were stale after two real shared Button additions and a memo callback syntax variant. Updated expected Button counts (12 total: primary 2, secondary 7, ghost 3), retained action/receipt security assertions, locked invalid-item disable condition, and aligned the item memo guard with the actual expression. No acceptance gates weakened.
- Hardened draft compatibility: if no OCR items exist, saving the owner-reviewed proposal retains `items` and `itemsBalanced` as absent instead of manufacturing `[]` and false. Full draft CI remains required on the changed head. Roadmap counters **Implementations 2/12 · Sub-implementations 4/24** unchanged; no merge/deploy.

### C1 focused rendered owner-item flow checkpoint — 2026-10-22
- The previous draft head `397b4f6` passed [CI #39744050028](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39744050028) and [CodeQL #39744050042](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39744050042) for 1,381 source/unit tests, TS/build and hygiene. No rendered acceptance claimed.
- Extended the existing private receipt Chromium QA to use **real Add Item, shared text/money controls, invalid 4.251 sub-cent blocking, correction to exact 20.25+4.25 EUR, full live taxonomy presence, 375x812 mobile geometry, IndexedDB read-after-save and USD original-currency provenance**. New screenshots `receipt-local-reviewed-items-desktop.png` and `receipt-local-reviewed-items-mobile.png` must be captured and directly inspected from a later Ready run; currently **unexecuted**. This QA does not touch DB finance, canonical event mutation, or production. Existing receipt capture, offline OCR, failure, foreign correction, Quick Entry and saved-only draft deletion remain compulsory.
- Next: draft CI source/unit/parser preflight, then focused browser QA/visual evidence (full review when coherent) and assess remaining C1 canonical split. Batch C still **0/2 implementations · 0/4 sub-implementations accepted**; overall roadmap **2/12 · 4/24**.


### Latest developed integration baseline — 2026-10-22

- Accepted upstream **Batch B PR #590 merged** on exact `develop@3527ff7822f844ff619f065decb64e96c9fd65eb`, following successful strict Chromium QA, isolated Supabase E2E, CodeQL, WebKit, Lighthouse, Windows and protected gates. This advances the independent owner roadmap to **Implementations 6/12 completed · Sub-implementations 12/24 completed** (6 full features remain). C remains **0/2 implementations · 0/4 sub-implementations accepted** until its independent owner-reviewed OCR split and counterparty identity end-to-end acceptance.
- B/CI/#597 changes from original C baseline have **no overlapping file path** with C's 15 tracked modified/addition paths, so current `develop` can be merged into this draft using its complete tree plus only the verified C file delta. This preserves B's canonical event/validation/credit changes and all newer develop design/CI rules; no released feature or visual history is overwritten.
- The existing reviewed purchase matching remains advisory and non-posting. Its proposed ledger split must reuse the integrated canonical one-event `split` contract instead of inventing a distinct purchase or double-charging. Full per-line audit/privacy and mobile/browser screenshots are still pending. **Do not mark a feature complete on this integration merge.**
- Next: exact-head draft TypeScript/hygiene/Vitest/build/bundle-budget; resolve any real new-baseline integration faults. Run isolated focused UI/browser QA for OCR item line editor and directly inspect mobile/tablet/desktop evidence; then implement confirmed balanced split association and stable counterparty identity without bypassing revision/RLS/history.

### Owner-reviewed single-event receipt split handoff — 2026-10-22
- Added `receiptSplitParts`, a pure gate requiring 2–40 exact positive EUR-cent lines, identical sum and total, unchanged original EUR item currency, nonduplicated item IDs, descriptions and full current expense category/subcategory tree membership. Recheck on receipt-aware QuickAdd application; no OCR line ever posts directly.
- Owner explicitly chooses `Χρήση ως επιμερισμένη δαπάνη` (or the existing ordinary Quick Entry). When matching existing purchase candidates are displayed, the owner must additionally confirm this is a different purchase; absence of that check disables both handoffs. Shared QuickAdd receives reviewed `SplitPart[]` and still requires the ordinary explicit durable save to create only one canonical `split` expense, preserving Undo/Redo, conflict, history, single-owner AAL2/RLS and saved-only receipt cleanup.
- **Draft implementation, not accepted:** exact-head source/unit/build, responsive Chromium including split failure/duplicate/keyboard, Real Stack, Windows/CodeQL and direct screenshot review still required. Counterparty identity remains C2. Overall **Implementations 6/12 · Sub-implementations 12/24**, C **0/2 · 0/4 accepted**.

### Split source/preflight follow-up (2026-10-22)
- Exact new draft [CI #39752588192](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39752588192) FAIL at the first TypeScript hygiene pass: `ReceiptInbox.tsx:415` used `reviewed.items` without nullable narrowing on the conditional split button. Corrected to `reviewed?.items`. Aligned two preexisting strict source assertions to the now extended review helper import and exact persisted owner-selected `reviewedSplit` proposal. These assertions retain the same IndexedDB-before-finance/save-after-receipt order and guard that OCR itself never posts events. The 2026-10-22 prior integrated draft CI #39751053984 passed **1,416/1,416** tests and 526.5 KiB main JS before the new split implementation, but does **not** validate this new head. Need new draft TS/unit/build check; never claim full feature acceptance yet. Overall **6/12 · 12/24**, C **0/2 · 0/4 accepted**.
