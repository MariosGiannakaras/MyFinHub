# RheomIQ architecture

## Runtime

RheomIQ is a local-first React/Vite client plus a small Express file service. The browser is only the UI. The source of truth is a JSON file on disk (`data/rheomiq-data.json` by default).

## Persistence guarantees

1. GET returns the file plus a content revision hash.
2. PUT requires the last seen revision (`If-Match`).
3. The server rejects stale writes with HTTP 409 rather than silently overwriting another process.
4. Writes are performed through a temporary file + atomic rename.
5. Automatic backups are throttled; explicit backups are always available.
6. Real data and backups are ignored by Git.

## Ledger model

Legacy Excel rows remain immutable seed data unless the user explicitly creates an override/review decision. New actions are `FinanceEvent` objects containing one or more ledger legs.

- `expense`: asset account decreases; spending increases.
- `income`: asset account increases; income increases.
- `transfer`: two asset legs, cashflow impact zero.
- `withdrawal`: bank -> cash, cashflow impact zero.
- `saving_cash_offset`: payroll/current -> savings; cash unchanged; savings KPI increases.
- `refund`: asset increases and spending decreases.
- `lending`: asset decreases and receivable increases.
- `repayment`: asset increases and receivable decreases.
- `card_purchase`: credit liability decreases (more negative) and spending increases.
- `card_payment`: bank decreases and credit liability increases toward zero; spending impact zero.
- `reconciliation`: balance-only adjustment; spending impact zero.
- `split`: one payment with category-level parts that must equal the parent amount.

## Legacy Smart Review

Heuristics only create suggestions. Reporting remains based on the original legacy row until a decision is `confirmed`. Mixed comments are routed to a split editor. `kept` permanently records that the original meaning should remain.
