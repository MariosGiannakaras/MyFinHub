# Stage 5 Batch 6 — Dashboard desktop fidelity CSS owner

## Verified base

- `develop@cfccbe9ed637e2300f2692dbac3928cb7646f933`
- Batch-5 post-merge integration: CI `35591065324` ✅, CodeQL `35591065346` ✅, Windows Desktop `35591065317` ✅.

## Scope

This batch names one coherent legacy numeric stylesheet without changing its contents or cascade position:

- rename `src/styles/part52.css` to `src/styles/dashboard-desktop-fidelity.css`;
- reuse the exact existing blob `6d74401895feb5aa95f83b957a560e02860ec201`;
- update the single runtime import in `src/styles/workspace-compat.css`;
- preserve its exact position after `dashboard-command-search-geometry.css` and before `part53.css`;
- update the focused ownership/approved-target source guards that assert this workspace import chain.

The stylesheet is scoped to the owner-approved Dashboard desktop fidelity pass: type scale, information density, chart-shadow treatment and the narrow 1410px+ account-body fidelity adjustment.

## Invariants

- No CSS declaration, selector, specificity, media query or theme token changes.
- No root/login CSS budget change.
- No import reordering.
- No finance/domain, auth, persistence, API/database or Windows/Desktop behavior change.
- Tests follow the semantic path only; assertions are not weakened.
- Historical inventory/checkpoint documents that describe the old graph remain historical rather than being rewritten.

## Validation

Before merge require exact-head CI, CodeQL, Cross-engine, Performance and Windows Desktop green, fresh rendered evidence inspection, and clean reviews/threads. After squash merge to `develop`, require exact-merge CI + CodeQL + Windows 3/3 before the next Stage-5 write batch.
