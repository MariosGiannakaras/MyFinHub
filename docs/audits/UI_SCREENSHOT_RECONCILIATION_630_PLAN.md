# Issue #630 — active visual reconciliation (authoritative task branch)
Branch: `fix/630-app-wide-screenshot-reconciliation`, source baseline `develop@00a962f5231d86454b6ab9910b1ef237265ac9ed`. Draft PR [#631](https://github.com/MariosGiannakaras/MyFinHub/pull/631). Eight annotated owner screenshots are references only; financial/card data in originals must not enter Git or QA fixtures.

## Scope 5 implementations / 13 sub-implementations

- [ ] **I1 App-wide desktop geometry** (3)
  - [ ] Authored: Transactions full-width data ledger and Settings bounded 1880/1800px tab/panel desktop measure, source contracts adjusted; desktop rendered fit awaits QA
  - [ ] Shared layout alignment across Dashboard/other app pages, preserving route-specific readable maxima and finance visual hierarchy
  - [ ] Tablet/mobile + 1440/1920/2560 Light/Dark rendered overflow/geometry and keyboard QA
- [ ] **I2 Cards/Credit visual & behavior** (4)
  - [ ] Authored: provider real wordmark role for debit and credit, unframed real Visa/Mastercard SVG; direct screenshot verification pending
  - [ ] Authored: debit original-aspect revealed PAN, credit full long PAN wrapping, no 16-digit/Luhn restrictions; full 32-digit rendered QA pending
  - [ ] Authored: remove generic `.payment-card:hover` transform competing with live mouse/pen 3D tilt; existing CDP rendered debit/credit tests test hover/leave/reduced motion and multi-card stack; terminal output and screenshots pending
  - [ ] Shared visual reduction of icon action noise while preserving all management/reveal/archive commands and 40/44px mobile hit targets; rendered acceptance pending
- [ ] **I3 Card-details editor** (2)
  - [ ] Authored: form field containment while preserving existing 32 digit input formatting, 39-character presentation maximum, no Luhn and server vault
  - [ ] Actual inline/dialog full PAN+expiry+CVV/error/focus responsiveness and persistence evidence
- [ ] **I4 Dense workspaces** (2)
  - [ ] Authored: compact Settings taxonomy parent/subcategory visuals in actual route-scoped stylesheet, optional three columns wide, all toolbar actions preserved; rendered QA pending
  - [ ] Authored: Transactions full-width ledger and meaningful disclosure toggle replacing non-semantic ellipsis, detail Edit/Delete preserved; rendered functional QA pending
- [ ] **I5 Dashboard hierarchy** (2)
  - [ ] Authored: remove desktop privacy button 7px visual offset; inspect actual account chart and action alignment across key breakpoints
  - [ ] Dashboard activity/secondary KPI hierarchy without suppressing useful financial data; evidence pending

## Evidence, validation and integration
- Three source commits: `26db04bc` issuer/network/reveal, `54d10a9` finance/secure fields/source locks, `b7f3c7f` Settings real route overrides, pointer hover collision, Dashboard toolbar. A fourth checkpoint synchronizes source assertion to new real Settings geometry and this plan.
- Draft PR #631 runs narrow validation and independent CodeQL; any earlier head run is superseded by a newer source head. **No CI PASS claimed** yet.
- Existing test scripts: `scripts/cards-remediation-qa.mjs`, `credit-stack-remediation-qa.mjs`, `settings-tabs-qa.mjs`, `transactions-scanability-qa.mjs`, `shell-dashboard-hierarchy-qa.mjs`. These explicitly cover mouse tilt, stacking, clipping, Settings Light/Dark, desktop widths. Final Ready head needs complete CI + rendered, CodeQL, WebKit, Lighthouse, Windows gate, direct artifact inspection; no threshold relaxation.
- No main or production deployment, no schema/financial mutation or Android code edits. `#617`: owner reports approval of categories; independently read back production 20/6 later.
- **Implementations 0/5 completed · Sub-implementations 0/13 completed** on **acceptance criterion** (no green exact-head CI/screenshots yet). Authored code touches **9/13** subtasks, but this is not an accepted completion count.
- Next exact step: inspect draft CI/CodeQL at latest head; repair confirmed source/tests, add targeted browser assertions if needed, complete remaining geometry/toolbars/dashboard work coherently, then Ready full gates and screenshots; only merge via PR to develop after green and verified.
