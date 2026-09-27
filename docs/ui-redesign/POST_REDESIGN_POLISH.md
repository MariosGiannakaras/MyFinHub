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
| Primary / secondary / destructive action hierarchy | IN PROGRESS | Batch 2 / PR #422 integrated seven class-equivalent generic actions on shared `Button`. Follow-up audit found two final `text-button` class-equivalent candidates for Batch 3; domain/composite row actions remain intentionally excluded. |
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
PR: #422  
Merged: `develop@d8f7639e27264ddc476c8e6efbcb68c307d2f500`

Audit rule:
- only migrate a raw button when its existing class hook maps exactly to an existing shared `Button` variant;
- preserve type, handler, label/content, disabled state, inline sizing and extra class hooks;
- leave raw domain/composite controls alone when adopting a shared variant would alter their class or visual contract.

Scope:
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

Validation:
- final exact-head `8ebd845319ac672113fe14cd0de428f812d155c1` passed CI `36338329001`, CodeQL `36338328995`, Cross-engine `36338328962`, Performance `36338328981` and Windows Desktop `36338328964`;
- required CI completed the full rendered matrix on the same head;
- the separate push-only Visual QA persistence workflow hit the known isolated Chromium/CDP context race in receipt OCR and failed before persistence; no generated snapshot diff remained;
- exact post-merge `develop@d8f7639e27264ddc476c8e6efbcb68c307d2f500` passed CI `36343600819`, CodeQL `36343600820` and Windows Desktop `36343600862`.

## Batch 3 — final class-equivalent generic actions

Branch: `chore/348-final-class-equivalent-actions`

Scope:
- Transactions compact delete: `text-button danger-text` -> shared ghost `Button` + `danger-text`, preserving the existing 44px minimum height, aria-label and delete handler;
- Reports account-visibility toggle: `text-button report-eye` -> shared ghost `Button` + `report-eye`, preserving `aria-pressed`, label content and toggle handler;
- add a focused source contract proving effective class ownership and retaining the desktop/domain raw row-action exclusions.

Explicit exclusions:
- Transactions desktop edit/delete icon controls;
- page/domain navigation, pagination, segmented, row-context and destructive controls whose current geometry or class contract would change under a shared primitive;
- page-heading/right-action presentation changes.

Validation target:
- one consolidated exact-head PR cycle;
- no CSS change and no intended visual, finance, auth, persistence, routing, API, database or Windows behavior change;
- generated `visual-qa/**` files must not remain in the final net diff.

## Next audit slice

After Batch 3 is merged and verified on `develop`:
1. treat the exact-class generic-action cleanup as exhausted unless a fresh audit proves another exact-compatible candidate;
2. audit page-heading/right-side action alignment across routes as a separate visual-consistency slice;
3. require an explicit visual proposal before implementing any change that alters an already approved composition, spacing, sizing or interaction treatment.
