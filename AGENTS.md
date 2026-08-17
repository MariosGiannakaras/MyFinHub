# RheomIQ repository rules

- Personal financial data must never be committed. `data/rheomiq-data.json` and `data/backups/` remain ignored.
- Preserve the ledger invariant: internal transfers, withdrawals, savings transfers, card payments, and reconciliation adjustments do not become ordinary spending.
- `saving_cash_offset` means **only** a bank transfer from payroll/current account to savings. Physical cash is contextual justification and must not receive a ledger leg.
- Smart Review is advisory. A suggestion must not change reports until the user explicitly confirms it. `kept` means preserve legacy semantics.
- A credit-card purchase is spending; paying the credit-card liability is not spending again.
- Lending creates a receivable asset. Repayment reduces that asset. Net worth includes receivables.
- Split transactions must balance to the parent amount before save.
- Reconciliation edits must calculate against the balance excluding the reconciliation event being edited.
- File persistence is server-side JSON with atomic writes, revision conflict detection, and backups. Do not add localStorage or IndexedDB as a finance-data store.
- UI motion must respect `prefers-reduced-motion`; interaction state cannot be conveyed only by motion or color.
