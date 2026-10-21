# #588 — Variable recurring obligations (#8), independent D2 draft
**Branch:** `feat/588-variable-recurring-batch-d2` based on `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2`. #591 owns #7 forecast scenarios and PlanningPage; #590 owns canonical finance and migrations, #592 owns receipts. This branch owns only recurring amount model, server validation, recurrence editor and tests. No cross-branch shared finance edits.
**Accepted roadmap:** Implementations 2/12 completed · Sub-implementations 4/24 completed. **This branch: 0/1 and 0/2 accepted.**

## Contract
Existing `RecurringItem.amount` stays fixed unless `amountMode='variable'`, in which case it is an **owner-entered estimate**, not a bank charge. Optional `estimateMin` and `estimateMax` must both exist and enclose the estimate. Exact EUR cents. Actual payments remain a single linked canonical expense event and may differ; no phantom future income or expense.
`recurrenceUnit` (month/year), `recurrenceInterval`, anchors, early-fulfillment suppression and as-of historical records remain unchanged.
A forecast projection must label variable amounts estimated. Integrate with #591 after upstream merges, not while its head is validated.

## Implementation checklist
- [ ] Pure variable-amount validation, server structural guards, source tests and actual linked payment evidence
- [ ] Opt-in editor via shared select/money controls, responsive amount labeling and actual-vs-estimate display (implementation drafted, awaiting rendered QA)
- [ ] Forecast/history/fulfillment/report contract, delayed integration with #591 and #590
- [ ] Narrow tests followed by full exact-head rendered Light/Dark desktop/mobile/tablet, security/DB, cross-engine, performance, Windows, artifact inspection
- [ ] Rebase and integrate into develop only after upstream B, source review and full acceptance

No `main`, Production, Android, bank imports, destructive financial history or failed/pending gate merge.

## Shared UI first implementation (2026-10-21)
- RecurringPage now offers amount mode: fixed legacy or clearly labeled variable estimate with optional exact-cent lower/upper bound; every bound uses MoneyInput and saves only through the existing `await onUpsertDurably(normalized)` revision path. Status labels distinguish estimated next amount from actual linked payments in desktop table, mobile list and next-period summary. A source regression locks these controls, save boundary and status provenance.
- This is **partial implementation**, not accepted. Forecast in PR #591 still consumes the baseline amount and needs explicit estimated provenance after integration. Rendered/QA and server exact-head tests remain mandatory before completion.

## Draft preflight TS repair — 2026-10-21
- `6e965977` draft `validate` halted at TS18047/TS2365/TS18046 because structural validation operates on `unknown` JSON and comparing `value.estimateMin/estimateMax` did not statically narrow the object properties. Added explicit numeric narrowing **after** existing finite-number runtime validation. The constraint, cent exactness and range rejection remain unchanged. No unit/browser/full CI PASS claimed on the old head.

## Browser evidence added — draft (2026-10-21)
- Extended existing Recurring cadence Chromium QA to select Variable via owned AppSelectInput, enter 80 € estimate with 60–100 € range using shared MoneyInputs, inspect controls and responsive 375px modal, persist through the existing durable save, confirm visible estimate label, and capture desktop/mobile editing/saved screenshots. Source guard locks test registration and the semantic distinctions. Actual browser run, screenshot inspection and failure-path QA remain pending. Do not claim completed #8.

## #7 forecast boundary without overlapping PR #591 — 2026-10-21
- Only `src/lib/forecast.ts`'s existing recurring-movement **label** is changed: when `amountMode='variable'`, it visibly states `Εκτίμηση: …`; forecast amount remains owner-entered `item.amount` (no new booked cash event). Legacy fixed recurring labels/numerics and 30/60/90-day cadence stay identical. Added isolated test verifying exactly one October estimated charge and no real event. PR #591 owns scenario UI/module; neither was touched. Integrating multi-cycle fulfillment/estimate-vs-known counts needs joint review after upstream merge. Required rendered evidence pending.
