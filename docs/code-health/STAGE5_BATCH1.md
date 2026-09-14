# Stage 5 Batch 1 — explicit legacy CSS tail ownership

This bounded checkpoint records the first Stage-5 CSS ownership migration for issue #357.

## Verified base

- `develop@d0e267790612c625b352a484cb2d79e00d4e0e42`
- tree `3612f712e6f7f72ed25794a7290e75863459320e`
- Stage 4 is complete and its post-merge CI, CodeQL and Windows Desktop barrier is green.

## Scope

The Phase-1 late compatibility tail previously reached the application through unrelated domain components:

- `AccountIban` imported `part47.css`, `part50.css` and `part52.css`;
- `AccountMetadataSettings` imported `part47.css`;
- `BankBrandMark` imported `part53.css`.

`part47.css` is itself the transitive loader for `part48`, `part49`, `part50`, `part51`, `part54`, `part55`, `part56` and the approved Loans/Credit/Lending/Recurring/Planning/Attention target styles. These rules are global compatibility presentation, not component-local ownership.

Batch 1 moves the existing late import sequence to the shared `src/styles.css` entry, after the existing `part57.css` root stack, in the preserved order `part47 → part50 → part52 → part53`. The three domain components stop loading global stylesheets as a side effect.

No CSS declaration, selector, media query or approved-target stylesheet is edited in this batch. The redundant direct `part50.css` import is intentionally retained in the explicit root sequence for parity with the existing loader graph; numeric-chain simplification belongs to a later bounded Stage-5 batch after fresh visual evidence.

## Guard

`tests/css-ownership-source.test.ts` verifies the explicit root import order, absence of the former component loader imports, and preservation of the existing `part47.css` transitive approved-style chain.

## Boundaries

No finance/accounting, auth/security, API, persistence, routing, database, Windows packaging, release, deploy or production-data behavior is changed. `main` remains untouched.
