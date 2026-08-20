# Cards workspace source-of-truth contract

The user-supplied `rheomiq_cards_prototype_v15.html` is the visual and interaction source of truth for the MyFinHub Cards workspace.

Reference SHA-256: `9ab1a62287e69092e264234accd3d19532f2589e28eef1b8a0cfc54f5db773c8`.

## Preserve unless explicitly discussed

- bank-column layout, ordering and horizontal overflow behavior
- unlimited vertical card stack per bank
- card geometry, spacing, field positions and typography
- bank/card design catalog and visual themes
- saved-card toolbar, reveal and copy interactions
- add-card modal, neutral/live preview, metadata fields and design picker
- inline PAN / expiry / CVV entry on a newly created card
- slide-to-delete interaction and its placement on the card
- network marks and card-brand presentation
- responsive behavior defined by the supplied prototype

Do not redesign, simplify, replace icons, reorder controls, change card structure, or introduce alternate Cards UI patterns without an explicit user decision.

## Intentional integration differences

These differences are functional/security requirements and must not be used as justification for unrelated visual changes:

- the prototype's destructive delete interaction is backed by soft archive in MyFinHub so the same `cardId`, finance history and vault association can be restored;
- PAN and expiry persist only in the encrypted owner+AAL2 server card vault, never in ordinary FinanceData;
- CVV remains encrypted in the device/browser-local vault and is not accepted by any server persistence boundary;
- archiving does not erase the device-local CVV merely because the card is hidden; restoring the same `cardId` on the same device can reveal it again;
- credit cards use the same card presentation but have card-linked finance functionality, independent debt/limit views and card-specific purchase/payment history.

## Engineering rule

Backend, persistence, security, migration and finance logic may be changed as required while preserving this Cards presentation contract. If a functional requirement genuinely requires changing the visible Cards design or interaction model, stop and obtain an explicit product decision first.