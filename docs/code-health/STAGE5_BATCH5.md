# Stage 5 Batch 5 — Dashboard command-search geometry CSS owner

## Verified base

- `develop@655c434071f501d484a7661556fc1765b90d262d`
- Batch-4 post-merge integration: CI `35527706593` ✅, CodeQL `35527706580` ✅, Windows Desktop `35527706606` ✅.

## Scope

This batch names one coherent legacy numeric stylesheet without changing its contents or cascade behavior:

- rename `src/styles/part50.css` to `src/styles/dashboard-command-search-geometry.css`;
- reuse the exact existing blob `e890a280dee2dfa8968836d2756d049048d0159c`;
- update the direct import in `src/styles/workspace-compat.css`;
- update the transitive import in `src/styles/part47.css`;
- keep both import sites in their exact current positions, including the existing compatibility redundancy;
- update only the focused ownership/Dashboard source guards that assert this import chain.

The stylesheet contains only the owner-approved desktop Dashboard command-search width geometry for the 981–1179px and 1180px+ breakpoints.

## Invariants

- No CSS declaration, selector, specificity, media query or theme token changes.
- No root/login CSS budget change.
- No import reordering and no removal of the current duplicate workspace load.
- No finance/domain, auth, persistence, API/database or Windows/Desktop behavior change.
- Tests are updated to the semantic path only; assertions are not weakened.

## Validation

Before merge require exact-head CI, CodeQL, Cross-engine, Performance and Windows Desktop green, fresh rendered evidence inspection, and clean reviews/threads. After squash merge to `develop`, require exact-merge CI + CodeQL + Windows 3/3 before the next Stage-5 write batch.
