# Stage 5 Batch 12 — Skeleton and workspace owner split

## Verified base

- `develop@072665a4b391b85ef4355fa3ad28226cc9160962`
- Batch-11 post-merge CI `36158915409` ✅, CodeQL `36158915229` ✅, Windows Desktop `36158915239` ✅.

## Scope

Split two remaining mixed numeric CSS owners behind their existing compatibility slots:

1. `part42.css`
   - `shortcut-history-controls.css` — shortcut chips, keyboard-shortcut reference, readable history controls and wide-action touch target.
   - `route-skeleton-system.css` — route-shaped skeleton visuals, responsive layouts and reduced-motion skeleton contract.
2. `part47.css`
   - `approved-workspace-targets.css` — the existing transitive approved-target import chain.
   - `account-metadata-surfaces.css` — IBAN/account metadata presentation and responsive rules.

## Invariants

- No selector, declaration, value, token or finance/domain behavior change.
- The new files occupy the same relative root/workspace cascade slots as the numeric owners they replace.
- The lazy workspace boundary remains `workspace-compat.css`; QA loads the approved chain and account metadata before `qa.tsx` in the same order.
- Source guards follow semantic paths without removing assertions.
- No auth/MFA/RLS, persistence, API/database, Windows packaging, release, deploy or production-data change.

## Validation

Run source checks first, then one exact-head CI / CodeQL / Cross-engine / Performance / Windows cycle. Inspect fresh representative skeleton, Dashboard/account-metadata and approved-workspace rendered evidence before ready/merge. After squash merge, require exact-merge CI + CodeQL + Windows 3/3.
