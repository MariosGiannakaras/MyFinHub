# MyFinHub UI/UX Hardening Execution Plan

Tracking issue: #158
Branch: `feat/ui-ux-hardening-batch`

## Working rules

- One feature branch for the entire batch.
- Keep commits logically separated; do not create one branch per small fix.
- Do not change agreed visual/interaction contracts as a side effect of refactoring.
- Every task requires evidence before it is marked complete.
- Do not merge to `main`, bump release metadata, create a release, or publish a Windows installer without explicit owner approval.
- A large Reports/Analytics visual restructure also requires an explicit owner checkpoint before implementation.

## Execution order

### Phase 0 — Baseline and inventory
- [ ] Routes/pages inventory
- [ ] Modal/overlay/dropdown/popover inventory
- [ ] Shared/repeated UI inventory
- [ ] Sorting inventory
- [ ] User-message inventory
- [ ] Browser QA matrix for desktop and mobile
- [ ] Visual/interaction contracts recorded

### Phase 1 — Shared UI foundations
- [ ] Accessible tooltip primitive and usage rules
- [ ] Modal/overlay behavior primitive/contract
- [ ] Shared sorting model/indicator where applicable
- [ ] Typography tokens and text-size preference model
- [ ] Shared feedback/message patterns where genuine duplication exists

### Phase 2 — Application-wide implementation
- [ ] Tooltips / discoverability
- [ ] ASC/DESC sorting consistency
- [ ] Typography/readability and Settings preference
- [ ] Human-friendly validation/error/warning/confirmation/empty/success copy
- [ ] Duplicate UI/code refactor without behavior regressions
- [ ] Modal/overlay consistency
- [ ] Accessibility/keyboard/focus improvements

### Phase 3 — Browser visual and interaction QA
- [ ] Desktop complete walkthrough
- [ ] Mobile complete walkthrough
- [ ] Loading/empty/error/normal/extreme-data states
- [ ] Add/edit/delete/archive/restore/undo/redo flows where available
- [ ] Hover/focus/keyboard/dropdown/modal/tooltip/sort/validation flows
- [ ] Borders/artifacts/overlap/clipping/spacing/alignment/z-index/overflow/layout-shift fixes
- [ ] Rendered regression coverage updated for critical flows

### Phase 4 — Analytics / infographics
- [ ] Data/metric inventory
- [ ] Existing visualization audit
- [ ] Proposed trend/comparison/pattern/insight model
- [ ] Owner checkpoint before large visual restructure
- [ ] Implement approved analytics improvements
- [ ] Verify analytical correctness, insufficient-data states and mobile behavior

### Phase 5 — Integrated verification
- [ ] Production-like build
- [ ] Full desktop + mobile regression walkthrough
- [ ] All typography modes
- [ ] Console/network/runtime review
- [ ] Automated tests
- [ ] Rendered browser QA
- [ ] CodeQL
- [ ] Windows desktop packaging gates when relevant
- [ ] Completion evidence added to #158
- [ ] Ask owner whether more features/fixes should be added before any merge/release

## Evidence log

Add concrete findings, changed files, test runs and browser-QA evidence here as the batch progresses. Do not check off tasks without evidence.
