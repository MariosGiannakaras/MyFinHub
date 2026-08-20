# MyFinHub Analytics Hardening Proposal

Tracking: #158 · branch `feat/ui-ux-hardening-batch`

## Current analytics inventory

The current Reports page already provides:

- current-month income, expense, savings and budget remainder;
- month-over-month income / expense / savings change;
- six-month income / expense / savings series;
- primary-account balance history;
- recurring monthly commitments;
- credit debt / utilization;
- receivables;
- Pay & Save contribution;
- category / subcategory totals;
- savings-source breakdown;
- textual alternatives for the main charts.

The existing visualizations are useful but mainly descriptive. They show totals and history, but they do not yet explain concentration, momentum, persistence or how current values compare with a recent baseline.

## Correctness prerequisite

Credit analytics must use the multi-card subledger, not the historical single `credit-card` liability. The hardening batch therefore aggregates debt by `cardId`, active limits per card, total available credit and portfolio utilization before adding any new insight surface.

## Proposed insight model

The following metrics can be derived deterministically from existing finance data without causal speculation:

### Cash-flow trend

- Current income vs previous month.
- Current expenses vs previous month.
- Current savings vs previous month.
- Current expenses vs trailing 3-month average.
- Current savings rate and previous-month savings rate.
- Net operational flow (`income - expense`) and its recent direction.

### Spending concentration and momentum

- Largest category / subcategory by current-period spend.
- Share of total spend represented by the largest category.
- Category change versus previous month when both periods contain data.
- Top contributors to the month-over-month expense change.
- Explicit “insufficient history” state rather than a synthetic trend when history is missing.

### Commitments and liquidity pressure

- Recurring commitments as a share of current income.
- Total active credit-card limit, debt, available credit and portfolio utilization.
- Credit utilization per card for drill-down.
- Receivables outstanding.
- Budget consumed / remaining / exceeded.

### Savings quality

- Savings rate.
- Savings-source mix (Pay & Save / manual transfer / cash offset).
- Current savings versus trailing baseline.
- No claim that a change was “caused” by a category or event unless the data explicitly encodes that relationship.

## Proposed Reports information hierarchy

This is the owner checkpoint before a large visual restructure.

1. **Headline health strip** — income, expense, savings rate, budget position.
2. **Trend & comparison section** — six-month flow with previous-month and trailing-average context.
3. **Actionable insights section** — 3–5 deterministic callouts such as “expenses are 12% above the recent 3-month average” or “one category represents 38% of this month’s spend.”
4. **Commitments section** — recurring burden, multi-card credit utilization, receivables.
5. **Category momentum section** — current categories plus period-over-period deltas.
6. **Account and savings drill-down** — account balances and savings-source mix.

Desktop can use compact comparative cards and charts. Mobile should remain list-first: textual insight and KPI context first, charts secondary/collapsible where they do not fit naturally.

## Language / analytical integrity rules

- Describe observed changes, not invented reasons.
- Prefer “increased/decreased compared with…” over “because of…”.
- State when there is insufficient historical data.
- Use the same financial semantics as the ledger; transfers and credit repayments must not become duplicate expenses.
- Every displayed percentage must have a defined denominator and zero-denominator behavior.
- Derived trends need regression tests before UI exposure.

## Approval boundary

Backend correctness fixes and deterministic metric helpers may be implemented in this branch now. A large rearrangement of the Reports page should not be implemented until the owner approves or adjusts the information hierarchy above.
