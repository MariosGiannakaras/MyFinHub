# Stage 5 Batch 15 — Root/base semantic layer split

## Verified base

- `develop@83d6b1a751c4ffc10bc763b3dc0c2657924358ed`
- Batch-14 post-merge CI `36201674597` ✅, CodeQL `36201674663` ✅, Windows Desktop `36201674621` ✅.

## Scope

Replace the four large numeric root/base owners `part1.css`–`part4.css` with semantic owners for:

- theme/surface primitives;
- shell/navigation/persistence chrome;
- workspace headings and metric cards;
- Dashboard account/panel/insight foundations;
- transaction filters/table;
- review, savings, credit/loans, recurring, reports and settings foundations;
- Quick Entry modal/body/split presentation;
- boot motion;
- shared root responsive coordination;
- row actions, receivables/recurring tail and inline editor layout.

The review owner intentionally spans the former part2/part3 boundary so its summary and row rules remain one semantic unit while preserving the exact cascade position.

## Invariants

- All new files are contiguous slices of the verified numeric sources; no selector/declaration/value edits.
- The complete `part4.css` responsive matrix remains grouped in `root-responsive-coordination.css`; no responsive media wrapper is duplicated.
- New imports occupy the exact former `part1`–`part4` root slot in source order.
- Existing CSS bundle budgets remain unchanged.
- Source contracts follow semantic owners without weakening assertions.
- No finance/accounting, auth/MFA/RLS, persistence behavior, API/database, Windows packaging, release, deploy or production-data change.

## Validation

Require normalized source reconstruction for all four numeric inputs, repo-wide `npm run check`, and exact-head CI / CodeQL / Cross-engine / Performance / Windows. Inspect representative shell, Dashboard, Transactions, review, Savings, Credit/Loans, Recurring, Reports, Settings and Quick Entry evidence before ready/merge. After squash merge require CI + CodeQL + Windows 3/3.
