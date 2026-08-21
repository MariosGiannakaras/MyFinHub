# Ledger foundations implementation plan

Tracker: #166  
Parent epic: #164  
Stacked PR: #171

This branch is stacked on the verified PR #159 head. It does not authorize merge, release, deployment, version changes or installer publication.

## Transfer contract

- A transfer is one `FinanceEvent(kind='transfer')` with two ordered ledger legs: negative source, positive destination.
- Source and destination must both be current non-credit accounts and must differ.
- Amount is normalized to currency cents.
- The operation is atomic because persistence/undo/redo stores the complete `FinanceData` state and the event itself owns both ledger legs.
- Transfers change per-account balances but are neutral for portfolio income, expense, category spending and net worth.
- Stale account references remain visible in history through the existing account-id fallback, but editing cannot be saved until valid current endpoints are selected.

## Split transaction contract

- A split purchase is one parent `FinanceEvent(kind='split')` with one account ledger leg and two or more category portions.
- The parent amount affects the payment account exactly once.
- Split portions are reporting dimensions, not additional balance legs.
- Manual split purchases are expense portions. Legacy review parsing may still classify mixed historical content separately.
- Allocation uses integer cents for equality checks to avoid floating-point drift.
- At least two positive parts are required and their exact cent total must equal the parent amount.
- Category analytics consume split portions exactly once while monthly expense consumes the parent total exactly once.

## UX contract

- Quick Add derives transfer defaults from current accounts rather than repository-specific account IDs.
- Same/stale transfer endpoints produce direct user-facing validation.
- Split editor reports remaining or overallocated amount live and prevents dropping below two parts.
- Transactions retain one parent row per transfer/split and expose meaningful account direction / split details.
- Desktop and narrow-mobile rendered QA exercise create/edit/delete/undo/redo and allocation feedback.

## Validation strategy while PR #159 is unmerged

PR #171 normally remains stacked on `feat/ui-ux-hardening-batch`. Because the durable Actions workflows intentionally run only for pull requests whose base is `main` or `develop`, #171 may be temporarily retargeted to `develop` solely to obtain CI/CodeQL/Windows evidence for the combined candidate state. It must be retargeted back to `feat/ui-ux-hardening-batch` after validation while #159 remains unmerged. No retarget authorizes merge.

## Verification

- Focused domain tests for transfer neutrality, atomic balances, stale endpoints, cents-safe split allocation and category totals.
- Full existing Vitest/build/API suites.
- Rendered desktop/mobile creation/edit/delete/undo/redo coverage.
- Reports regression proving internal transfers do not inflate income/expense/category analytics.
- Runtime/network, CodeQL, Windows package and screenshot/manual visual review before #166 closure.
