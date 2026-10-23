# Pre-release integrated recurring/taxonomy/budget regression — #606
Date: 2026-10-23. Baseline: develop@579ccdb202870ab0a15e896737c23260595003df; target release PR #605 (unreleased).
## Verified findings
- Recurring known-due obligations lost subcategory in enhanced budget projections; scheduled dedup ignored category-child identity.
- Taxonomy child rename/move reconciled pending Scheduled, Rules, Budgets but omitted seeded+override/custom Recurring configuration.
- Child retirement omitted live Recurring dependencies.
## Scope and implementation
- One bounded source fix plus regression tests in four existing files.
- Preserve ledger events, historical finance strings, pending/finished Scheduled distinctions, immutable seed, owner+AAL2, RLS, revision, history, and Card Vault.
- No styling, UI structure, deployment, production DB action or Android change.
## Verification and acceptance
- [ ] Final exact-head source CI, TypeScript, focused tests and finance validation GREEN (never weaken gates).
- [ ] Safe protected squash integration into develop; reconcile current v1.6.0 candidate and run new required exact-head release validation.
- [ ] Re-check full open PR/issue ownership and leave durable handoff if pending.
Original source roadmap counts unchanged: #588 Implementations 12/12 completed · Sub-implementations 24/24 completed; #601 Implementations 4/4 completed · Sub-implementations 8/8 completed.
