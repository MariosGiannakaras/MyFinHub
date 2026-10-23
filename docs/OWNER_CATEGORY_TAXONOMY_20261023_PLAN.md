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
- Source implementations and focused regression guards: **Implementations 4/4 completed · Sub-implementations 8/8 completed**.
- Prior full review CI on `4041409fcafb8450910ee175f266c0eab82a7eba`, run `39912994451`, passed validate, CodeQL, WebKit, Lighthouse, three Windows jobs and Unified required gate after re-running transient WebKit package download cancellation.
- Integrating the latest prior `develop` into taxonomy PR #600 uncovered a strict Transactions rendered latency result of 2270ms against the unchanged <2000ms assertion. The taxonomy management rendered QA itself passed.
- The independent #588 workstream resolved runner contention in PR [#602](https://github.com/MariosGiannakaras/MyFinHub/pull/602), merge `9569e5b7318241303d36394d33031f6082bd5a2b`: strict Transactions and large-data latency probes now run in the existing serial resource-isolated stage; unchanged latency thresholds and explicit regression tests. Its full CI and CodeQL passed.
- PR #600 has now reconciled the **four #602 files** with current `develop` as an additive merge; reverse compare confirms behind=0 and no loss of current integration baseline. New full CI and CodeQL were started for this integration. **Do not merge until exact final review-head mandatory gates are green**.
- Relevant earlier taxonomy, recurring, payment and Settings browser screenshots were directly inspected, including desktop and mobile; retain current-head rendered QA acceptance requirement. Do not relax performance/visual/security gates.

## Integration / release
- PR [#600](https://github.com/MariosGiannakaras/MyFinHub/pull/600) targets `develop`. The only newer `develop` changes were Savings and the independent Transactions runner fix #602; both are retained.
- Separate draft [#596](https://github.com/MariosGiannakaras/MyFinHub/pull/596) owns advanced budgets, subcategory carryover and its shared-file additions. Reconcile #596 before its future merge, rather than overwriting it here. The #596 owner was notified of frequency-first category/default compatibility.
- Live Supabase **not changed**: last authenticated administrative read confirmed revision **465**, old **18 expense / 6 income** active categories. The direct administrative SQL attempt was rejected by connected-tool safety checks before execution. Do not misrepresent the DB state. The owner-approved target remains 20/6 with 71 subcategories, already in `src/lib/ownerApprovedTaxonomy.ts`.
- Deliberate production promotion is separate from develop integration and is not automatically authorized. Production category application uses the documented non-destructive, revision/history/audit-preserving owner path; do not bypass repository security controls.
- Windows/desktop correctness is validated by automated CI and artifact inspection, not physical hardware.

## Safety and invariants
- Treat SQL/direct state mutations as privileged exceptions; do not bypass application owner+AAL2/RLS, revision conflict, append-only audit/history, or pre-change backups. If approved RPC cannot be invoked in authorized context, stop DB mutation and record precise blocker.
- Do not delete/overwrite ledger history, audit history, backups, IDs, card secrets, or Android code.
- Keep retired aliases for historical references; avoid bulk relabeling existing transactions.
- Existing app deployment must not become unusable from new taxonomy. Final integration requires coherent client/runtime validation.
- Another open PR #596 owns advanced budgets; avoid modifying its files and reconcile only if necessary.

## Checkpoint
Workstream: `feat/20261023-owner-category-taxonomy`, PR #600, issue #601, target `develop`.
**Implementations 4/4 completed · Sub-implementations 8/8 completed** (source and focused regressions; no claim of live activation).

Newest merged integration baseline includes #602 Transactions strict-latency isolation, merged to `develop` as `9569e5b7318241303d36394d33031f6082bd5a2b`. The taxonomy branch has an additive reconciliation merge based on that commit, preserving the complete approved taxonomy. Exact final head, status checks, and conclusion: **inspect live PR #600 and latest associated GitHub Actions runs**; the last integration review head before this document change was `879304e76418ae2e80cd5b6795b48caebcec497e`, with CI `39924517983` and CodeQL `39924517723` initially in progress.

**Exact next action:** inspect all required gates on the latest PR #600 head, including strict Transactions rendered QA, and direct generated QA evidence. If green and mergeable, protected squash-merge #600 to `develop`, then verify the resulting head and any required develop push CI. If a required check fails, repair the owning cause without reducing thresholds, then revalidate one coherent new head.

**Production/release:** Live database at revision 465 with old 18/6 taxonomy at last confirmed read; direct administrative connector write was rejected. No SQL migration, release, or Android change was executed. Post-release activation/verification is a separate pending action. Never claim active 20/6 database taxonomy until a successful write and direct verification.
