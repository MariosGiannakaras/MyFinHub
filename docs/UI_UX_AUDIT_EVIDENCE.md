# MyFinHub UI/UX hardening evidence

Tracking: issue #158 · PR #159 · branch `feat/ui-ux-hardening-batch`

This document is the durable evidence map for the application-wide UI/UX hardening batch. A checkbox is complete only when the implementation exists and the relevant automated/browser evidence is green on the feature head.

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

The copy audit covers these feedback classes across `src/pages` and `src/components`:

- field validation and dialog validation errors;
- authentication and MFA errors;
- persistence save/conflict/recovery feedback;
- destructive confirmations;
- successful/status feedback after user actions;
- empty states and insufficient-data states;
- error-boundary fallback copy;
- card-vault/client failures that must not expose implementation details.

Implementation contracts:

- `src/lib/userMessage.ts` rejects technical exception/API/stack-style text before it can become user-visible and provides actionable fallback copy.
- `src/components/FormError.tsx` provides the shared announced form-error surface.
- `tests/user-message-source.test.ts` blocks known internal jargon and direct raw `Error.message` exposure in UI source.
- rendered QA verifies representative validation, authentication, persistence and error-boundary copy in the browser.

## Shared UI / duplicate-code audit

Consolidated contracts used where repetition was genuine:

- accessible hover/focus tooltip: `src/components/Tooltip.tsx`;
- owned select control: `src/components/AppSelectInput.tsx`;
- owned date control: `src/components/AppDateInput.tsx`;
- shared form error: `src/components/FormError.tsx`;
- explicit ASC/DESC control: `src/components/SortDirectionControl.tsx`;
- persisted readability control: `src/components/ReadabilitySettings.tsx`;
- modal focus trap, Escape handling, focus return and scroll lock: `src/hooks/useModalFocus.ts`;
- user-safe error normalization: `src/lib/userMessage.ts`.

`tests/shared-ui-source.test.ts` guards these single-source contracts and prevents page-level Escape duplication. `tests/owned-controls-source.test.ts` and rendered owned-control QA verify that finance entry flows use the shared controls rather than native/date/select drift.

## Tooltip / discoverability evidence

The full desktop route matrix rejects visible unnamed controls and rejects icon-only workspace actions that have neither a tooltip/hint nor an explicit close-control exception. Browser checks also verify:

- keyboard focus exposes the tooltip through `aria-describedby`;
- tooltip content uses `role="tooltip"`;
- hover content is visible and contained within the viewport;
- mobile/touch layouts suppress sticky visual bubbles while retaining accessible names.

## Sorting evidence

- Transactions: date ASC/DESC with `aria-sort` and deterministic ID tie-break.
- Loans: text, numeric amount, nullable usual-day/date value and deterministic tie behavior.
- Credit purchases/repayments: explicit direction controls and deterministic ordering.
- Empty datasets remain valid under the route/state matrix.

## Typography / readability evidence

- coherent text-size tokens and line-height/readability overrides are applied application-wide;
- chart ticks were raised from legacy undersized values;
- Compact, Normal and Large are persisted through Settings;
- rendered QA measures actual computed typography for all three modes on desktop and mobile;
- mobile form controls are guarded against sub-16px text where browser zoom behavior would be harmful.

## Browser visual/state matrix

`ui-ux-hardening-qa.mjs` covers every route with:

| State | Desktop | Mobile |
| --- | --- | --- |
| Normal | 1440×1000 | 375×812 |
| Empty | 1440×1000 | 375×812 |
| Extreme / long strings / large collections | 1440×1000 | 320×700 |
| Compact text | 1440×1000 | 375×812 |
| Large text | 1440×1000 | 375×812 |

For each applicable route/state it checks overflow, unnamed controls, icon-action discoverability, mobile target sizing and runtime errors. Full-page visual evidence is generated separately for review.

Interaction suites additionally cover Quick Entry, owned editors, sorting, validation, modal Escape/backdrop/focus/scroll-lock behavior, card archive/restore, delete/undo/redo, persistence recovery, error boundaries and representative destructive/action flows.

## Accessibility evidence

- keyboard focus and modal focus return/trapping;
- visible focus styling through shared controls;
- accessible names for icon controls;
- `aria-sort` for sorted tables;
- form errors associated to dialog and invalid input via `aria-describedby`/`aria-invalid`;
- representative text contrast at or above 4.5:1;
- mobile interactive-target floor checks;
- reduced-motion preference leaves the workspace at rest;
- chart data has text alternatives where charts are visually hidden from assistive technology.

## Analytics implementation

The approved Reports hardening is implemented in `src/pages/ReportsPage.tsx` and `src/lib/reports.ts`:

- headline income/expense/savings-rate/budget context;
- previous-period comparisons;
- six-month income/expense/savings trend;
- deterministic insight callouts with explicit insufficient-history states;
- trailing three-month expense comparison;
- category/subcategory concentration and momentum;
- recurring commitments as a share of income;
- multi-card debt, limit, available credit and utilization with card drill-down;
- receivables context;
- primary-account balance history;
- savings-source breakdown;
- no causal claims from simple correlation.

`tests/reports.test.ts` protects multi-card aggregation, insufficient-history behavior, trailing comparisons, recurring burden and category momentum.

## Final runtime gate

`scripts/ui-ux-runtime-qa.mjs` is part of `qa:frontend` and performs CDP-level checks across desktop/mobile routes and auth/persistence states for:

- uncaught runtime exceptions;
- `console.error` / failed assertions;
- browser error log entries;
- non-cancelled network load failures;
- HTTP 5xx responses.

It also emits a loading-state screenshot into the normal UI/UX evidence artifact.

## Completion rule

The batch is complete only when the final feature head passes:

1. security/privacy guard, unit/source tests and production build;
2. API TypeScript validation;
3. all rendered browser suites, including runtime/network and full-page evidence;
4. CodeQL;
5. Windows desktop packaging/smoke/checksum gates;
6. issue #158 and `docs/UI_UX_HARDENING_PLAN.md` are fully checked and synchronized with the evidence above.
