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

### QA failure-receipt addition
- Added a distinct mobile 375px **rejected finance receipt** scenario after the successful variable estimate editor proof. A fresh QA navigation enables existing `recurring-save-failure=1` and verifies the variable 60–100 € draft persists after a rejected durable update, its dialog/error remains open, the underlying saved recurring row remains fixed (not mislabeled estimated), and captures `recurring-variable-rejected-save-mobile.png`. The existing save-progress semantics and error messaging were not changed; rendered run and screenshot inspection remain pending.

## Integration checkpoint — 2026-10-22

- **Roadmap status, verified live:** **Implementations 8/12 completed · Sub-implementations 16/24 completed** (67% formally accepted), estimated roadmap engineering maturity **≈86%**. Feature #8 **≈65% technical maturity** after this integration work starts; **0/2 formally accepted**. These are engineering estimates, not CI coverage percentages.
- **Integration baseline:** `develop@315304c9753f745d65d0160580c8ae4671afd1d5`, after accepted Batch B/C PRs #590/#592 and green postmerge checks. Feature branch head before reconciliation `a50d6e9e92cab4a15025e7d10d9c854c9168d4e5`. The original checkpoint above refers to its older 2026-10-21 base and is historical.
- **Semantic two-parent integration:** preserve all `develop` files including shared identity, noncash lending, multi-funding, linked-fee contracts, RLS/server validation and current AGENTS/QA workflows. Overlay only the seven #8-owned feature/QA files, then add the three optional `RecurringItem` fields and exact amount/range validator clause to **current** shared `src/types.ts` and `server/validation.ts`. No touch to independently owned #7/#9/#13 branches. A true two-parent merge makes newer integration commits reachable without forcing unrelated edits to develop.
- New source guard and narrow draft TS/unit/build checks must verify this merge before any Ready/full QA. Existing `scripts/recurring-cadence-qa.mjs` now exercises 1280/375px estimate controls and failed-save retention but must actually run and screenshots inspected; no rendered acceptance inferred from source.
- **Next:** read integration preflight CI; fix coherent failure set, then add focused Chromium evidence and verify recurrence/forecast linkage and no duplicate scheduled/loan projections. Final Ready matrix + real Stack (changed server contract), screenshots/Windows/WebKit/Lighthouse/CodeQL, protected merge to `develop` and postmerge gate required before #8 can reach 100%. No main/Production/Android edits.

### Scoped recurring browser preflight — 2026-10-22

- Semantic two-parent integration `d8cc2ee4` uses `develop@315304c`. Exact [draft CI #39805045197](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/39805045197) **validate SUCCESS** (hygiene/TS/unit/build/source/bundle); separate CodeQL and unified workflow were still in progress at initial inspection. This is **not a rendered PASS**.
- Added branch-scoped temporary `.github/workflows/recurring-variable-focused-qa.yml` for **draft-only** #593, running existing production-component `scripts/recurring-cadence-qa.mjs` with Chromium against synthetic QA fixtures. It covers desktop 1280, 375px modal geometry and touch targets, owner variable estimate and 60–100 EUR range, retained fixed baseline on rejected database write and screenshots for each state. Upload evidence with PR head SHA. No new write route or finance mutation.
- Read first focused browser result, fix any actual control/geometry/failure-state issue, inspect screenshots directly. **Remove this temporary workflow from the final Ready review head** because the same browser script is registered in standard `scripts/run-rendered-qa.mjs`. Do not disable source checks or loosen thresholds. Formal counters **8/12 · 16/24 accepted**, #8 estimated **65%** while draft validation remains incomplete. 
