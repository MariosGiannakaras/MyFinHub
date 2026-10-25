# Issue #630 — active UI screenshot reconciliation plan

Owner-approved screenshots include card/finance values: do not commit those images or data. Active branch `fix/630-app-wide-screenshot-reconciliation` created from protected `develop@00a962f5231d86454b6ab9910b1ef237265ac9ed`. Current head below is the second coherent source checkpoint.

## 5 implementations / 13 sub-implementations

- [ ] **I1 App-wide desktop geometry (3)**
  - [x] Remove Transactions ledger 1560px centered cap; use width available to data workspace.
  - [ ] Reconcile shared-page desktop page width without breaking intentional bounded Dashboard.
  - [ ] Rendered desktop/tablet/mobile and Light/Dark geometry guard.
- [ ] **I2 Cards + Credit visual/interaction contract (4)**
  - [x] Use genuine provider wordmark role in both card renderers; remove white network-logo plaque, retain authentic network SVG.
  - [x] Full revealed PAN can wrap without resizing debit card; credit long PAN wraps; retain 32-digit limit and canonical vault.
  - [ ] Confirm and repair any real pointer tilt and multi-card stack failures with browser interaction evidence; preserve swipe/archive/reduced motion.
  - [ ] Harmonize card toolbar/control footprint visually while preserving keyboard and >=40px touch-area behavior on touch layouts.
- [ ] **I3 Card-details form (2)**
  - [x] Existing input formatter and server normalization already enforce 32 digits, no Luhn; strengthen shared inline/modal input containment; source lock added.
  - [ ] Direct inline/modal populated/revealed 32-digit, long labels, focus/error and responsive rendered QA.
- [ ] **I4 Dense workspaces (2)**
  - [x] Compress Settings Categories/subcategory visual padding without altering action ownership, labels, or 40px hit areas; source lock.
  - [x] Full-width desktop Transactions and semantically accurate toggleable detail icon (replaces misleading ellipsis); edit/delete remain in detail area; source lock and existing scanability suite updated.
- [ ] **I5 Dashboard hierarchy (2)**
  - [ ] Responsive account chart/privacy toolbar/metric alignment with retained meaning.
  - [ ] Compact activity/secondary KPI hierarchy, no removal of valuable finance content.

## Status and constraints
**Implementations 1/5 completed · Sub-implementations 6/13 completed** (source and focused source guards written; rendered acceptance independent). Some groups remain partial, including visual/mobile/interaction validation.

Validation/CI: not run on new head; no local checkout or browser runner available, run draft CI and inspect its result before any Ready full matrix. Important existing source/geometry guards may report real conflict; repair causes, never relax gates.
Integration: branch only; no merge. Production: untouched, no deployment. Android: untouched.
#617: owner reports category approval completed; production 20/6 re-read pending, do not claim verified.

Next: compare wide/page components and pointer/stack live QA path, collect independent defects, fix as coherent batch, then run source/draft gates and Ready complete rendered/CodeQL/WebKit/Lighthouse/Windows checks. Keep exact checkpoint and no stale counters.
