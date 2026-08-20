# MyFinHub UI/UX Hardening Execution Plan

Tracking issue: #158
Branch: `feat/ui-ux-hardening-batch`
Draft PR: #159
Evidence map: `docs/UI_UX_AUDIT_EVIDENCE.md`

## Working rules

- One feature branch for the entire batch.
- Keep commits logically separated; do not create one branch per small fix.
- Do not change agreed visual/interaction contracts as a side effect of refactoring.
- Every task requires evidence before it is marked complete.
- Do not merge to `main`, bump release metadata, create a release, or publish a Windows installer without explicit owner approval.
- The owner explicitly directed completion of the full implementation on 2026-08-20, satisfying the Reports/Analytics implementation checkpoint. This does not authorize merge/release by itself.

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

### Phase 5 — Integrated verification
- [x] Production-like build on the last verified feature head
- [x] Full desktop + mobile regression walkthrough
- [x] All typography modes across desktop/mobile
- [ ] Console/network/runtime review on the final feature head
- [x] Automated tests on the last verified feature head
- [x] Rendered browser QA on the last verified feature head
- [x] CodeQL on the last verified feature head
- [x] Windows desktop packaging gates on the last verified feature head
- [x] Interim completion evidence added to #158
- [ ] Final feature-head CI / CodeQL / Windows gates
- [ ] Final completion evidence added to #158
- [ ] Synchronize issue #158 to all-complete and close it
- [ ] Mark PR #159 ready for review; do not merge/release without separate owner approval

## Evidence summary

### Verified application head before final runtime-gate addition

- CI run `32398526378`: success.
  - privacy/security guard passed;
  - 34 test files / 147 tests passed;
  - production build passed;
  - API TypeScript check passed;
  - all rendered browser suites passed;
  - 47 browser screenshots uploaded as artifact `9417650819`.
- CodeQL run `32398526375`: success.
- Windows Desktop run `32398526464`: success.
  - application/desktop boundary validation passed;
  - PowerShell fallback bootstrap validation passed;
  - unpacked Windows build passed;
  - packaged executable + hidden local backend smoke passed;
  - interactive NSIS setup build passed;
  - installer/update-channel checksum validation passed;
  - Windows installer evidence upload passed;
  - publish job correctly skipped because this is not a release tag.

### Coverage already proven

- full desktop and mobile route matrices;
- normal, empty and extreme/large-collection data;
- Compact / Normal / Large typography;
- authentication, persistence loading/error/conflict and page-error surfaces;
- tooltip keyboard/hover/viewport/touch behavior;
- date, text, numeric, nullable and deterministic sorting behavior;
- nested modal Escape/backdrop/focus/scroll-lock behavior;
- validation and user-facing feedback;
- card archive/restore and delete/undo/redo flows;
- form-error associations;
- reduced motion;
- representative AA text contrast;
- deterministic Reports analytics and insufficient-history behavior.

### Final delta

`scripts/ui-ux-runtime-qa.mjs` adds explicit CDP-level console/runtime/network checks, including uncaught exceptions, console errors/assertions, browser error logs, failed network loads and HTTP 5xx responses. The batch is not declared complete until this delta and the documentation synchronization pass all final-head gates.
