# Stage 5 Batch 14 — Remaining small numeric owner split

## Verified base

- `develop@60c62bc14d47f9ef3b358cacf88c252d65fee550`
- Batch-13 post-merge CI `36187504193` ✅, CodeQL `36187504036` ✅, Windows Desktop `36187504422` ✅.

## Scope

1. Split `part9.css` into:
   - `mobile-more-menu-layout.css`
   - `review-semantic-table-density.css`
   - `card-history-layout.css`
2. Split `part33.css` into:
   - `owned-input-density.css`
   - `credit-overlimit-indicator.css`
   - `lending-person-suggestions.css`
3. Split `part41.css` into:
   - `reporting-period-state-overrides.css`
   - `dashboard-reconciliation-layout.css`
   - `durable-history-controls.css`
4. Split `part46.css` into:
   - `category-taxonomy-editor.css`
   - `transaction-mobile-filter-layout.css`

## Invariants

- Existing selectors, declarations, values and responsive behavior are preserved.
- Shared media blocks are separated only by selector ownership; each new owner remains adjacent at the original root cascade slot.
- Existing source guards follow semantic owners without weakening assertions.
- No finance/accounting, auth/MFA/RLS, persistence, API/database, Windows packaging, release, deploy or production-data change.

## Deferred large layers

After this batch, only the deliberately large base/card layers `part1.css`–`part4.css`, `part26.css`, and `part29.css` remain numeric.

## Validation

Run source checks first, then exact-head CI / CodeQL / Cross-engine / Performance / Windows. Inspect representative mobile-more/review/card-history, filters/lending/credit, Dashboard/history/period and taxonomy/Transactions mobile evidence before ready/merge. After squash merge, require exact-merge CI + CodeQL + Windows 3/3.
