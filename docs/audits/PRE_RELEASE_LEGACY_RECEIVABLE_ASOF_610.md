# Legacy receivables historical as-of correctness — #610
Baseline: develop@579ccdb202870ab0a15e896737c23260595003df. Pre-release correction to the accepted #588 historical report semantics.
## Confirmed defect
A legacy €50 lent / €20 repaid yields current €30 summary, but previously every selected historical date inherited €30; new receivable events correctly honored the selected as-of. This also affected canonical net worth.
## Bounded fix
A single pure source helper reconstructs historical cents only if all imported dated entries are valid, chronological balances stay nonnegative, and final replay exactly matches the imported outstanding. When source is incomplete/inconsistent, preserve the legacy summary instead of fabricating a historical accounting correction. Both Lending rows and canonical net worth call that same helper. No history rewrite or database mutation.
## Validation
- [ ] exact-head draft tests, typecheck, security; [ ] protected develop integration and release PR #605 reconciliation after coexisting #607/#609.
- New tests assert before/after repayment and current source conservation plus ambiguous/incomplete fallback.
Existing #588 Implementations 12/12 · Sub-implementations 24/24 completed and #601 4/4 · 8/8 remain unchanged; this resolves a newly found cross-surface regression.
