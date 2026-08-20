# MyFinHub UI/UX Hardening Execution Plan

Tracking issue: #158 — reopened for post-review technical closure
Branch: `feat/ui-ux-hardening-batch`
PR: #159 — ready for review, open and unmerged
Evidence map: `docs/UI_UX_AUDIT_EVIDENCE.md`

## Working rules

- One feature branch for the entire batch.
- Keep commits logically separated; do not create one branch per small fix.
- Do not change agreed visual/interaction contracts as a side effect of refactoring.
- Every task requires evidence before it is marked complete.
- The owner directed completion of the implementation, satisfying the Reports/Analytics implementation checkpoint for the current approved scope.
- Implementation completion does not authorize merge/release. Do not merge to `main`, bump release metadata, create a release, or publish a production installer without separate explicit owner approval.

## Execution order

### Phase 0 — Baseline and inventory
- [x] Routes/pages inventory
- [x] Modal/overlay/dropdown/popover inventory
- [x] Shared/repeated UI inventory
- [x] Sorting inventory
- [x] User-message inventory
- [x] Browser QA matrix for desktop and mobile, including loading/empty/error/extreme-data states
- [x] Visual/interaction contracts recorded

### Phase 1 — Shared UI foundations
- [x] Accessible tooltip primitive and usage rules
- [x] Modal/overlay behavior primitive/contract
- [x] Shared sorting model/indicator where applicable
- [x] Typography tokens and text-size preference model
- [x] Shared feedback/message patterns where genuine duplication exists

### Phase 2 — Application-wide implementation
- [x] Tooltips / discoverability full-app pass
- [x] ASC/DESC sorting consistency implementation
- [x] Typography/readability baseline and Settings preference
- [x] Human-friendly validation/error/warning/confirmation/empty/success copy full-app pass
- [x] Duplicate UI/code refactor full-app pass without behavior regressions
- [x] Modal/overlay consistency foundation and covered flows
- [x] Accessibility/keyboard/focus full-app pass

### Phase 3 — Browser visual and interaction QA
- [x] Desktop complete walkthrough
- [x] Mobile complete walkthrough
- [x] Loading/empty/error/normal/extreme-data states
- [x] Add/edit/delete/archive/restore/undo/redo flows where available
- [x] Hover/focus/keyboard/dropdown/modal/tooltip/sort/validation flows full-app pass
- [x] Borders/artifacts/overlap/clipping/spacing/alignment/z-index/overflow/layout-shift fixes full-app pass
- [x] Rendered regression coverage updated for critical flows

### Phase 4 — Analytics / infographics
- [x] Data/metric inventory
- [x] Existing visualization audit
- [x] Proposed trend/comparison/pattern/insight model
- [x] Owner checkpoint before large visual restructure
- [x] Implement approved analytics improvements
- [x] Verify analytical correctness, insufficient-data states and mobile behavior

### Phase 5 — Initial integrated verification checkpoint
- [x] Production-like build
- [x] Full desktop + mobile regression walkthrough
- [x] All typography modes across desktop/mobile
- [x] Console/network/runtime review
- [x] Automated tests
- [x] Rendered browser QA
- [x] CodeQL
- [x] Windows desktop packaging gates
- [x] Initial visual evidence review
- [x] Initial completion evidence recorded

Initial verified implementation head: `10f757cc3b6ab4c9567e9fe0344a04accc980217`.

- CI `32401155176`: **success** — 34 test files / 147 tests, build/API checks and all rendered browser suites.
- Screenshot artifact `9418623944`: 48 files.
- CodeQL `32401155171`: **success**.
- Windows Desktop `32401155198`: **success**.

### Phase 6 — Post-review hardening

#### Browser-owned control removal
- [x] Convert remaining native selects to `AppSelectInput`
- [x] Keep application pages/components free of native `input[type=date]`
- [x] Replace Lending browser-native `<datalist>` with app-owned filtered suggestions
- [x] Add source guards preventing native select/date/datalist regressions
- [x] Harden owned-select focus, disabled-option handling and listbox ARIA linkage
- [x] Harden owned-date local-today handling and min/max keyboard navigation
- [x] Add explicit desktop/mobile CSS integration for newly converted controls

#### Credit / Reports edge cases
- [x] Preserve actual utilization above 100% in report calculations
- [x] Show actual utilization plus bounded visual progress and over-limit amount on Credit Card
- [x] Add over-limit unit regression coverage
- [x] Add dedicated Chromium Credit + Reports over-limit rendered QA
- [x] Replace ambiguous trend-direction insight icons with semantic success/warning icons

#### Repository / domain hygiene
- [x] Synchronize `STATUS.md` with verified v1.0.2 behavior
- [x] Align archive/restore copy with v1.0.2 retained-history/secret semantics
- [x] Re-review Cards/Loans/Lending/Recurring mutation paths
- [x] Prevent stale Lending account ids from being submitted
- [x] Add rendered-QA browser failover for runner CDP bootstrap failures without suppressing application failures

### Phase 7 — Final same-head verification and closure
- [ ] Privacy/security guard + complete Vitest suite
- [ ] Production build + API TypeScript check
- [ ] Owned-controls rendered Chromium QA
- [ ] Full desktop/mobile route/state UI/UX browser matrix
- [ ] Dedicated credit over-limit browser QA
- [ ] Completion QA: sorting/forms/reduced-motion/contrast
- [ ] CDP console/network/runtime QA including 4xx/5xx and failed loads
- [ ] Full-page screenshot evidence capture
- [ ] Final desktop/mobile screenshot review for overlap/clipping/layout regressions
- [ ] CodeQL on the same final head
- [ ] Windows Desktop package/NSIS/checksum gates on the same final head
- [ ] Confirm PR #159 has no unresolved review threads or change requests
- [ ] Synchronize PR #159 description with final head/test counts/runs/artifacts
- [ ] Synchronize final evidence into `docs/UI_UX_AUDIT_EVIDENCE.md` and issue #158
- [ ] Close issue #158 as completed

## Owner-gated actions after technical closure

- [ ] Decide whether to perform the optional large Reports/Analytics visual restructure
- [ ] Approve and merge PR #159
- [ ] Approve release/version metadata and production deployment/installer publication

These owner-gated actions are intentionally excluded from automatic technical closure until separately approved.
