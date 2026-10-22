# Owner-approved category taxonomy — 2026-10-23

## Scope and authority
Owner approved **20 expense categories and 6 income categories** (final Greek singular labels) in the 2026-10-23 conversation. The owner's actual Excel is the behavioral reference; current Supabase ledger rows are *dummy implementation data*, never evidence of the owner's real category frequencies. Repository scope is MyFinHub only; no Android changes.

## Implementations (0/4 completed) · Sub-implementations (0/8 completed)
- [ ] 1. Finance category tree and identities
  - [ ] 1a. Apply approved exact category/subcategory ordering to Supabase via revision-aware transaction and history/backups, preserve identity aliases
  - [ ] 1b. Reconcile live recurring/budget dependencies without rewriting transaction history
- [ ] 2. Recurring category compatibility
  - [ ] 2a. Support optional subcategory on recurring configuration and validation
  - [ ] 2b. Propagate selected category/subcategory to one linked payment event
- [ ] 3. Installment category compatibility
  - [ ] 3a. Replace hard-coded retired installment category with explicit purpose category/subcategory for expense-per-installment mode
  - [ ] 3b. Preserve liability-repayment behavior and historical events; safe fallback for existing loans
- [ ] 4. Tests and integration
  - [ ] 4a. Targeted regression proof for recurring, installment and retired-taxonomy semantics
  - [ ] 4b. Review-head required CI, rendered relevant routes, artifact inspection and PR merge to develop only after gates

## Safety and invariants
- Treat SQL/direct state mutations as privileged exceptions; do not bypass application owner+AAL2/RLS, revision conflict, append-only audit/history, or pre-change backups. If approved RPC cannot be invoked in authorized context, stop DB mutation and record precise blocker.
- Do not delete/overwrite ledger history, audit history, backups, IDs, card secrets, or Android code.
- Keep retired aliases for historical references; avoid bulk relabeling existing transactions.
- Existing app deployment must not become unusable from new taxonomy. Final integration requires coherent client/runtime validation.
- Another open PR #596 owns advanced budgets; avoid modifying its files and reconcile only if necessary.

## Checkpoint
Branch: `feat/20261023-owner-category-taxonomy` from develop@9ec6730b4abe6bc86a9098565a3378b87693be94.
Implementation staged (not yet accepted):
- Exact 20/6 taxonomy tree and pure identity-preserving migration: `src/lib/ownerApprovedTaxonomy.ts`.
- Added authenticated owner-confirmed Settings action that persists via existing `onFinanceDurably` and audited revision/history-protected RPC.
- Recurring category/subcategory persisted in model and carried into one linked payment event.
- Expense-per-installment payment takes selected purpose; liability repayment and self-loan flow unchanged; legacy fallback is neutral `Άλλο`.
- Generic finance defaults no longer infer transaction purpose from owner frequency order; added tests for linked payments and staged taxonomy.
- Live SQL connection: `auth.uid() IS NULL`, `rheomiq_is_owner_aal2()=false`. **No live DB write performed**, as direct SQL would bypass required owner+AAL2, history generation, atomic relational state, and audit.
- PR #596 also edits `src/types.ts` and `server/validation.ts`; its advanced budget code belongs to separate workstream. Rebase/reconcile these additive changes explicitly on integration; do not overwrite either PR.
- Source patches reviewed via GitHub diff; full typecheck, Vitest, rendered QA and CI have not run in this environment. No physical-device gate required.

Exact next action: mark PR #600 Ready for Review and run required exact-head CI/rendered/security/Windows matrix. Inspect failures/artifacts before corrections and leave draft if gates fail. After reviewed deployment, open the app with owner+AAL2 and use Settings > Categories > Apply Approved Taxonomy; verify 20/6, identity aliases, linked recurring/budgets, real payment categorization and Undo/Redo. Never use unguarded administrative SQL.
