# #648 — transactions end-of-day and lending cash display plan

Branch: `fix/648-transactions-balance-cash-signs`, from `develop@18e925b3dfbc81ab82099f1351a2d25b19845a3d`.
Related active UI work: #646 / PR #647 currently owns `src/pages/DashboardPage.tsx`; **do not independently edit or overwrite it** while PR #647 is awaiting its full review matrix.

**Implementation counters:** Implementations 1/2 completed · Sub-implementations 2/3 completed.
Count scoped code + focused regression guards according to AGENTS.md; acceptance/CI/merge tracked separately.

## I1 — end-of-day account balance provenance (1/1)
- [x] T-01: transaction table and detail call current as-of value exactly *end-of-day* on first account, without inventing per-event running balance. Context in header title/ARIA.

## I2 — cash movement signs separate from operational income/expense (1/2)
- [x] D-03: Transactions activity rows show lending `−` and repayment `+` with cash-sign tone on desktop, inline history and mobile; canonical ledger legs and flowImpact unchanged.
- [ ] D-03: Dashboard activity list needs same display rule; **blocked by concurrent #647 DashboardPage owner**. Rebase/reconcile after #647 merged to develop, preserve privacy and page updates from that PR.

## Validation / integration (not implementation counters)
- [ ] Source/domain-focused Vitest `tests/648-transactions-balance-cash-signs.test.ts`, TypeScript/hygiene
- [ ] Rendered desktop/mobile QA for Transactions, adjacent Dashboard after #647 integration, long localized header, lending and repayment fixture, source ledger parity
- [ ] Final coherent PR to develop + full exact-head CI, CodeQL, rendered, Windows/WebKit and integration checks
- [ ] Merge only after all required gates succeed, no production release implicit

## Next domain milestone (not in current 2/3)
True per-event ledger running balances need an explicitly ordered canonical selector anchored to imported seed snapshots, legacy overrides/tombstones, multi-leg events, and account transfer handling. Until then, the truthful end-of-day label is mandatory, and no per-event value should be reverse-engineered from an arbitrary row sort.

## Checkpoint — 2026-10-29
Read-only source verification: `rowBalance` uses as-of `selectAccountBalances` so multiple same-date rows share an EOD amount. `createEvent` lending and repayment cash legs point opposite of receivable deltas; `flowImpactEvent` correctly treats them as non-operational transfers. Transactions-only source and functional/source regression tests committed. Branch intentionally has no PR yet while #647 is unmerged and owns the Dashboard file. No backend, DB, history, Android or production changes.
Exact next action: inspect #647 final review CI and newly generated renders, reconcile into develop when accepted; then implement missing Dashboard subitem on updated integration baseline and run coherent checks.
