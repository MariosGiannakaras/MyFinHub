# MyFinHub UI/UX hardening evidence

Tracking: issue #158 · PR #159 · branch `feat/ui-ux-hardening-batch`

The coordinated UI/UX hardening implementation has entered final post-review verification. Issue #158 is reopened only for same-head technical closure; PR #159 remains open, ready for review and unmerged. Merge/release remains a separate owner decision.

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

`tests/shared-ui-source.test.ts` guards shared contracts. `tests/owned-controls-source.test.ts` now also blocks native `<select>`, native `input[type=date]` and `<datalist>` inside application pages/components.

## Post-review browser-owned control hardening

The deeper PR review found browser/OS-owned surfaces that remained after the first implementation checkpoint. They were removed rather than visually patched:

- Transactions desktop column filters now use `AppSelectInput`;
- Transactions mobile filters now use `AppSelectInput`;
- Review split editor selectors now use `AppSelectInput`;
- Settings default-account selectors now use `AppSelectInput`;
- Card creation selectors use owned controls;
- Lending no longer uses browser-native `<datalist>`; known people are app-rendered filtered suggestions while free-text entry remains supported;
- application pages/components are source-guarded against reintroducing native select/date/datalist controls.

Focus/accessibility hardening added during the same pass:

- preferred modal focus targets must be focusable and enabled;
- Tab recovers focus inside the topmost modal if focus starts outside it;
- owned select `aria-controls` points to the actual listbox;
- the selected disabled placeholder cannot become the initial focus target;
- owned-date “today” uses local calendar date rather than UTC date;
- date keyboard navigation refuses destinations outside `min`/`max` and never focuses disabled cells.

Rendered owned-control QA covers listbox focus, ARIA linkage and focus restoration.

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

GitHub runner browser bootstrap failures are treated separately from application assertions. The CI harness now keeps both installed browsers available:

1. each rendered suite starts with Chromium;
2. only if the suite fails with a recognized CDP bootstrap signature, the coordinator cleans its isolated profile and retries once with system Chrome;
3. application assertion failures are never retried as browser bootstrap failures.

This addresses intermittent Chromium 151 CDP startup failures without suppressing UI/runtime defects.

## Initial verified implementation checkpoint

Initial implementation head: `10f757cc3b6ab4c9567e9fe0344a04accc980217`.

- CI `32401155176`: **success** — privacy/security guard, 34 test files / 147 tests, production build, API TypeScript check and all rendered browser suites.
- Screenshot artifact `9418623944`: **48 files**.
- CodeQL `32401155171`: **success**.
- Windows Desktop `32401155198`: **success**.

## Post-review verification status

Before the browser-failover change, head `f49c5abab42ef68e22dd11dd8e7193e7755eb0c8` established:

- privacy/security guard: passed;
- **34 test files / 150 tests: passed**;
- production TypeScript/Vite build: passed;
- API TypeScript check: passed;
- CodeQL `32405356540`: passed;
- rendered QA did not reach application assertions because Chromium 151 failed to expose CDP on both bootstrap attempts.

The final closure requires all CI, rendered browser suites, CodeQL, Windows packaging and screenshot review to pass on one common latest head after the browser-failover and documentation synchronization commits.

## Owner-gated state

- PR #159 remains open, ready for review and unmerged.
- Optional large Reports/Analytics visual restructure requires a separate owner decision.
- No `main` merge, release/version bump, production deployment or production installer publication is authorized by technical closure alone.
