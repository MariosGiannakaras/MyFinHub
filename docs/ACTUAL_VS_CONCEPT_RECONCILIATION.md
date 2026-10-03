# Actual vs concept reconciliation

## Reference

The comparison uses the exact archived owner-supplied `NEW REDISIGN.png` concept (1138 × 1382, SHA-256 `973748b19f5b4cc78a65bbb3c8403ec0d4920cc00097ab4c4df66abcfe0f7642`) and the rendered QA output from the post-#441 implementation.

The concept is a visual-direction reference, not a literal product contract. Current finance semantics, accessibility, responsive behavior and the canonical routed information architecture remain authoritative.

## Project evolution and current reconciliation phase

The repository reached the current state through distinct phases that must not be collapsed:

1. **Application foundation** — the base finance application and core domain behavior were established.
2. **Functional development on `develop`** — functionality, correctness and backend behavior continued to evolve.
3. **Concept-driven UI/UX direction** — owner-supplied concept imagery introduced a new visual direction.
4. **Visual implementation and system cleanup** — the concept direction was translated into shared UI primitives, route layouts and responsive behavior.
5. **Current reconciliation/completion** — the newer UI is reconciled with the full accepted functionality, gaps exposed by the redesign are closed, and the rendered application is re-audited against the approved visual direction.
6. **Concurrent specialist workstreams** — page-specific, backend/database, provider, CI and other work may exist in parallel and must be reconciled deliberately before closeout.

The current phase is therefore **not** a blind merge of old `main` into new `develop`. `main` is the production/release baseline, while `develop` is the routine integration line. The job is to preserve accepted functionality and production compatibility while integrating newer work and closing UI/functionality gaps on the current integration state.

## Reconciliation authority

Use these sources for different questions:

| Question | Primary authority |
| --- | --- |
| What is released in production? | release-only `main` + deployed/release evidence |
| What is the routine integration baseline? | current `develop` |
| What is the newest state of an active task? | that task's live branch + explicit current plan/checkpoint |
| What behavior/accounting/security must remain correct? | `AGENTS.md`, #266 durable decisions, domain tests/invariants and accepted current functionality |
| What should the UI look/feel like? | approved concept/reference evidence + `UI_UX_SYSTEM_AUDIT.md` + current accepted visual decisions |
| Is a user-visible change complete? | integrated implementation + required automated/runtime checks + direct rendered visual inspection |

A concept can expose a better composition without knowing every current feature. When concept and functionality do not map one-to-one, keep the accepted functionality and adapt the visual composition coherently rather than deleting behavior to mimic the image.

## Parallel-workstream integration

Before integrating a concurrent branch:

1. identify the exact accepted delta and files/domain boundaries it owns;
2. compare it with current `develop` and any active integration branch;
3. detect overlapping files, migrations, API contracts, shared primitives and tracking docs;
4. reconcile the accepted delta onto the current integration head, preserving newer unrelated work;
5. do not revive superseded UI, tests, instructions or backend behavior merely because they remain on the older branch;
6. rerun the validation required by the reconciled result, not only the original branch's historical CI;
7. update the active repository plan when reconciliation adds, removes, blocks or completes material work.

For user-visible overlap, compare the reconciled result with the approved concept/reference and inspect actual generated desktop/tablet/mobile evidence. For backend/domain overlap, preserve the single canonical finance engine and security/data invariants.


## What already matches well

- persistent left navigation with one active destination;
- compact financial account cards with sparklines and direct actions;
- white/light neutral canvas with thin borders and restrained single-direction elevation;
- grouped secondary accounts;
- monthly movements, upcoming obligations, financial summary, charts and category analytics;
- compact global action cluster and period control;
- mobile bottom navigation.

## Reconciliation findings

### 1. Duplicate desktop search

**Actual:** command search appeared as a large sidebar control and again as a topbar icon.

**Concept direction:** navigation stays navigation; global actions live in the top chrome.

**Decision:** keep one desktop command-search owner in the topbar and remove the sidebar duplicate.

### 2. Quick Add displaced primary navigation

**Actual:** the desktop Quick Add button lived between the brand and sidebar navigation, pushing the navigation list lower.

**Concept direction:** the sidebar begins navigation immediately below the brand while Quick Add is a global top action.

**Decision:** move desktop Quick Add to the left side of the shared topbar. Mobile keeps the existing floating global Quick Add.

### 3. Dashboard microcopy/data was too small

**Actual:** several Dashboard captions, transaction rows, upcoming-payment metadata, category rows and KPI labels were 6.5–8 px.

**Concept direction:** dense but readable; hierarchy comes from typography and spacing, not extreme text miniaturization.

**Decision:** introduce Dashboard-local semantic type tokens and raise the smallest desktop labels to an 8.5–9.5 px compact range while preserving the existing grids/card dimensions.

### 4. Mobile Dashboard header collapsed into a narrow text column

**Actual:** the Dashboard title and description shared a row with two actions, forcing the H1 into three short lines and making the explanatory copy unusually narrow on a 375 px viewport.

**Concept/system direction:** keep the primary task/title legible first; secondary actions may wrap beneath it on narrow screens.

**Decision:** keep the shared `PageHeader`, but switch the Dashboard mobile header to a single-column hierarchy with a full-width wrapping action row. Hide the supporting Dashboard description on phone viewports so primary account content reaches the viewport earlier; the same description remains available on desktop. Lighthouse identified that paragraph as the mobile LCP element, so this also removes avoidable render delay without changing finance behavior.

## Intentionally not copied from the concept

- no reintroduction of neumorphic bilateral shadows;
- no fake/synthetic product features or account data;
- no removal of the shared PageHeader system simply because the concept Dashboard omits a conventional page title;
- no route-specific AppShell geometry;
- no duplicate controls for visual similarity;
- no changes to finance/auth/persistence behavior.

## Acceptance

- desktop shows one Quick Add and one Search entry point in the shared topbar;
- sidebar geometry/content is identical across routes;
- mobile retains one visible global Quick Add;
- Dashboard remains overflow-free and passes loading-shift/performance gates;
- rendered visual QA is reviewed at desktop/tablet/mobile before merge.
- the implemented behavior remains complete even where the concept did not depict every current control/flow;
- overlapping concurrent work is reconciled onto the current integration head rather than accepted by branch age or historical CI alone;
- final visual acceptance is based on actual rendered evidence, not only source/CSS inspection.

