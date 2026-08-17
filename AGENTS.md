# RheomIQ repository rules

- Personal financial data and credentials must never be committed. `data/rheomiq-data.json` remains ignored; Supabase credentials belong only in server/runtime secrets or GitHub encrypted secrets.
- Preserve the ledger invariant: internal transfers, withdrawals, savings transfers, card payments, and reconciliation adjustments do not become ordinary spending.
- `saving_cash_offset` means **only** a bank transfer from payroll/current account to savings. Physical cash is contextual justification and must not receive a ledger leg.
- Smart Review is advisory. A suggestion must not change reports until the user explicitly confirms it. `kept` means preserve legacy semantics.
- A credit-card purchase is spending; paying the credit-card liability is not spending again.
- Lending creates a receivable asset. Repayment reduces that asset. Net worth includes receivables.
- Split transactions must balance to the parent amount before save.
- Reconciliation edits must calculate against the balance excluding the reconciliation event being edited.
- Persistence is Supabase/PostgreSQL behind the server API, with version-controlled migrations, optimistic revision conflicts, and database backups. Do not add localStorage or IndexedDB as a finance-data store. Never expose `SUPABASE_SECRET_KEY`/service-role credentials to browser code or `VITE_*` variables.
- UI motion must respect `prefers-reduced-motion`; interaction state cannot be conveyed only by motion or color.
