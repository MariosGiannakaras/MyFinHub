# Stage 5 Batch 8 — Transactions / Quick Entry / Savings CSS owners

## Verified base

- `develop@88266ef3ee4a60d07924d301f5d5132d0945cd31`
- Batch-7 post-merge integration: CI `35889432260` ✅, CodeQL `35889432337` ✅, Windows Desktop `35889432372` ✅.

## Scope

This batch names three coherent numeric workspace-tail stylesheets in one bounded change to avoid three separate full CI cycles:

- `src/styles/part54.css -> src/styles/transactions-desktop-shell.css`, exact blob `c511f57f979ae0734fb6efb66cadc7f9e90b5d00`;
- `src/styles/part55.css -> src/styles/quick-entry-desktop-composition.css`, exact blob `42d37be54c50c613c2870fc3bb53c6a4f97c757e`;
- `src/styles/part56.css -> src/styles/savings-desktop-composition.css`, exact blob `668c1f090c8ff40237576a44b12a8bbc10388bc2`;
- update only their import paths in `src/styles/part47.css`, preserving exact order;
- update all four active source-contract guards that directly read/assert these owners; first-head CI revealed the fourth stale chain assertion in `lending-approved-target-source.test.ts`.

## Ownership rationale

- `transactions-desktop-shell.css`: owner-approved Phase-1 Transactions desktop shell/chrome treatment.
- `quick-entry-desktop-composition.css`: owner-approved Quick Entry desktop modal composition for the 1100px+ contract.
- `savings-desktop-composition.css`: owner-approved Savings desktop composition while leaving the existing responsive layout authoritative below 1100px.

## Invariants

- No CSS declaration, selector, specificity, media query or theme token changes.
- No root/login CSS budget change.
- No import reordering.
- No finance/accounting, auth, persistence, API/database or Windows/Desktop behavior change.
- Tests follow semantic paths only; assertions are not weakened.
- Mixed `part53.css` and mixed `part47.css` ownership remain untouched beyond these import path substitutions.

## Validation

Before merge require exact-head CI, CodeQL, Cross-engine, Performance and Windows Desktop green, fresh rendered evidence inspection for the affected surfaces, and clean reviews/threads. After squash merge to `develop`, require exact-merge CI + CodeQL + Windows 3/3 before the next Stage-5 write batch.
