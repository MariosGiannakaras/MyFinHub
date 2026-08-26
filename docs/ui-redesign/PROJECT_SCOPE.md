# MyFinHub UI redesign — Phase 1 scope

## Phase 1 target

Phase 1 redesigns the **desktop web/Windows-rendered MyFinHub interface only**.

The owner approves desktop UI/UX targets only during this phase.

Canonical design-review viewport:

- desktop viewport: **1440 × 1000 CSS px**;
- long pages: full-page capture at the same 1440 px viewport width.

The existing `visual-qa/` archive remains the source of current rendered evidence. Resolve the latest desktop baseline through `visual-qa/manifest.json` rather than relying on an old filename or copying screenshots into this workspace.

## Deferred surfaces

### Tablet/mobile web

Tablet and mobile web are **not redesign targets in Phase 1**.

During desktop implementation:

- preserve existing tablet/mobile functionality;
- preserve accessibility and responsive safety;
- keep applicable existing regression QA green;
- fix regressions caused by desktop work;
- do not spend Phase 1 scope creating a new mobile/tablet visual system or seeking owner approval for mobile designs.

A later project phase may deliberately adapt the completed desktop design system to tablet/mobile web.

### Android

The native Android application is a separate project and design surface. Do not redesign or implement Android from this workspace. Do not use mobile-web mockups as implicit Android targets or vice versa.

## Functional boundary

This project is a presentation/interaction redesign. Unless the owner explicitly approves a product-behavior change:

- preserve routes, data, actions, workflows and permissions;
- preserve finance/accounting semantics;
- preserve authentication/security boundaries;
- preserve validation and meaningful states;
- do not invent features from a conceptual reference image;
- do not remove functionality because it is visually inconvenient.

## Source-of-truth precedence

When sources conflict, use this order:

1. latest explicit owner instruction for the current task;
2. current repository functionality, finance/security invariants, and applicable `AGENTS.md` rules;
3. this `PROJECT_SCOPE.md` for the active redesign phase;
4. the exact owner-approved target image for the surface being implemented;
5. `DESIGN_SYSTEM.md`;
6. `PAGE_PATTERNS.md`;
7. `MASTER_PROMPT.md`;
8. the owner-supplied NEW redesign-direction image described in `references/direction/README.md`;
9. current/old screenshots as evidence of the existing presentation.

An approved image controls intended presentation. It does not silently override business logic, security, accounting semantics or an explicit later owner decision.

## Protected exclusion — META issue #266

GitHub issue **#266 (`META: Persistent MyFinHub operating rules — NEVER CLOSE`) is immutable for this redesign project.**

Neither redesign chat may:

- edit its body;
- comment on it;
- change labels/assignees/milestones;
- close/reopen it;
- supersede or consolidate it;
- use it as redesign status/tracking;
- copy temporary redesign state into it.

Ignore issue #266 as a redesign artifact. Repository workflow and implementation constraints required for the current task must be obtained from applicable checked-in repository instructions and the current task prompt instead.

## Branch/release boundary

Follow the repository delivery workflow. Routine redesign work starts from `develop` on short-lived issue-backed branches and returns to `develop` through PRs. `main` remains release-only. No redesign chat may release or deploy unless the owner explicitly requests that separate action.
