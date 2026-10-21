# #588 — Variable recurring obligations (#8), independent D2 draft
**Branch:** `feat/588-variable-recurring-batch-d2` based on `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2`. #591 owns #7 forecast scenarios and PlanningPage; #590 owns canonical finance and migrations, #592 owns receipts. This branch owns only recurring amount model, server validation, recurrence editor and tests. No cross-branch shared finance edits.
**Accepted roadmap:** Implementations 2/12 completed · Sub-implementations 4/24 completed. **This branch: 0/1 and 0/2 accepted.**

## Contract
Existing `RecurringItem.amount` stays fixed unless `amountMode='variable'`, in which case it is an **owner-entered estimate**, not a bank charge. Optional `estimateMin` and `estimateMax` must both exist and enclose the estimate. Exact EUR cents. Actual payments remain a single linked canonical expense event and may differ; no phantom future income or expense.
`recurrenceUnit` (month/year), `recurrenceInterval`, anchors, early-fulfillment suppression and as-of historical records remain unchanged.
A forecast projection must label variable amounts estimated. Integrate with #591 after upstream merges, not while its head is validated.

## Implementation checklist
- [ ] Pure variable-amount validation, server structural guards, source tests and actual linked payment evidence
- [ ] Opt-in editor via shared select/money controls, responsive amount labeling and actual-vs-estimate display
- [ ] Forecast/history/fulfillment/report contract, delayed integration with #591 and #590
- [ ] Narrow tests followed by full exact-head rendered Light/Dark desktop/mobile/tablet, security/DB, cross-engine, performance, Windows, artifact inspection
- [ ] Rebase and integrate into develop only after upstream B, source review and full acceptance

No `main`, Production, Android, bank imports, destructive financial history or failed/pending gate merge.
