# RheomIQ product model — August 2026

This document records the user-approved product behavior that supersedes earlier generic frontend assumptions.

## Core principles

- RheomIQ is account-centric. The primary question is how much money is in each account, especially Payroll and Savings, not a single combined wealth number.
- Domain pages own their domain actions. Smart Entry is for generic/ad-hoc money movements, not for creating subscriptions, cards, installments, loans, etc.
- All normal mutations autosave. User-facing save feedback is transient. A recent local mutation should be undoable.
- Loading and refresh use content-shaped skeletons and keep the current route. Full-page reload is not the normal refresh behavior.
- Sensitive balances/names/details are masked by default where appropriate and reveal with an eye control.
- Greek typography and spacing must remain robust across desktop scaling; no artificial spacing inside Greek words.

## Navigation / domains

Primary domains:
- Dashboard
- Transactions
- Savings
- Cards
- Credit Card
- Installments & Loans
- Receivables / money owed by others
- Recurring / subscriptions
- Reports
- Settings

The old Smart Review flow is not a primary workflow after the refreshed legacy import. Existing review data remains compatible but review is removed from primary navigation unless explicitly needed for migration work.

## Dashboard

- Payroll and Savings balances receive the strongest visual emphasis.
- Account balances are more important than total net worth.
- Sensitive amounts are initially masked; reveal via eye button.
- Numeric balance changes animate smoothly up/down.
- Data-loading and in-place refresh use skeletons.

## Transactions

- Fast filters live at the Type and Account column headers instead of a separate generic "all accounts" control where practical.
- Credit Card is not treated as a normal bank account filter/workspace; card purchases and repayments belong to the dedicated Credit Card domain.
- Categories support a restrained category/subcategory hierarchy.

## Cards

Cards are separate from Credit Card debt/installments, but **Cards and Credit Card share one underlying `PaymentCard` identity**. A credit card created or restored from either page is the same FinanceData metadata record with the same `cardId`; there is no duplicated Credit-Card metadata object.

Bank order:
1. Piraeus
2. Revolut
3. Alpha Bank
4. Payzy
5. Viva

- Horizontal bank grouping; cards vertical within bank.
- Add-bank and add-card actions.
- Card visuals use the shared interactive visual system derived from the approved card prototype: bank-specific surfaces, design selection/live preview, subtle pointer tilt, masked fields and deliberate reveal/copy actions.
- The visual `designId` and physical/virtual form factor are non-secret presentation metadata. They do not change ledger semantics.
- Sensitive fields are masked by default and reveal only after explicit action.
- Copy controls are field-specific and disabled until the corresponding secret is explicitly revealed.
- The credit card has a shortcut to the dedicated Credit Card page.
- Only one credit card is active against the current singular credit liability model. A different credit card must not silently become a second identity for the same liability.

### Card-secret storage

Payment-card secrets never belong in the ordinary FinanceData document or normal JSON backups.

- PAN and expiry are stored only in the dedicated `rheomiq_card_secrets` server vault, encrypted with AES-256-GCM using deployment key material outside PostgreSQL.
- Server reads/writes require same-origin, authenticated owner and AAL2; the online path uses the owner's JWT plus the publishable Supabase key so RLS remains authoritative.
- CVV/CVC is never sent to the server. If saved, it uses the browser/device-local encrypted IndexedDB vault only.
- Revealed plaintext exists only in component memory while the user asks to see it.
- Explicit server-secret deletion is distinct from card archival.

### Card archival / restore

Removing a card from active use is archival/soft-delete, not destructive deletion.

- Set the shared card metadata record inactive and record the archive time.
- Never delete historical finance events, purchases, repayments, balances or other finance history as a side effect of archival.
- Never delete the PAN/expiry server-vault row as a side effect of archival, because restoring the same card must recover the same secure identity.
- The device-local CVV record is removed when the card is archived so an inactive card does not leave a locally retrievable CVV behind.
- Restoring/re-adding the same archived card reuses its original `cardId` (and vault reference), therefore linked history remains attached automatically.
- Permanently deleting PAN/expiry is a separate explicit action in the secure card editor and does not delete finance history.

## Credit Card

Dedicated Credit Card page built around the same large interactive `PaymentCard` surface used in Cards.

Current limit: EUR 500 unless changed in Settings.

Show:
- the shared card identity
- total limit
- current debt
- available limit
- utilization indicator
- purchase history
- repayment history

New card purchases and repayments carry the shared `cardId`. Pre-linkage legacy credit events remain compatible and are associated with the historical primary credit card when no explicit `cardId` exists.

Archiving the credit card must not erase or reset the liability. Existing debt and repayment capability remain available while the card is archived, but new purchases require an active card. Restoring the card returns the same identity and history.

Repayment:
- choose an eligible account from the same bank as the shared credit-card record
- subtract from that account
- reduce the singular credit-card liability by the same amount
- full repayment returns available limit to the configured limit
- repayment is not a second expense

## Installments & loans

- Separate from Cards and Credit Card.
- List layout, not a 3-column card grid.
- Progress is segmented: one segment per installment.
- Sorting is available; default sort = most installments remaining.
- Each item has a default installment amount but payment amount is editable.
- Payment is always user-triggered, never an automatic expense merely because a due date passed.
- On payment choose the source account; source may differ from the default.
- Track typical/average payment date. New items may use a manually entered first payment date until history exists.
- When total, installment amount, or installment count changes, calculate the corresponding values where the relationship is unambiguous.
- Do not expose an "accounting mode" control to the user. Internal semantics prevent double counting.
- Long-running monthly obligations can appear in recurring summaries, while short installment plans remain short-term installments.

### HELP / self-loan

Legacy HELP means borrowing temporarily from Savings when cash is insufficient.
- Represent it visually as a self-loan in Installments & Loans / obligations.
- RETURN is repayment.
- Allow forgiving/closing the debt without a money transfer when the user decides it need not be repaid.

## Savings

Savings includes distinct semantics:
- Piraeus Pay & Save rounding transfers
- explicit transfer from Payroll to Savings
- complex cash-offset savings flow that performs the agreed withdrawal/transfer combination as one user action

Pay & Save counts as savings in savings totals/statistics, not as an unrelated transfer.

## Recurring / subscriptions

- Domain-specific add/edit actions; subscriptions are not created by picking a generic category in Smart Entry.
- Preserve inactive/paused/changed/stopped subscriptions and historical records.
- Active subscriptions first; inactive ones visually muted in a separate section.
- Show total recurring obligations and upcoming payments.
- Recurring obligations are not auto-expensed. Each has a user-triggered payment action with editable amount and source-account selection.

## Categories

Support category + subcategory, using a restrained taxonomy based on legacy comments and actual transaction meaning.
Example: Vehicle -> Fuel, Service, Workshop, Parts.
Avoid taxonomy explosion.

## Reports

- Refunds do not need a headline KPI.
- Expand reports with useful account-centric and spending/savings analysis rather than vanity totals.

## Settings

- Remove the Motion preference from UI. The app uses full motion as its stored/default preference while still respecting essential accessibility behavior required by the platform/CSS.
- Backup must be directly downloadable by the user, not only created server-side with an inaccessible path.

## Period selector

- Do not show a global period selector on every page.
- Show period controls only on pages where period context is useful and follow app-specific reporting-period semantics.

## 404

Do not build a 404 only for completeness. If retained, make it deliberate, modern and privacy-safe; an optional small RheomIQ-themed interactive element can be implemented later.