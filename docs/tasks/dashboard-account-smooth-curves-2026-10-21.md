# Dashboard account balance chart — smooth 80% presentation

Date: 2026-10-21. Baseline: live `develop` after accepted #588 Batch A. Scope isolated to Dashboard primary account history charts; concurrent #588 PRs #590–#594 own other domains. Do not touch Android, main, security, persistence, forecasting, or other charts.

## Owner contract
- [x] Keep daily canonical finance data, previous/current period separation, savings comparison/goal, visible last point, all account card interactions and month/as-of semantics.
- [x] Replace straight connection segments only on primary account-balance charts with **fixed 80%** non-overshooting monotone cubic curves (not a slider); preserve calendar scaling and handle flat/large/small changes.
- [x] Show small dots (radius 1.35 SVG units) only where consecutive daily closing balances differ; retain original terminal marker.
- [x] Reduce internal chart-edge padding, preserve full-width SVG stretching, and ensure one-point fallback renders across the chart.
- [ ] Validate targeted tests, desktop/tablet/mobile Light/Dark rendered evidence and examine the screenshots on the exact changed head.
- [x] Inspect sibling chart usages and preserve them; do not implicitly refactor unrelated charts.

## Scope of related charts (inventory, untouched)
- `DashboardPage.tsx` `Sparkline`: summary and KPI inline sparklines, different compact context.
- `PlanningApprovedDesktop.tsx`: account forecast sparkline and aggregate step-area 90-day forecast (step representation has forecast semantics).
- `ReportsPage.tsx`: monthly Recharts monotone account/cumulative trends and six-month bar charts.
- Savings and other forecast charts have separate period/finance contracts; no changes are approved here.

## State
Implementation code and focused regression tests committed on isolated feature branch; rendered repository/browser QA pending. Do not claim a full validated acceptance or merge before required evidence.
