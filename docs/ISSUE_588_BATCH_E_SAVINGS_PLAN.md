# Issue #588 — Batch E savings-goal forward projection (draft)

**Active branch:** `feat/588-savings-goal-projections-batch-e` from `develop@5b58d3f26e25ade08157c9099b820f46c61df5b2`. **Roadmap:** #588 feature **#13** only (2 explicit acceptance subitems). **PR #590 Batch B** is under full exact-head CI on independent branch; #591 cash-flow scenarios, #592 receipt/counterparties, #593 variable recurring are separately owned. Do not modify their branches, do not merge #13 until validated and reconciled with B/#591/#593 after those integrate.

**Accepted overall roadmap:** **Implementations 2/12 completed · Sub-implementations 4/24 completed** (merged #10/#11). #13 remains **0/1 · 0/2 accepted**. A pure helper and tests are not delivery acceptance.

## Decision scope and invariants

- Existing `SavingsGoal` persists name, target EUR cents and optional deadline. `savingsGoalBalance` sums positive **shared** savings account balances as of date; it is **not an earmarked per-goal allocation**. Always display a warning to that effect for multiple goals.
- Existing `cashFlowForecast` is an advisory 90-day projection of scheduled, recurring, and loan commitments; it contains only known movement inputs and has omissions/insufficient-data markers. Keep forecasts distinct from actual balance history and from PR #591 hypothetical scenarios.
- Pure `savingsGoalProjection` estimates remaining shortfall, calendar-month contribution opportunity and exact-cent suggested monthly amount only when a valid future target deadline is present. Separately flags risk against minimum *non-savings* operating liquidity across the known 90-day projection, not a guarantee of future cash. Explicitly acknowledge forecast omits unknown expenses, dates beyond 90 days and goals sharing the same pool.
- Optional owner-entered monthly what-if scenario is **not** an actual or scheduled transaction. No future event, saving transfer, receivable, interest or ledger mutation may result from projections.

## Planned coherent implementation #13

- [ ] E1: Pure exact-cent and target-date projection, checked actual savings, 90-day known-obligation risk, no-date/overdue semantics, bounded and transparent scenarios. Unit tests incl. shared pool, historical as-of and partial monthly cents. **Implemented preflight only; not accepted.**
- [ ] E2: Integrate existing SavingsPage goal cards/target-date modal with owner-selectable what-if, clear real vs estimate labels and risk/insufficient-data explanation. Preserve shared design primitives, keyboard, focus, mobile/tablet/desktop and Light/Dark.
- [ ] Prove readonly calculations do not alter revision, balances, event or history. Validate date/amount, budget/recurring/loan reconciliation as appropriate.
- [ ] Run exact-head narrow preflight, then full CI, security, rendered QA, WebKit/Lighthouse/Windows (when applicable); directly inspect screenshots before accepting issue checkboxes/merging.
- [ ] Reconcile with merged `develop` after PR #590 and forecast-specific #591/#593, resolving any overlapping domain changes before final release gate.

## Current checkpoint

Branch initial implementation owns only new files `src/lib/goalProjections.ts`, `tests/goal-projections.test.ts` and this plan. No shared finance types/validation, UI files, migration or production data touched. Do not claim PASS for GitHub runs not actually completed.

**Next safe action:** inspect the draft CI type/unit/format result. If green, implement UI/QA using current shared `SavingsPage` and its goal semantics. Do not merge while Batch B or this PR needs validation. If PR #590 is still running, its exact-head rendered result determines its next action; do not edit PR #590 while it runs.

### E2 integrated goal projection in existing Savings view (2026-10-21)
- SavingsPage goal rows gain an opt-in expanded read-only projection with current selected-period as-of date, exact-cent required amount, calendar-month suggestion, user-entered hypothetical monthly amount, baseline vs recommended vs custom goal scenarios and 90-day known-obligation liquidity warning. Separate shared-control panel `SavingsGoalProjectionPanel` and layout-only responsive CSS; no mutation callback or duplicated money engine. Existing creation/edit/delete dialogs remain authoritative.
- Required next: rendered QA desktop and mobile for real shared/estimated labels, what-if input, no clipping and historical period change; source test, latest `validate`, portfolio semantics and direct screenshot inspection. Do not claim #13 accepted until end-to-end proof. No #590 / #591 / #593 overlapping files modified.
