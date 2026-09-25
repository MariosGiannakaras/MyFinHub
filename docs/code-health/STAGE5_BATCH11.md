# Stage 5 Batch 11 — First mixed-owner split

## Verified base

- `develop@478a1cae07d6363c3b32cd9fa5a7e0d8cb48c96f`
- Batch-10 post-merge CI `36144156598` ✅, CodeQL `36144156621` ✅, Windows Desktop `36144156630` ✅.

## Scope

Replace the original `part5.css` slot in-place, preserving declaration order, with:

1. `loan-action-editor.css` — loan action controls and the legacy editor wide-row rule.
2. `split-review-editor.css` — sticky split-review editor, summary and row controls.
3. `reduced-motion-contract.css` — the existing global `data-motion="reduced"` compatibility contract.

Also name two inspected coherent residual owners without changing their CSS bytes:

- `part27.css -> credit-usage-archive-security.css`
- `part53.css -> dashboard-bankmark-chart-attention.css`

## Invariants

- No CSS declaration, selector, specificity, media query, token or value changes.
- The three former `part5.css` sections remain contiguous at the same root cascade slot.
- `part27.css` and `part53.css` remain byte-identical.
- Root/login and lazy-workspace loading boundaries remain unchanged.
- No finance/accounting, auth/MFA/RLS, persistence, route/API/database, Windows packaging, release, deploy or production-data change.
- Source guards are updated without weakening assertions.

## Validation

Run narrow ownership/source checks first, then one exact-head CI / CodeQL / Cross-engine / Performance / Windows cycle and inspect fresh representative rendered evidence before merge. After squash merge to `develop`, require exact-merge CI + CodeQL + Windows 3/3.
