# Canonical credit-card stack integration

Source of truth: `myfinhub_credit_card_stack_production_final.html` supplied by the owner on 2026-08-23.

The supplied HTML is the canonical visual and interaction contract. This document records the production integration boundary only.

## Host page
- Route: `#/credit`
- Page: `src/pages/CreditCardPage.tsx`
- Existing card presentation being replaced on this page: `InteractivePaymentCard`
- The separate `#/cards` / `CardsPage` workspace is not the integration target and is not modified by this change.

## Real-data mapping
- `PaymentCard.id` -> canonical card `id`
- `PaymentCard.bankId` -> canonical `bankId`
- `CardBank.name` -> canonical bank/custom label
- `PaymentCard.designId` -> canonical template ID
- `PaymentCard.nickname` -> canonical card name/nickname
- `PaymentCard.kind` + `formFactor` -> canonical compact card-kind label
- `PaymentCard.network` -> canonical Visa/Mastercard rendering
- PAN/expiry -> existing `/api/card-secrets` vault through `revealCardSecret`
- CVV -> existing encrypted browser-local CVV vault through `readLocalCvv`

Demo `STACK_SELECTION` and `BANK_SECRETS` are never used in production.

## Business/presentation boundary
The canonical component owns presentation state only: active stack order, current/front card, reveal state, delete-confirm state, drag state, tilt state, ghost/restack animation, shred animation, pagination dots and live-region feedback.

The application remains authoritative for actual card records. The canonical delete interaction completes through the Credit page's existing `onArchiveCard` lifecycle callback. This removes the card from the active real-data stack while preserving the repository's current finance-history and vault lifecycle contract; this visual integration does not invent a new destructive backend operation.

## CSS parity
Only standalone demo-host `html`/`body` rules are omitted. All rules scoped under `#myfinhub-card-stack` are retained without visual reinterpretation. They are partitioned into four files solely to make repository maintenance practical; concatenating those partitions reproduces the extracted canonical scoped stylesheet byte-for-byte, SHA-256 `10cfc5eac9bf57e89157f2937af0fb2464a82fb5234e92206baad85bbafe54c7`.

Host layout adapts around the component rather than changing canonical geometry, transforms, timing, typography, branding or responsive values.
