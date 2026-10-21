# Issue #597 — desktop primary-account card family acceptance

Owner authorization: 2026-10-21, “Κάνε τα όλα. Η απόκρυψη είναι σωστή, απλά να μη φαίνεται το ποσό θέλω.”
Scope: **desktop** primary cards, with non-regression tablet/mobile and Light/Dark; preserve finance truth and all already-approved interactions. Use existing scope owner PR #595 (no competing Dashboard branch); current baseline `develop@5b58d3f2`. Do **not** touch Android, `main`, security, database or release.

## Acceptance checklist — 1 implementation / 8 sub-implementations
- [ ] Unified header, balance/chart geometry and width usage for three primary cards, all 1440/1920/2560.
- [ ] Common 30-day change semantics on three cards; savings goal remains separate and comparable, no lost target/comparison.
- [ ] Dashboard account-specific Transactions routes to existing account-filter selector; generic navigation unaffected, user can reset filters.
- [ ] Graph chronology/period copy, flat-value state and meaningful accessible SVG label without exposing masked EUR values.
- [ ] Long Greek account name, masked IBAN copy hitbox, extreme monetary values and no content overlap.
- [ ] Accessible Light/Dark actions, keyboard/focus, reduced-motion and stable chart geometry/legend.
- [ ] Privacy hides only monetary amounts; all chart shapes remain visible, including historical period.
- [ ] Focused source/browser checks and real rendered desktop, tablet/mobile and Light/Dark screenshots directly inspected on exact PR review head; required repository gates PASS.

## Current work and hard constraints
- Implementing in PR #595 as expanded coherent Dashboard UX batch. Existing smooth 80% no-overshoot curves, selected-month-only dot markers, previous month curve without dots, goal/comparison and period-specific account balances remain canonical.
- Existing `DashboardPage` `onTransactions` accepted generic behavior remains for non-card links. Card-specific action supplies an ephemeral URL account hint consumed by existing `TransactionsPage` filter; the user can select “Όλοι οι λογαριασμοί”.
- Do not add sliders, zoom, fake data, fake save feedback or persistent new preference.
- Privacy: only exact EUR amounts must be hidden when toggled off. **Do not hide chart lines**, do not turn graphs into placeholders. Accessible descriptions must not contain hidden EUR amounts.
- Geometry must be tested on browser DOM and screenshots, not assumed from CSS sources.
- Reconcile old Final Visual screenshot commit from #595 safely with final coherent rendered acceptance; never claim old artifacts represent the changed head.
- A real finance delta remains trailing 30 days ending at selected period cutoff, not automatically the whole calendar reporting month.
- A savings rate percentage vs income is not a specific savings-account closing balance target: retain distinct wording and existing unique-goal target line behavior.
- Do not merge before complete required CI/security/rendered/Windows and direct evidence review.

## Validation and progress
**Implementations 0/1 completed · Sub-implementations 0/8 completed.** Code implemented for initial batch, not yet accepted. Current exact head and gate state must be obtained from live PR. Next: run source and browser checks, inspect actual screenshots, fix any coverage/layout failure, then one full Ready head gate.