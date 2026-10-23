# Pre-release savings-goal projection overflow — #612
Source baseline: develop@b7bccaea26ec82d31d66b2ef57f12df1acb65bfb (after accepted #607).

Confirmed: the sum of individually valid monthly cents across a goal's horizon was silently clamped to Number.MAX_SAFE_INTEGER, so a computed future total could be reported as valid while numerically false. Replace the clamp with exact safe-integer rejection, and lock with a large-valid-monthly / unsafe-aggregate regression plus unchanged ordinary exact-cent case.

No UI change, no new accounting engine, no persisted state, no database or Android mutations. This is one bounded new #588 #13 regression, not a reset of completed roadmap items.

## Checkpoints
- [x] Domain correction and targeted regression authored, no CI acceptance claimed yet
- [ ] Narrow draft source/CodeQL CI terminal success
- [ ] Full Ready exact-head CI, then protected develop integration + push validation
- [ ] Deliberate reconciling with held release PR #605 after outstanding sibling integrations

#588: Implementations 12/12 completed · Sub-implementations 24/24 completed. #601 source: 4/4 · 8/8.
