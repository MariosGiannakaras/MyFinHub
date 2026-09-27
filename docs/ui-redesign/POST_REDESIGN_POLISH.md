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
| Generic close actions | COMPLETE | Batch 1 / PR #421 merged to `develop@26379521`. All current `close-picker` surfaces use shared `IconButton`; class, glyph, handler and accessibility contracts were preserved. Exact post-merge CI, CodeQL and Windows Desktop are green. |
| Primary / secondary / destructive action hierarchy | IN PROGRESS | Exact canonical-class audit found seven generic raw actions that can move to shared `Button` with identical `save-button`, `secondary` or `text-button` hooks. Raw domain/composite `.danger` controls remain intentionally excluded. |
| Page heading / right-side action alignment | NOT STARTED | Requires a cross-route audit; visual changes need approval before implementation. |
| Dialog / popover ownership, focus and Escape behavior | NOT STARTED | Existing shared `DialogShell`, owned inputs and `useModalFocus` remain the baseline. |
| Loading / success / error feedback | NOT STARTED | Audit editable flows for concise and consistent status treatment. |
| Hover / focus / pressed / disabled states | NOT STARTED | Verify shared primitives first, then only true one-off gaps. |
| Motion / reduced-motion behavior | NOT STARTED | No decorative animation additions without a clear state/causality purpose. |
| Responsive / touch targets | NOT STARTED | Recheck desktop and mobile only after bounded control changes. |

## Batch 1 — shared close-control ownership

Branch: `chore/348-shared-close-controls`  
PR: #421  
Merged: `develop@26379521f26a4d22c187474a355cebaf601c4945`

Scope:
- audited all current `close-picker` TSX surfaces;
- migrated the Credit archive close action from raw `button` to shared `IconButton`;
- retained `close-picker`, the existing × glyph, aria-label and close handler;
- added a source contract that prevents those picker close actions from drifting back to raw buttons.

Validation:
- final clean PR head: `878442b2de5a6735087a5eb921770b47f081bfa2`;
- final clean tree: `6c0f25eb3e1f7e21fcb8fc34391f5a29d380c408`;
- squash-merge tree is identical to the validated final clean tree;
- final-head CI `36335581653`, CodeQL `36335581669`, Cross-engine `36335581655`, Performance `36335581703` and Windows Desktop `36335581715` passed;
- runtime-equivalent Visual QA persistence `36329983900` passed; generated `visual-qa/**` refresh was removed from the net PR diff;
- representative fresh Credit mobile evidence was inspected with no obvious geometry, spacing or shared-control regression;
- exact post-merge CI `36337353390`, CodeQL `36337353444` and Windows Desktop `36337353473` passed.

## Batch 2 — canonical generic action ownership

Branch: `chore/348-canonical-generic-actions`

Audit rule:
- only migrate a raw button when its existing class hook maps exactly to an existing shared `Button` variant;
- preserve type, handler, label/content, disabled state, inline sizing and extra class hooks;
- leave raw domain/composite controls alone when adopting a shared variant would alter their class or visual contract.

Current scope:
- App session retry: `secondary` -> shared secondary `Button`;
- Quick Entry split-part add: `text-button` -> shared ghost `Button`;
- Receipt Inbox selected-delete: `text-button danger` -> shared ghost `Button` + `danger`;
- Receipt Inbox single-delete: `secondary danger` -> shared secondary `Button` + `danger`;
- Cards archive restore: `save-button` -> shared primary `Button`;
- Planning scheduled completion: `save-button compact` -> shared primary `Button` + `compact`;
- Transactions edit: `text-button` -> shared ghost `Button`, preserving the existing 44px minimum height and aria-label.

Explicit exclusions:
- Cards permanent-delete raw `.danger`;
- Planning cancellation raw `.danger`;
- Transactions delete raw `.danger`;
- Receipt draft-row selection composite;
- QA-only controls.

Validation target:
- one consolidated PR validation cycle after all Batch-2 implementation and source-contract changes are present;
- no CSS change and no intended visual, finance, auth, persistence, routing, API, database or Windows behavior change;
- generated Visual QA persistence, if produced by the workflow, must be cleaned from the final net diff after evidence inspection.

## Next audit slice

After Batch 2 is merged and verified on `develop`:
1. classify remaining raw action controls whose classes do not map exactly to shared variants; migrate only when presentation can be preserved;
2. audit page-heading/right-side action alignment across routes as a separate visual-consistency slice;
3. require an explicit visual proposal before implementing any change that alters an already approved composition, spacing, sizing or interaction treatment.
