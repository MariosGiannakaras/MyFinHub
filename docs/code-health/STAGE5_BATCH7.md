# Stage 5 Batch 7 — Remaining Dashboard shell ownership

## Verified base

- `develop@6cabfbeadae0a4c1043bce76a7134814ac08b9d1`
- Batch-6 post-merge integration: CI `35796034260` ✅, CodeQL `35796034170` ✅, Windows Desktop `35796034238` ✅.

## Scope

This batch names three coherent Dashboard-only compatibility owners together so they do not each consume a separate full CI cycle:

- `src/styles/part48.css -> src/styles/dashboard-approved-target.css` using exact blob `2f15be6f35332212495081de99729b43cdcbb243`;
- `src/styles/part49.css -> src/styles/dashboard-route-shell-continuity.css` using exact blob `8527a3b96e42cc880f0ee60668ab1f8d001e43d8`;
- `src/styles/part51.css -> src/styles/dashboard-desktop-alignment.css` using exact blob `da27d1552c0eeb57715235dc8c4d300a8dfa1bea`;
- update their three import paths in `src/styles/part47.css` without changing import order;
- update the four active source-contract guards found by the develop-tree scan: CSS ownership, Lending approved target, Quick Entry approved target, and shell/Dashboard hierarchy.

## Ownership rationale

- `dashboard-approved-target.css`: owner-approved Phase-1 Dashboard target and desktop shell overrides.
- `dashboard-route-shell-continuity.css`: Dashboard active-route and route-skeleton shell continuity rules that prevent chrome/workspace jumps.
- `dashboard-desktop-alignment.css`: final owner-approved Dashboard desktop alignment, intentionally loaded after command-search geometry.

`part53.css` is deliberately excluded because it mixes global bank-brand rules with Dashboard fidelity and cannot yet be given an accurate single semantic owner.

## Invariants

- No CSS bytes change in any renamed stylesheet.
- No `part47.css` import reordering.
- No root/login CSS budget change.
- No finance/domain, auth, persistence, API/database or Windows/Desktop behavior change.
- Source guards change only the semantic paths; assertions are not weakened.
- Historical inventory/checkpoint docs may retain old numeric filenames as historical evidence.

## Validation

Before merge require exact-head CI, CodeQL, Cross-engine, Performance and Windows Desktop green, fresh Dashboard desktop/mobile evidence inspection, and clean reviews/threads. After squash merge to `develop`, require exact-merge CI + CodeQL + Windows 3/3 before the next Stage-5 write batch.
