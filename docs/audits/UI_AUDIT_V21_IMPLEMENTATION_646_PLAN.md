# UI audit v2.1 implementation — issue #646

Branch: `fix/646-audit-v21-first-batch` (base `develop@18e925b3dfbc81ab82099f1351a2d25b19845a3d`)
Production main remains separate; Android owned separately. Input: owner-provided v2.1 audit and 19 unique screenshots, reconciled as **evidence**, not a code specification.

**Current checkpoint: Implementations 0/2 completed · Sub-implementations 0/9 completed**

Only fully **accepted** work counts; source edits are provisional until focused checks, rendered desktop evidence inspection, and repository-defined review gates.

## Implementation I1 — financial display / semantics (0/5)
- [ ] P-02 show baseline current portfolio, avoid redundant negative sign
- [ ] P-03 center flat sparkline (without changing forecast values)
- [ ] S-03 disambiguate shared savings balance from monthly flow
- [ ] A-03 correctly scope 'upcoming' to current, historical and future reporting periods
- [ ] A-04 locale-aware reporting percentages

## Implementation I2 — shared visual consistency (0/4)
- [ ] A-02 selected card credit limit labeled as per-card, not portfolio
- [ ] ST-03 provider summary spacing / header alignment; editing technical ID remains intact
- [ ] T-03 destructive buttons avoid primary accent-gradient rule
- [ ] A-01 report counterparties/income semantic text wrapper

## Pending backlog / deliberate exclusions from current 0/9 plan
- T-01/D-03 running per-event balances and lending signs: requires finance-impact integration and reconciliation tests across same-date, multi-leg, transfer, and legacy cases; don't copy receivable balances as account balances.
- D-01/E-02 amount privacy, R-01 overdue recurring + cashflow forecast semantics: separate bounded domain/state implementation with tests; do not silently add cashflow legs for unpaid historical recurrences.
- S-01/C-01/IL-01/LD-01/E-01 container/child alignments; ST-04/ST-05 category editor/icon mapping; CC-01/CC-02 card font/interaction: follow in coherent design batch.
- Remaining v2.1 findings need a source-and-visual evidence checkpoint before inclusion. Explicitly reject stale paths (e.g. ProviderVisualLibrarySettings.tsx), literal 1680px global width, unsupported assertions.
- Do not change Android, Supabase records, accounting history, release main, or production.

## Validation / acceptance
- [ ] Per-file source diff inspection and blast-radius sweep of shared primitives
- [ ] Focused source/finance regression tests and local preflight where executable
- [ ] Required rendered desktop screenshot evidence, inspected directly for layout, signs, labels and states (plus repo-required counterpart breakpoints/themes)
- [ ] Coherent review-head CI, CodeQL, Real Stack and Windows gates as applicable; check actual job results
- [ ] Reconcile approved implementation, issue, PR, branch/checkpoint and next owner decision; do not merge on pending/failing gates

## Last checkpoint — 2026-10-29
- Intake reviewed against current `develop`, `PROJECT_RULES.md`, `AGENTS.md`, #266 and UI standards; current unrelated draft release PR #645 targets main.
- Issue #646 created, new branch created from develop; no code edits committed yet.
- Current batch source-only preparation; cannot execute complete application locally because the container cannot resolve GitHub; GitHub connected app supports source reads/writes and CI visibility.
- Exact next action: implement nine specified changes on this branch in a coherent draft batch, add focused regression coverage, validate, and update this checkpoint before review-ready.
