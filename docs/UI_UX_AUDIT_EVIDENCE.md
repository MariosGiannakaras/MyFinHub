# MyFinHub UI/UX hardening evidence

Tracking: issues #158 and #160 · PR #159 · branch `feat/ui-ux-hardening-batch`

The coordinated application-wide UI/UX hardening, post-review hardening, approved Reports/Analytics visual restructure, and new MyFinHub branding integration are technically complete. PR #159 remains open, ready for owner review and unmerged. Merge/release remains a separate owner decision.

## Surface inventory

Application routes covered by the rendered matrix:

- Dashboard
- Transactions
- Review
- Savings
- Cards
- Credit Card
- Loans
- Lending / receivables
- Recurring
- Reports
- Settings

Additional surfaces covered separately:

- Login
- MFA challenge
- MFA enrollment
- Quick Entry
- persistence loading/error/conflict feedback
- page error boundary
- modal/dialog overlays and owned select/date popovers
- MyFinHub desktop/tablet/mobile branding lockups
- explicit light/dark brand variant switching
- Windows setup / packaged application branding pipeline

## User-facing copy inventory

The copy audit covers field/dialog validation, authentication/MFA errors, persistence recovery, destructive confirmations, action success, empty/insufficient-data states, error-boundary fallback copy and card-vault/client failures.

Implementation contracts:

- `src/lib/userMessage.ts` rejects technical exception/API/stack-style text before it can become user-visible and provides actionable fallback copy.
- `src/components/FormError.tsx` provides the shared announced form-error surface.
- `tests/user-message-source.test.ts` blocks known internal jargon and direct raw `Error.message` exposure in UI source.
- rendered QA verifies representative validation, authentication, persistence and error-boundary copy in the browser.

## Shared UI / duplicate-code audit

Consolidated contracts:

- `src/components/Tooltip.tsx` — accessible tooltip;
- `src/components/AppSelectInput.tsx` — app-owned listbox selector;
- `src/components/AppDateInput.tsx` — app-owned calendar selector;
- `src/components/FormError.tsx` — announced form error;
- `src/components/SortDirectionControl.tsx` — explicit ASC/DESC control;
- `src/components/ReadabilitySettings.tsx` — persisted text-size control;
- `src/components/BrandMark.tsx` — single theme-ready MyFinHub light/dark brand contract;
- `src/hooks/useModalFocus.ts` — focus trap, Escape, focus return and scroll lock;
- `src/lib/userMessage.ts` — user-safe error normalization.

`tests/shared-ui-source.test.ts` guards shared contracts. `tests/owned-controls-source.test.ts` blocks native `<select>`, native `input[type=date]` and `<datalist>` inside application pages/components.

## Post-review browser-owned control hardening

Browser/OS-owned surfaces found during the deeper PR review were removed rather than visually patched:

- Transactions desktop column filters use `AppSelectInput`;
- Transactions mobile filters use `AppSelectInput`;
- Review split editor selectors use `AppSelectInput`;
- Settings default-account selectors use `AppSelectInput`;
- Card creation selectors use owned controls;
- Lending no longer uses browser-native `<datalist>`; known people are app-rendered filtered suggestions while free-text entry remains supported;
- application pages/components are source-guarded against reintroducing native select/date/datalist controls.

Focus/accessibility hardening:

- preferred modal focus targets must be focusable and enabled;
- Tab recovers focus inside the topmost modal if focus starts outside it;
- owned select `aria-controls` points to the actual listbox;
- a disabled selected placeholder cannot become the initial focus target;
- owned-date “today” uses local calendar date rather than UTC date;
- date keyboard navigation refuses destinations outside `min`/`max` and never focuses disabled cells.

Rendered owned-control QA verifies Quick Entry, Savings, Credit, Loans, Lending, Recurring, Cards creation, Transactions filters and Settings defaults, including nested listbox focus/ARIA/focus-return behavior.

## Tooltip / discoverability evidence

The desktop route matrix rejects visible unnamed controls and icon-only workspace actions without a tooltip/hint or explicit close-control exception. Browser checks verify keyboard `aria-describedby`, `role="tooltip"`, viewport containment and mobile/touch suppression of sticky visual bubbles while retaining accessible names.

## Sorting evidence

- Transactions: date ASC/DESC with `aria-sort` and deterministic ID tie-break.
- Loans: text, numeric amount, nullable usual-day/date value and deterministic tie behavior.
- Credit purchases/repayments: explicit direction controls and deterministic ordering.
- Empty datasets remain valid under the route/state matrix.

## Typography / readability evidence

- coherent text-size tokens and line-height/readability overrides are application-wide;
- Compact, Normal and Large persist through Settings;
- rendered QA measures actual computed typography on desktop/mobile;
- mobile form controls avoid sub-16px text where browser zoom would be harmful.

## Browser visual/state matrix

`ui-ux-hardening-qa.mjs` covers every route with normal, empty, extreme/long-string/large-collection, Compact and Large typography states across desktop/mobile. It checks overflow, unnamed controls, icon-action discoverability, mobile target sizing and runtime errors.

Interaction suites additionally cover Quick Entry, owned editors, sorting, validation, modal Escape/backdrop/focus/scroll-lock behavior, card archive/restore, delete/undo/redo, persistence recovery, error boundaries and representative destructive/action flows.

## Accessibility evidence

- keyboard focus and modal focus return/trapping;
- visible focus styling through shared controls;
- accessible names for icon controls;
- `aria-sort` for sorted tables;
- form errors associated via `aria-describedby`/`aria-invalid`;
- representative text contrast at or above 4.5:1;
- mobile interactive-target floor checks;
- reduced-motion compatibility;
- chart text alternatives where visual charts are hidden from assistive technology.

## Reports / Analytics implementation

The owner-approved large Reports/Analytics restructure is implemented in `src/pages/ReportsPage.tsx`, `src/lib/reports.ts` and `src/styles/part34.css`.

The resulting hierarchy includes:

1. executive health strip with net flow, savings rate and period comparisons;
2. current-period KPI group;
3. primary trend/comparison area paired with deterministic insight rail;
4. commitments/liquidity pressure cards for recurring burden, multi-card credit and receivables;
5. category momentum section with chart/list responsive behavior;
6. account-balance and savings-source drill-down.

The implementation preserves deterministic calculations, explicit insufficient-history states, non-causal language, chart text alternatives and privacy-controlled balance visibility. Mobile switches dense category analysis to a list-first presentation instead of squeezing the desktop chart.

Post-review correctness corrections remain part of this surface:

- credit utilization is not mathematically clamped to 100%; over-limit states can report 125%, 135%, etc.;
- Credit Card shows the actual percentage and over-limit amount while keeping the visual progress fill and `aria-valuenow` bounded to 100;
- `aria-valuetext` announces the real over-limit utilization;
- Reports drill-down exposes the same actual over-limit percentage;
- generic insight arrows were replaced with semantic warning/success icons where direction alone did not express meaning;
- `tests/reports.test.ts` includes over-limit regression coverage;
- `scripts/ui-ux-credit-overlimit-qa.mjs` exercises Credit + Reports with a synthetic over-limit state;
- `scripts/reports-visual-qa.mjs` verifies desktop hierarchy, mobile hierarchy, empty state and over-limit semantics.

## MyFinHub branding implementation

Issue #160 supplied four new source images. The client upload names used `.png`, but the source byte streams are JPEG/JFIF with no alpha channel. Recorded native source provenance:

- light square — 1536×1536 — SHA-256 `7ea970d91a5d0a01eaec49b8546e6d555ae60ea099644bc6c7265aabcf6c3a02`;
- dark square — 1536×1536 — SHA-256 `02466161914d0836bb8336a043e402583751f5569ec360bf135d6bf0df059dc0`;
- light horizontal wordmark — 1536×512 — SHA-256 `a82df276af4a5319daf2259ff8e51f6b660444699bea04b432b18eb122e7e69a`;
- dark horizontal wordmark — 1536×512 — SHA-256 `8e3c3236ebd972d017de2c273623486e52ef8deb364c5b9e5b91a62047093d5d`.

Runtime integration uses canonical light/dark 32px and 192px derivatives plus scalable 512 wrappers for PWA/canonical use. The old RheomIQ 512 PNG runtime/canonical assets were removed. `BrandMark` renders both light/dark assets and switches through explicit `html[data-theme="light|dark"]`, preventing an OS preference from independently switching the logo on a still-light application surface.

The shared brand contract is used on sidebar, mobile header, Login and MFA; boot compatibility paths point to the new MyFinHub asset set. Favicon, Apple touch and manifest paths were updated. Windows packaging generates a true 512×512 PNG from the new MyFinHub light 192px source with the existing PowerShell/System.Drawing pipeline before Electron packaging.

`scripts/brand-visual-qa.mjs` verifies:

- both light/dark assets load at the expected native 192px width;
- explicit theme switching reaches the final correct opacity state;
- Login has no horizontal overflow;
- desktop lockup remains contained;
- the 88px tablet sidebar collapses to icon-only branding without overflow;
- mobile branding fits the header allocation.

## Runtime / network gate

`scripts/ui-ux-runtime-qa.mjs` performs CDP-level checks across desktop/mobile routes and auth/persistence states for uncaught runtime exceptions, `console.error`/failed assertions, browser error log entries, non-cancelled network load failures and HTTP 4xx/5xx responses with URLs.

## Rendered-QA runner resilience

GitHub runner browser bootstrap failures are treated separately from application assertions. The CI harness keeps both installed browsers available:

1. each rendered suite starts with Chromium;
2. only if the suite fails with a recognized CDP bootstrap signature, the coordinator cleans its isolated profile and retries once with system Chrome;
3. application assertion failures are never retried as browser bootstrap failures.

This separation is important: the branding QA initially exposed only a test-timing error — it sampled a 150ms CSS opacity transition after 80ms. The assertion was corrected to observe the completed transition; no application defect was hidden or bypassed.

## Historical verified checkpoints

Initial implementation head: `10f757cc3b6ab4c9567e9fe0344a04accc980217`.

- CI `32401155176`: **success** — privacy/security guard, 34 test files / 147 tests, production build, API TypeScript check and all rendered browser suites.
- Screenshot artifact `9418623944`: **48 files**.
- CodeQL `32401155171`: **success**.
- Windows Desktop `32401155198`: **success**.

Post-review hardening checkpoint: `f444d7f8da43b784680042b691db4b2e138203dd`.

- CI `32406108849`: **success** — 34 test files / 150 tests plus build/API/rendered gates.
- Screenshot artifact `9420404231`: **49 files**.
- CodeQL `32406108695`: **success**.
- Windows Desktop `32406108685`: **success**.

## Verified Reports + branding implementation checkpoint

Implementation head: `51c222aea329464c05fa4cd4cf28a214b9919ce2`.
PR merge ref verified by CI: `917666d4c934906f4f0b38bcbba286ac685e9a20`.

- CI `32455966062`: **success**.
  - privacy/security guard passed across 253 tracked files;
  - **34 test files / 151 tests passed**;
  - production TypeScript/Vite build passed;
  - API TypeScript check passed;
  - base rendered frontend QA passed;
  - owned-controls rendered QA passed;
  - full desktop/mobile route-state matrix passed;
  - completion QA passed for delete/undo/redo, sorting, form association, reduced motion and representative contrast;
  - CDP runtime console/network QA passed across desktop/mobile plus auth/loading/conflict/error states;
  - dedicated credit over-limit QA passed for Credit Card and Reports;
  - dedicated Reports visual QA passed for desktop, mobile, empty and over-limit states;
  - dedicated MyFinHub branding visual QA passed for light/dark Login, desktop shell, collapsed tablet sidebar and mobile shell;
  - full-page visual evidence QA passed.
- Screenshot artifact `9437288171`: **56 files**, SHA-256 `3e5d34c9ee7eb6db4f1c0fc700550aa95566c96735114e23c843e0482de43fe6`.
- Manual review of all 56 screenshots found no new overlap, clipping, horizontal overflow or responsive regression. Branding remained clean across Login/MFA and desktop/tablet/mobile shell states; the restructured Reports hierarchy remained readable on desktop/mobile and preserved the 135% over-limit state.
- CodeQL `32455966171`: **success**.
- Windows Desktop `32455966107`: **success** — application/desktop boundary, PowerShell fallback, generated 512×512 MyFinHub icon path, unpacked build, packaged executable/backend smoke, interactive NSIS Setup, checksum and installer evidence all passed. Release publication remained skipped because this was not a release tag.

## Documentation closure state

After the verified implementation checkpoint, `STATUS.md`, `docs/ANALYTICS_HARDENING_PROPOSAL.md`, `docs/UI_UX_HARDENING_PLAN.md` and this evidence record were synchronized to the approved Reports/branding scope. These are documentation-only closure changes. The final documentation head must retain green CI, CodeQL and Windows Desktop gates before issue #160 is closed.

## Owner-gated state

- PR #159 remains open, ready for owner review and unmerged.
- Merge of PR #159 is **not** authorized by technical closure.
- No release/version bump, production deployment or production installer publication is authorized by technical closure alone.
