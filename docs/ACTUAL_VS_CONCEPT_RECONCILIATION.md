# Actual vs concept reconciliation

## Reference

The comparison uses the exact archived owner-supplied `NEW REDISIGN.png` concept (1138 × 1382, SHA-256 `973748b19f5b4cc78a65bbb3c8403ec0d4920cc00097ab4c4df66abcfe0f7642`) and the rendered QA output from the post-#441 implementation.

The concept is a visual-direction reference, not a literal product contract. Current finance semantics, accessibility, responsive behavior and the canonical routed information architecture remain authoritative.

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
