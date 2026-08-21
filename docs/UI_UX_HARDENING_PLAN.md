# MyFinHub UI/UX Hardening Execution Plan

Tracking: #158 + #160 · PR #159 · branch `feat/ui-ux-hardening-batch`
Evidence map: `docs/UI_UX_AUDIT_EVIDENCE.md`

## Working rules

- One feature branch for the coordinated UI/UX + analytics + branding batch.
- Keep commits logically separated and preserve established finance/business semantics.
- Every completed technical task requires automated and/or rendered evidence.
- Owner approval for the large Reports/Analytics visual restructure was granted before the #160 implementation.
- Technical completion does not authorize merge/release. Do not merge, bump release metadata, deploy production or publish an installer without separate owner approval.

## Phase 0 — Baseline and inventory
- [x] Routes/pages inventory
- [x] Modal/overlay/dropdown/popover inventory
- [x] Shared/repeated UI inventory
- [x] Sorting inventory
- [x] User-message inventory
- [x] Browser QA matrix for desktop/mobile and loading/empty/error/extreme states
- [x] Visual/interaction contracts recorded

## Phase 1 — Shared UI foundations
- [x] Accessible tooltip primitive and usage rules
- [x] Modal/overlay behavior contract
- [x] Shared sorting model/indicator
- [x] Typography tokens and persisted text-size preference
- [x] Shared feedback/message patterns

## Phase 2 — Application-wide implementation
- [x] Tooltips/discoverability pass
- [x] ASC/DESC sorting consistency
- [x] Typography/readability baseline and Settings preference
- [x] Human-friendly validation/error/warning/confirmation/empty/success copy
- [x] Duplicate UI/code refactor without behavior regressions
- [x] Modal/overlay consistency
- [x] Accessibility/keyboard/focus pass

## Phase 3 — Browser visual and interaction QA
- [x] Desktop complete walkthrough
- [x] Mobile complete walkthrough
- [x] Loading/empty/error/normal/extreme-data states
- [x] Add/edit/delete/archive/restore/undo/redo flows where available
- [x] Hover/focus/keyboard/dropdown/modal/tooltip/sort/validation flows
- [x] Borders/artifacts/overlap/clipping/spacing/alignment/z-index/overflow/layout-shift fixes
- [x] Rendered regression coverage for critical flows

## Phase 4 — Analytics correctness foundation
- [x] Data/metric inventory
- [x] Existing visualization audit
- [x] Deterministic trend/comparison/pattern/insight model
- [x] Analytical correctness and insufficient-data behavior
- [x] Multi-card credit aggregation and drill-down
- [x] Actual over-limit utilization above 100% with bounded progress semantics

## Phase 5 — Initial integrated verification checkpoint
- [x] Production-like build
- [x] Full desktop/mobile regression walkthrough
- [x] All typography modes across desktop/mobile
- [x] Console/network/runtime review
- [x] Automated tests
- [x] Rendered browser QA
- [x] CodeQL
- [x] Windows desktop packaging gates
- [x] Initial visual evidence review

Initial verified implementation head: `10f757cc3b6ab4c9567e9fe0344a04accc980217`.

- CI `32401155176`: success — 34 test files / 147 tests plus build/API/rendered suites.
- Screenshot artifact `9418623944`: 48 files.
- CodeQL `32401155171`: success.
- Windows Desktop `32401155198`: success.

## Phase 6 — Post-review hardening

### Browser-owned control removal
- [x] Convert remaining native selects to `AppSelectInput`
- [x] Keep application pages/components free of native `input[type=date]`
- [x] Replace Lending browser-native `<datalist>` with app-owned suggestions
- [x] Add source guards preventing native select/date/datalist regressions
- [x] Harden owned-select focus, disabled-option behavior and listbox ARIA linkage
- [x] Harden owned-date local-today and min/max keyboard navigation

### Credit / Reports edge cases
- [x] Preserve actual utilization above 100% in report calculations
- [x] Show actual utilization + bounded visual progress + over-limit amount on Credit Card
- [x] Add over-limit unit/rendered coverage
- [x] Replace ambiguous trend-direction insight icons with semantic status icons

### Repository / domain hygiene
- [x] Synchronize `STATUS.md` with v1.0.2 behavior
- [x] Align archive/restore copy with retained-history/secret semantics
- [x] Re-review Cards/Loans/Lending/Recurring mutation paths
- [x] Prevent stale Lending account ids from being submitted
- [x] Add rendered-QA Chromium→system-Chrome bootstrap failover without hiding application failures

## Phase 7 — #158 technical closure
- [x] Privacy/security guard + complete Vitest suite
- [x] Production build + API TypeScript check
- [x] Owned-controls rendered QA
- [x] Full desktop/mobile route/state matrix
- [x] Dedicated credit over-limit QA
- [x] Completion QA: sorting/forms/reduced-motion/contrast
- [x] CDP console/network/runtime QA
- [x] Full-page screenshot evidence
- [x] CodeQL and Windows package gates
- [x] Review-thread checkpoint
- [x] Issue #158 closure evidence

Verified #158 implementation head: `f444d7f8da43b784680042b691db4b2e138203dd`.

## Phase 8 — Owner-approved Reports visual restructure + new MyFinHub branding (#160)

### Reports / Analytics visual restructure
- [x] Owner approval for the large restructure
- [x] Executive period summary with net operational flow and savings-rate context
- [x] Comparative KPI strip
- [x] Six-month flow + deterministic insight rail
- [x] Pressure/commitment cards with accessible meters
- [x] Category analysis with list-first narrow-mobile behavior
- [x] Private account + savings-source secondary analysis
- [x] Preserve calculation semantics, insufficient-history states and >100% credit behavior
- [x] Dedicated desktop/mobile/empty/over-limit Reports browser QA

### New MyFinHub light/dark brand set
- [x] Inspect owner-supplied light/dark square and horizontal artwork
- [x] Record exact 1536px source dimensions/encoding and SHA-256 provenance
- [x] Generate transparent runtime derivatives from the supplied square artwork
- [x] Commit native light/dark 32px and 192px assets
- [x] Remove legacy RheomIQ 512 PNG runtime/canonical artwork
- [x] Add scalable light/dark 512 wrappers for PWA/canonical usage
- [x] Add one explicit `BrandMark` light/dark contract
- [x] Integrate new branding into sidebar, mobile header, Login and MFA
- [x] Keep boot compatibility path on the new light 192 asset
- [x] Update favicon, Apple touch and PWA manifest paths
- [x] Use the new dark 192 artwork for Windows setup
- [x] Generate the Windows 512 application PNG from the new light source during packaging
- [x] Guard asset dimensions/aliases/legacy-removal through tests
- [x] Add rendered light/dark + desktop/tablet/mobile branding QA

### #160 verified implementation checkpoint
- [x] Privacy/security guard + **34 test files / 151 tests**
- [x] Production TypeScript/Vite build + API TypeScript check
- [x] Full existing rendered matrix
- [x] Dedicated Reports visual QA
- [x] Dedicated branding visual QA
- [x] Runtime console/network QA
- [x] Screenshot artifact + manual visual review
- [x] CodeQL
- [x] Windows unpacked build, packaged executable/backend smoke, NSIS Setup and checksum verification

Verified implementation head: `51c222aea329464c05fa4cd4cf28a214b9919ce2`.

- CI `32455966062`: **success**.
- Screenshot artifact `9437288171`: **56 screenshots**, SHA-256 `3e5d34c9ee7eb6db4f1c0fc700550aa95566c96735114e23c843e0482de43fe6`.
- Reports visual QA passed desktop, mobile, empty and 135% over-limit states.
- Branding QA passed Login light/dark contract and desktop/tablet/mobile shell states.
- Manual screenshot review found no new overlap, clipping, horizontal overflow or responsive regression.
- CodeQL `32455966171`: **success**.
- Windows Desktop `32455966107`: **success**.

## Owner-gated actions after technical closure

- [x] Approve and implement the large Reports/Analytics visual restructure
- [ ] Approve and merge PR #159 — **NOT YET APPROVED**
- [ ] Approve release/version metadata and production deployment/installer publication — **NOT YET APPROVED**

Only the final two unchecked owner gates remain outside technical closure.
