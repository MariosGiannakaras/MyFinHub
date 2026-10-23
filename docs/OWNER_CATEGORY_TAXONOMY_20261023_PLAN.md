# Owner-approved category taxonomy — 2026-10-23

## Scope and authority
Owner approved **20 expense categories and 6 income categories** (final Greek singular labels) in the 2026-10-23 conversation. The owner's actual Excel is the behavioral reference; current Supabase ledger rows are *dummy implementation data*, never evidence of the owner's real category frequencies. Repository scope is MyFinHub only; no Android changes.

## Implementations (4/4 completed) · Sub-implementations (8/8 completed)
Counts represent **implemented source and focused regression guards** only, never a claim of CI acceptance or live DB change.
- [x] 1. Prepare approved canonical finance taxonomy
  - [x] 1a. Implement exact approved 20/6 trees with stable identity aliases and explicit retired labels; migrate with pure, idempotent domain operations
  - [x] 1b. Reconcile linked recurring, scheduled/rule/future budget references and reject unknown or ambiguous active dependencies rather than dropping history
- [x] 2. Recurring purpose compatibility
  - [x] 2a. Support optional subcategory in recurring model, editor and API validation
  - [x] 2b. Propagate recurring category/subcategory into exactly one linked actual payment
- [x] 3. Installment purpose compatibility
  - [x] 3a. Replace hardcoded "Δόσεις / δάνεια" on expense-per-installment with explicit purpose category/subcategory and neutral legacy fallback
  - [x] 3b. Preserve liability repayment, card payment, self-loan and legacy event semantics; add focused guards
- [x] 4. Protected user activation and default-choice safety
  - [x] 4a. Expose owner-confirmed taxonomy application through existing authenticated revision/history/audit-backed `onFinanceDurably`; no SQL bypass or automatic database write
  - [x] 4b. Decouple frequency display order from implicit transaction defaults and add regression tests for taxonomy identity, recurring, rules, inactive entries and form contract

## Validation / CI (NOT part of implementation counters)
- Review head `9679386fb1a12fd4d98e4d5c56babb2d90ec9e58`: CI run `39871378055` failed; validate hygiene unused export `LinkedExpensePurpose` and Lighthouse median mobile dashboard LCP 5509ms vs 5500ms requirement. CodeQL, WebKit and Windows passed.
- Removed the unused export; no performance limits relaxed. Mobile Lighthouse miss was 9ms on same unrelated dashboard route; inspect result on next coherent exact review head before attributing root cause or treating as noise.
- Current new head: must inspect live GitHub before referencing SHA/run. Draft after first failure while fixing the batch.
- **Focused unit/type/regression/runtime/rendered evidence on latest source not yet confirmed passing; do not assert PASS.**

## Integration / release
- PR [#600](https://github.com/MariosGiannakaras/MyFinHub/pull/600) targets `develop`, presently draft for CI correction. Separate budget draft [#596](https://github.com/MariosGiannakaras/MyFinHub/pull/596) edits `src/types.ts` and `server/validation.ts`; reconcile additive changes, do not wholesale overwrite.
- User-authorized **live Supabase migration remains unapplied**: admin connector returned `auth.uid() IS NULL` and owner+AAL2 `false`. After reviewed merge and deliberate deployment, use Settings > Categories confirmation while signed in as owner with AAL2. Verify settings, relational recurring/budgets, aliases, one linked payment and history. Do not bypass the canonical RPC.
- Windows/desktop automated gates and rendered evidence required, not physical hardware.

## Safety and invariants
- Treat SQL/direct state mutations as privileged exceptions; do not bypass application owner+AAL2/RLS, revision conflict, append-only audit/history, or pre-change backups. If approved RPC cannot be invoked in authorized context, stop DB mutation and record precise blocker.
- Do not delete/overwrite ledger history, audit history, backups, IDs, card secrets, or Android code.
- Keep retired aliases for historical references; avoid bulk relabeling existing transactions.
- Existing app deployment must not become unusable from new taxonomy. Final integration requires coherent client/runtime validation.
- Another open PR #596 owns advanced budgets; avoid modifying its files and reconcile only if necessary.

## Checkpoint
Branch `feat/20261023-owner-category-taxonomy`, PR #600 targeting `develop`, scope issue #601.
Implementation source/guards staged: **Implementations 4/4 completed · Sub-implementations 8/8 completed**.
Live Supabase unchanged, authorized owner+AAL2 session unavailable to connector. Earlier ready-head CI failed hygiene unused export and 9ms mobile Lighthouse LCP; unused export fixed and new guard batch pushed.
**Exact next action:** inspect latest draft-head validate CI. If red, inspect complete failures and correct owning causes in one batch. Then mark ready and run full required review-head CI/CodeQL/WebKit/Lighthouse/Windows/rendered QA; directly inspect artifacts. Merge only green after checking overlap #596. Owner AAL2 activation/deployment remains separate blocked production action.
