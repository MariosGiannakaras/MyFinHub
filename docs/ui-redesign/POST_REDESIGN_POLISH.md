# Post-redesign polish checkpoint

Tracker: GitHub issue #348  
Target branch: `develop` only  
Status: **ACTIVE — bounded consistency pass**

## Guardrails

- Preserve the owner-approved Phase-1 composition and finance-data presentation unless a visual change is explicitly approved.
- Preserve finance/accounting semantics, authentication/MFA/RLS, persistence, routes, APIs, database contracts and Windows behavior.
- Prefer existing shared primitives over one-off generic controls when the current class, interaction and accessibility contract can be preserved.
- Do not replace intentional domain composites merely to reduce raw HTML counts.
- Motion must remain purposeful and respect `prefers-reduced-motion`.
- No `develop -> main`, release, deploy, production migration, Auth-policy change or production-data mutation is part of this tracker.

## Consistency checklist

Use this checklist as the durable cross-app audit record. Mark a row complete only after source ownership and representative rendered behavior have both been verified where presentation can change.

| Area | Status | Current checkpoint |
| --- | --- | --- |
| Generic close actions | IN PROGRESS | `close-picker` surfaces audited; Cards and CardCreate were already canonical, Credit archive migrated to shared `IconButton` with the existing class/glyph/handler preserved. |
| Primary / secondary / destructive action hierarchy | NOT STARTED | Keep page/domain-specific controls unchanged until their current presentation and semantics are classified. |
| Page heading / right-side action alignment | NOT STARTED | Requires a cross-route audit; visual changes need approval before implementation. |
| Dialog / popover ownership, focus and Escape behavior | NOT STARTED | Existing shared `DialogShell`, owned inputs and `useModalFocus` remain the baseline. |
| Loading / success / error feedback | NOT STARTED | Audit editable flows for concise and consistent status treatment. |
| Hover / focus / pressed / disabled states | NOT STARTED | Verify shared primitives first, then only true one-off gaps. |
| Motion / reduced-motion behavior | NOT STARTED | No decorative animation additions without a clear state/causality purpose. |
| Responsive / touch targets | NOT STARTED | Recheck desktop and mobile only after bounded control changes. |

## Batch 1 — shared close-control ownership

Branch: `chore/348-shared-close-controls`

Scope:
- audit all current `close-picker` TSX surfaces;
- migrate the Credit archive close action from raw `button` to shared `IconButton`;
- retain `close-picker`, the existing × glyph, aria-label and close handler so approved presentation does not change;
- add a source contract that prevents these picker close actions from drifting back to raw buttons.

Validation target:
- repository source/unit/build/rendered/security gates required by the normal PR workflow;
- no `visual-qa/**` source change is expected from this ownership-only batch.

## Next audit slice

After Batch 1 is merged and verified on `develop`, audit page-heading/right-action patterns and remaining generic icon actions. Classify each raw control as either:
1. intentional domain composite — keep raw and document why; or
2. generic shared-control candidate — migrate only when semantics and presentation can be preserved, otherwise require an explicit visual proposal first.
