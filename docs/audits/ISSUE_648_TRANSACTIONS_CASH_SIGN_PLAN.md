# #648 — transactions end-of-day and lending cash display plan

Branch: `fix/648-transactions-balance-cash-signs`, from `develop@18e925b3dfbc81ab82099f1351a2d25b19845a3d`.
Related active UI work: #646 / PR #647 currently owns `src/pages/DashboardPage.tsx`; **do not independently edit or overwrite it** while PR #647 is awaiting its full review matrix.

**Implementation counters:** Implementations 2/2 completed · Sub-implementations 3/3 completed.
Count scoped code + focused regression guards according to AGENTS.md; acceptance/CI/merge tracked separately.

## I1 — end-of-day account balance provenance (1/1)
- [x] T-01: transaction table and detail call current as-of value exactly *end-of-day* on first account, without inventing per-event running balance. Context in header title/ARIA.

## I2 — cash movement signs separate from operational income/expense (2/2)
- [x] D-03: Transactions activity rows show lending `−` and repayment `+` with cash-sign tone on desktop, inline history and mobile; canonical ledger legs and flowImpact unchanged.
- [x] D-03: Dashboard activity list uses shared receivable-cash direction to show outward lending `−` and inward repayment `+`, with matching tone. Noncash internal movements remain neutral and hidden figures remain masked.

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

## Post-#647 reconciliation checkpoint — 2026-10-29
- #647 merged into `develop@f10b963f650a5b9c185512986d62d572c7ef4420` after full exact-head required CI #40921547456 SUCCESS. The FinanceData/Dashboard privacy updates are preserved; #648 is now free to own the Dashboard movement-sign surface.
- A single nonposting `receivableCashDirection` source helper in `src/lib/receivableCashDirection.ts` returns −1 for lending, +1 for repayment and 0 for all other events (including lending_writeoff). This reflects cash-leg direction only, not a new income/expense category or mutation to the receivable asset.
- Transactions rows and Dashboard recent activity labels/tone now share the helper. Existing masked Dashboard state (`•••••• €`) is unchanged, and other neutral transfers remain ↔. Domain unit and source tests cover sign, tonal state, writeoff noncash and unchanged flowImpact.
- **Implementation: 2/2 · 3/3 code complete; validation not yet accepted**. Branch reconciled with exact `develop` and must pass narrow CI/tests before Ready full rendered/CodeQL/WebKit/Windows acceptance. No Android, DB, vault or production modifications.
- Exact next action: inspect draft CI results and focused rendered evidence for the Transactions EOD label and Dashboard sign with seeded lending/repayment; if green, mark PR Ready and validate one coherent final head. Do not merge with pending/failed checks.
