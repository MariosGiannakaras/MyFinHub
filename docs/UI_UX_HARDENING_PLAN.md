# MyFinHub UI/UX Hardening Execution Plan

Tracking issue: #158
Branch: `feat/ui-ux-hardening-batch`
Draft PR: #159

## Working rules

- One feature branch for the entire batch.
- Keep commits logically separated; do not create one branch per small fix.
- Do not change agreed visual/interaction contracts as a side effect of refactoring.
- Every task requires evidence before it is marked complete.
- Do not merge to `main`, bump release metadata, create a release, or publish a Windows installer without explicit owner approval.
- A large Reports/Analytics visual restructure also requires an explicit owner checkpoint before implementation.

## Execution order

### Phase 0 — Baseline and inventory
- [x] Routes/pages inventory
- [x] Modal/overlay/dropdown/popover inventory
- [x] Shared/repeated UI inventory
- [x] Sorting inventory
- [ ] User-message inventory
- [ ] Browser QA matrix for desktop and mobile, including loading/empty/error/extreme-data states
- [x] Visual/interaction contracts recorded

### Phase 1 — Shared UI foundations
- [x] Accessible tooltip primitive and usage rules
- [x] Modal/overlay behavior primitive/contract
- [x] Shared sorting model/indicator where applicable
- [x] Typography tokens and text-size preference model
- [ ] Shared feedback/message patterns where genuine duplication exists

### Phase 2 — Application-wide implementation
- [ ] Tooltips / discoverability full-app pass
- [x] ASC/DESC sorting consistency implementation
- [x] Typography/readability baseline and Settings preference
- [ ] Human-friendly validation/error/warning/confirmation/empty/success copy full-app pass
- [ ] Duplicate UI/code refactor full-app pass without behavior regressions
- [x] Modal/overlay consistency foundation and covered flows
- [ ] Accessibility/keyboard/focus full-app pass

### Phase 3 — Browser visual and interaction QA
- [ ] Desktop complete walkthrough
- [ ] Mobile complete walkthrough
- [ ] Loading/empty/error/normal/extreme-data states
- [ ] Add/edit/delete/archive/restore/undo/redo flows where available
- [ ] Hover/focus/keyboard/dropdown/modal/tooltip/sort/validation flows full-app pass
- [ ] Borders/artifacts/overlap/clipping/spacing/alignment/z-index/overflow/layout-shift fixes full-app pass
- [x] Rendered regression coverage updated for critical flows

### Phase 4 — Analytics / infographics
- [x] Data/metric inventory
- [x] Existing visualization audit
- [ ] Proposed trend/comparison/pattern/insight model
- [ ] Owner checkpoint before large visual restructure
- [ ] Implement approved analytics improvements
- [ ] Verify analytical correctness, insufficient-data states and mobile behavior

### Phase 5 — Integrated verification
- [x] Production-like build on current verified feature head
- [ ] Full desktop + mobile regression walkthrough
- [ ] All typography modes across desktop/mobile
- [ ] Console/network/runtime review
- [x] Automated tests
- [x] Rendered browser QA
- [x] CodeQL
- [x] Windows desktop packaging gates when relevant
- [x] Interim completion evidence added to #158
- [ ] Final completion evidence added to #158
- [ ] Ask owner whether more features/fixes should be added before any merge/release

## Evidence log

### Verified feature-head evidence

- CI run `32358199281`: success.
  - privacy/security guard passed;
  - 32 test files / 137 tests passed;
  - production build passed;
  - API TypeScript check passed;
  - existing rendered frontend QA passed;
  - mobile redesign fidelity QA passed;
  - owned-control QA passed;
  - UI/UX hardening browser QA passed;
  - screenshot evidence upload passed.
- CodeQL run `32358199313`: success.
- Windows Desktop run `32358199272`: success.
  - application/desktop boundary validation passed;
  - PowerShell fallback bootstrap validation passed;
  - unpacked Windows build passed;
  - packaged executable + hidden local backend smoke passed;
  - interactive NSIS setup build passed;
  - installer/update-channel checksum validation passed;
  - Windows installer evidence upload passed;
  - publish job correctly skipped because this is not a release tag.
- Browser QA currently covers real Chrome tooltip hover/keyboard semantics, viewport-edge containment, Transactions/Loans ASC-DESC behavior, Large text mode, nested overlay Escape behavior, parent-modal Escape, backdrop close, scroll lock, 375px card fit and 320/375px mobile overflow screenshots.
- Reports credit analytics were corrected to account for the actual multi-card portfolio and are protected by regression coverage in `tests/reports.test.ts`.

Do not mark the remaining full-app audit tasks complete until their route/state matrix has concrete evidence.