# MyFinHub UI/UX hardening evidence

Tracking: issue #158 · PR #159 · branch `feat/ui-ux-hardening-batch`

The coordinated UI/UX hardening implementation and post-review hardening pass are technically complete. PR #159 remains open, ready for owner review and unmerged. Merge/release remains a separate owner decision.

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

## Analytics implementation and post-review edge cases

Reports hardening in `src/pages/ReportsPage.tsx` and `src/lib/reports.ts` includes headline context, previous-period comparisons, six-month trend, deterministic insights, trailing comparisons, category/subcategory concentration and momentum, recurring burden, multi-card credit utilization/drill-down, receivables, account history and savings-source breakdown without causal claims.

Post-review corrections:

- credit utilization is no longer mathematically clamped to 100%; over-limit states can report 125%, 135%, etc.;
- Credit Card shows the actual percentage and over-limit amount while keeping the visual progress fill and `aria-valuenow` bounded to 100;
- `aria-valuetext` announces the real over-limit utilization;
- Reports drill-down exposes the same actual over-limit percentage;
- generic insight arrows were replaced with semantic warning/success icons where direction alone did not express meaning;
- `tests/reports.test.ts` includes over-limit regression coverage;
- `scripts/ui-ux-credit-overlimit-qa.mjs` exercises Credit + Reports with a synthetic over-limit state and emits screenshot evidence.

## Runtime / network gate

`scripts/ui-ux-runtime-qa.mjs` performs CDP-level checks across desktop/mobile routes and auth/persistence states for uncaught runtime exceptions, `console.error`/failed assertions, browser error log entries, non-cancelled network load failures and HTTP 4xx/5xx responses with URLs.

## Rendered-QA runner resilience

GitHub runner browser bootstrap failures are treated separately from application assertions. The CI harness keeps both installed browsers available:

1. each rendered suite starts with Chromium;
2. only if the suite fails with a recognized CDP bootstrap signature, the coordinator cleans its isolated profile and retries once with system Chrome;
3. application assertion failures are never retried as browser bootstrap failures.

The final implementation run exercised this fallback: Chromium 151 failed to expose the first CDP endpoint, the isolated system-Chrome retry succeeded, and all subsequent application/browser assertions completed successfully.

## Initial verified implementation checkpoint

Initial implementation head: `10f757cc3b6ab4c9567e9fe0344a04accc980217`.

- CI `32401155176`: **success** — privacy/security guard, 34 test files / 147 tests, production build, API TypeScript check and all rendered browser suites.
- Screenshot artifact `9418623944`: **48 files**.
- CodeQL `32401155171`: **success**.
- Windows Desktop `32401155198`: **success**.

## Final verified implementation checkpoint

Final implementation head: `f444d7f8da43b784680042b691db4b2e138203dd`.
PR merge ref verified by CI: `e729b291130b1f741aa9e6b3f49693e897931ef3`.

- CI `32406108849`: **success**.
  - privacy/security guard passed across 238 tracked files;
  - **34 test files / 150 tests passed**;
  - production TypeScript/Vite build passed;
  - API TypeScript check passed;
  - base rendered frontend QA passed after the recognized Chromium bootstrap failure switched to the isolated system-Chrome fallback;
  - owned-controls rendered QA passed;
  - full desktop/mobile route-state matrix passed;
  - completion QA passed for delete/undo/redo, sorting, form association, reduced motion and representative contrast;
  - CDP runtime console/network QA passed across desktop/mobile plus auth/loading/conflict/error states;
  - dedicated credit over-limit QA passed for Credit Card and Reports;
  - full-page visual evidence QA passed.
- Screenshot artifact `9420404231`: **49 files**, SHA-256 `1c1be773a510ae85e076ce4fe05bf4210d771f0f50cd50dc401bd6586eb4d7dc`.
- The final desktop/mobile/full-page screenshots and dedicated 135% over-limit screenshot were reviewed; no new overlap, clipping, layout or responsive regression was found.
- CodeQL `32406108695`: **success**.
- Windows Desktop `32406108685`: **success** — application/desktop boundary, PowerShell fallback, unpacked build, packaged executable/backend smoke, interactive NSIS Setup, update-channel checksum and installer evidence all passed. Release publication correctly remained skipped.
- PR #159 review state at technical closure: **0 unresolved review threads and 0 submitted reviews/change requests**.
- PR #159 description is synchronized to this final implementation evidence.

This document update is closure metadata only. The implementation evidence above remains tied to `f444d7f8da43b784680042b691db4b2e138203dd`; the documentation-only closure head is required to retain green repository gates before issue #158 is closed.

## Owner-gated state

- Optional large Reports/Analytics visual restructure remains a separate owner decision.
- PR #159 remains open, ready for owner review and unmerged.
- No `main` merge, release/version bump, production deployment or production installer publication is authorized by technical closure alone.
