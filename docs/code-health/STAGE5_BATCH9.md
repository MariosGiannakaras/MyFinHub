# Stage 5 Batch 9 — Named root contrast / transaction editor / category icon owners

## Verified base

- `develop@588aed1b1fffa8a91af942223ee2360cbed55806`
- Batch-8 post-merge integration: CI `36110560744` ✅, CodeQL `36110560685` ✅, Windows Desktop `36110561009` ✅.

## Scope

This batch names three coherent root/login compatibility stylesheets in one bounded change:

- `src/styles/part32.css -> src/styles/navigation-action-contrast.css`, exact blob `f1058585a369a13dc237c9f47650ada2f471ea70`;
- `src/styles/part36.css -> src/styles/transaction-split-editor.css`, exact blob `abfa9640b084f9a81f560510bb6bfc04645c6c47`;
- `src/styles/part45.css -> src/styles/category-icon-workspace.css`, exact blob `cf7a310c03a6d7453b8e28b32d9a013761441394`;
- update only their import paths in `src/styles/root-compat.css`, preserving exact positions;
- keep the complete root ownership sequence assertion and represent only these three renamed slots semantically.

## Ownership rationale

- `navigation-action-contrast.css`: rendered-QA contrast hardening for the active sidebar action and mobile command pill.
- `transaction-split-editor.css`: transfer amount, split-detail, split-line disabled-state, and legacy transaction-editor visual contract.
- `category-icon-workspace.css`: category/subcategory icon-management workspace and responsive picker layout.

## Deliberate exclusions

Numeric files with mixed ownership remain numeric in this batch, including `part33.css`, `part35.css`, `part41.css`, `part43.css`, and `part46.css`. They require later splitting or a more accurate grouped owner rather than a misleading rename.

## Invariants

- No CSS declaration, selector, specificity, media query or theme token changes.
- No root/login import reordering or load-budget change.
- No finance/accounting, auth, persistence, API/database or Windows/Desktop behavior change.
- The ownership guard keeps exact sequence coverage; assertions are not weakened.

## Validation

Before merge require exact-head CI, CodeQL, Cross-engine, Performance and Windows Desktop green, fresh rendered evidence inspection for the affected surfaces, and clean reviews/threads. After squash merge to `develop`, require exact-merge CI + CodeQL + Windows 3/3 before the next Stage-5 write batch.
