# MyFinHub desktop redesign — Phase 1 scope

Phase 1 redesigns the desktop web/Windows-rendered interface. Tablet/mobile web remain regression-protected but are not separate visual redesign targets in this phase. Android is a separate project surface.

Canonical desktop review viewport is 1440 × 1000 CSS px; long pages use full-page capture at that width.

## Source precedence

When sources conflict, use this order:

1. latest explicit owner instruction for the current task;
2. current repository functionality, finance/security invariants and applicable `AGENTS.md`;
3. `IMPLEMENTATION_RULES.md` and this phase scope;
4. the exact owner-approved target for the active surface;
5. approved shared design-system/page-pattern decisions;
6. broader design-direction material and historical/current screenshots.

The approved target controls intended presentation, hierarchy and data density. It does not require literal mock values or replacement branding and does not silently override finance, persistence, security or accessibility behavior.

## Functional boundary

Preserve routes, supported actions/workflows, validation, data semantics, auth/security boundaries and responsive regression safety. Reference-only controls may be represented for the approved composition when their unsupported state is truthful, but they must not be wired to misleading handlers or introduce backend/schema/persistence behavior without explicit owner approval.

## Protected exclusion

Issue #266 is not a redesign source or tracker and must not be opened or used by this workflow.

## Delivery boundary

Routine redesign work returns to `develop` through issue-backed branches and PRs. `main` is release-only. No release/deploy or `develop -> main` promotion is authorized by a redesign implementation task alone.