# Time-aware finance implementation plan

Tracker: #167  
Parent epic: #164  
Stacked PR: #172  
Base dependency: verified ledger foundations PR #171.

## Scheduled one-off transaction contract

- Scheduled Transactions are one-off plans and are stored separately from actual `FinanceEvent` records and recurring templates.
- Stored lifecycle is `pending | completed | skipped | cancelled`.
- `upcoming` and `due` are derived from `dueDate` + the current local date; no background mutation is required when a date passes.
- A pending item never affects `accountBalances`, actual monthly flow, Reports or category spending.
- Completion is one atomic `FinanceData` mutation: the scheduled record is marked completed and exactly one actual `FinanceEvent` is posted.
- Completion can override the actual date, amount and account(s) without rewriting the original scheduled date/amount.
- Edit is available only while pending. Skip/cancel are non-destructive audit states.
- Stale account references remain visible in history, but posting/editing requires current valid account endpoints.
- Scheduled internal transfers use the ledger-foundations transfer contract and remain portfolio-neutral.

## Deterministic forecast contract

Forecast horizon is explicitly 30, 60 or 90 days.

Known inputs only:
1. Current non-credit internal account balances as of today.
2. Pending scheduled one-off transactions within the horizon.
3. Active recurring items with a known/derivable due day and valid account.
4. Remaining external loan installments with known/derivable payment day and valid payment account.
5. Already-posted actual `FinanceEvent` records dated after today and within the horizon.

Rules:
- No unknown discretionary spending, salary changes, probabilistic behavior or causal inference is invented.
- Internal transfers change per-account trajectories but have zero portfolio delta.
- Self-loans without an explicit destination account are omitted instead of being misclassified as portfolio outflow.
- Invalid/stale account references and obligations without enough date information are omitted and surfaced as explicit assumptions/omissions.
- The UI exposes current/projected/minimum portfolio liquidity, per-account current/projected/minimum balances, first low-balance date (<100€ deterministic threshold) and first negative-balance date.
- Any chart has an accessible text alternative.
- An insufficient-data state says that the projection is flat because no known future flows are available; it never implies certainty.

## Persistence / migration

The existing schema-v3 JSON remains backwards compatible because `state.scheduled` is an optional additive field. `migrateProductData` explicitly preserves it in the same way as post-v3 Cards metadata. Existing data loads with `scheduled: []`.

The existing full-state update queue, revision conflict handling, and bounded undo/redo apply unchanged. Scheduled completion deliberately performs both scheduled-state and event-state changes inside one update recipe.

## Verification plan

- Focused unit tests: lifecycle derivation, no pre-post balance effect, completion, migration preservation, transfer neutrality, recurring/loan inputs, skip/cancel exclusion, stale-data omissions.
- Dedicated rendered QA: 30/60/90 control, create without balance effect, completion, atomic undo/redo, skip/cancel history, modal focus/Escape, negative forecast state, empty state, mobile no-overflow, console/network checks.
- Full existing privacy guard, Vitest, production build and API TypeScript.
- Full rendered browser chain on primary Chromium.
- CodeQL and Windows package/NSIS/checksum gate.
- Screenshot artifact download + manual visual review.

No merge, release, deployment, version bump or installer publication is authorized by this plan.
