# MyFinHub Analytics Hardening Proposal and Implementation Record

Tracking: #158 · branch `feat/ui-ux-hardening-batch`

## Analytics inventory

The Reports surface provides:

- current-month income, expense, savings and budget remainder;
- month-over-month income / expense / savings change;
- six-month income / expense / savings series;
- primary-account balance history;
- recurring monthly commitments;
- multi-card credit debt / utilization;
- receivables;
- Pay & Save contribution;
- category / subcategory totals;
- savings-source breakdown;
- textual alternatives for the main charts.

The hardening work extends the descriptive totals with concentration, momentum, recent-baseline comparisons and explicit insufficient-history states.

## Correctness prerequisite

Credit analytics use the multi-card subledger, not the historical single `credit-card` liability. The hardening batch aggregates debt by `cardId`, active limits per card, total available credit and portfolio utilization before presenting insight surfaces.

## Implemented insight model

The following metrics are derived deterministically from existing finance data without causal speculation:

### Cash-flow trend

- Current income vs previous month.
- Current expenses vs previous month.
- Current savings vs previous month.
- Current expenses vs trailing 3-month average.
- Current savings rate and previous-month savings rate.
- Net operational flow (`income - expense`).

### Spending concentration and momentum

- Largest category / subcategory by current-period spend.
- Share of total spend represented by the largest category.
- Category change versus previous month when both periods contain data.
- Explicit “insufficient history” state rather than a synthetic trend when history is missing.

### Commitments and liquidity pressure

- Recurring commitments as a share of current income.
- Total active credit-card limit, debt, available credit and portfolio utilization.
- Credit utilization per card for drill-down.
- Receivables outstanding.
- Budget remaining / exceeded.

### Savings quality

- Savings rate.
- Savings-source mix (Pay & Save / manual transfer / cash offset).
- Current savings versus recent baseline context.
- No claim that a change was “caused” by a category or event unless the data explicitly encodes that relationship.

## Implemented Reports information hierarchy

1. **Headline health strip** — income, expense, savings rate, budget position.
2. **Trend & comparison section** — six-month flow with previous-month and trailing-average context.
3. **Actionable insights section** — deterministic callouts from recorded data.
4. **Commitments section** — recurring burden, multi-card credit utilization, receivables.
5. **Category momentum section** — current categories plus period-over-period deltas.
6. **Account and savings drill-down** — account balances and savings-source mix.

Desktop uses comparative cards and charts. Mobile remains list-first, with textual KPI/insight context prioritized and charts constrained to responsive surfaces.

## Language / analytical integrity rules

- Describe observed changes, not invented reasons.
- Prefer “increased/decreased compared with…” over “because of…”.
- State when there is insufficient historical data.
- Use the same financial semantics as the ledger; transfers and credit repayments must not become duplicate expenses.
- Every displayed percentage has a defined denominator and zero-denominator behavior.
- Derived trends have regression tests before UI exposure.

## Approval and implementation status

The owner explicitly directed completion of the full implementation on 2026-08-20. That instruction satisfies the previously required owner checkpoint for the Reports/Analytics restructure. The hierarchy above is implemented on `feat/ui-ux-hardening-batch` in `src/pages/ReportsPage.tsx` and `src/lib/reports.ts`, with regression coverage in `tests/reports.test.ts` and rendered desktop/mobile QA evidence.
