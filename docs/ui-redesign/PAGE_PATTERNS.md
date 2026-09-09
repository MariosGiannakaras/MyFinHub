# MyFinHub approved page patterns

Status: **Phase-1 approved pattern registry**.

This file records structural patterns that recur across owner-approved Phase-1 surfaces. A pattern describes composition and behavior; it does not require every page to share identical content density or domain layout.

## 1. Application shell

- **Established by:** verified Phase-1 routed surfaces.
- **Purpose:** single application chrome and navigation contract.
- **Required structure/behavior:** `AppShell` owns desktop sidebar, top bar, workspace, global navigation, quick-entry access, persistence status and mobile navigation. Pages do not instantiate competing shell chrome.
- **Allowed variation:** route-aware quick-action wording and approved route-specific desktop geometry while the current compatibility CSS remains in place.
- **Do not use when:** rendering authentication/MFA or other pre-shell gates.
- **Implementation:** `src/components/AppShell.tsx`; base shell styles plus approved route-scoped compatibility styles.

## 2. Standard routed-page frame

- **Established by:** all current finance/settings routes.
- **Purpose:** predictable page hierarchy and spacing.
- **Required structure/behavior:** `page-stack` root composition plus `page-heading` containing title/supporting copy and optional eyebrow/actions.
- **Allowed variation:** page-specific actions, section count, approved density and responsive grid.
- **Do not use when:** the content is an overlay or a pre-shell screen rather than a routed workspace.
- **Implementation:** shared `.page-stack` / `.page-heading` CSS and readability typography tokens.

## 3. KPI / financial-summary band

- **Established by:** Dashboard, Loans, Planning, Reports and Έλεγχος-style summary surfaces.
- **Purpose:** expose the most decision-relevant aggregate values before detail.
- **Required structure/behavior:** small number of semantically named metrics, truthful values from canonical selectors/domain logic, visible context/unit and responsive containment.
- **Allowed variation:** metric count, domain iconography, emphasis and compactness appropriate to the surface.
- **Do not use when:** the page has no meaningful aggregate or a card would merely duplicate the first detailed row.
- **Implementation:** `MetricCard` and domain-specific summary components/styles.

## 4. Filter / search / period toolbar

- **Established by:** Transactions, Loans, Reports and other data-browsing surfaces.
- **Purpose:** constrain or navigate a dataset without obscuring the data itself.
- **Required structure/behavior:** shared app-owned inputs/selects, accessible names/labels, keyboard-visible focus and truthful filter state.
- **Allowed variation:** inline desktop grouping, stacked mobile arrangement, sort/period controls specific to the data.
- **Do not use when:** there is no user-selectable data dimension.
- **Implementation:** `AppTextInput`, `AppSelectInput`, `AppDateInput`, `PeriodControl`, `SortDirectionControl` and shared control CSS.

## 5. Dense desktop worklist / responsive semantic list

- **Established by:** Transactions, Recurring, Lending, Loans and Έλεγχος.
- **Purpose:** scan many finance records efficiently while retaining direct actions.
- **Required structure/behavior:** stable row identity/context, compact desktop density, truthful row actions and a responsive representation that remains usable at narrow widths.
- **Allowed variation:** semantic table vs grouped rows/cards; Έλεγχος intentionally retains a denser approved row/action rhythm than several general pages.
- **Do not use when:** a record is primarily visual (for example a payment-card presentation) or when only a single summary is shown.
- **Implementation:** semantic table/list styles plus domain row components/classes; mobile row/card patterns where already established.

## 6. Form / settings group

- **Established by:** Quick Entry and Settings workflows.
- **Purpose:** group related editable fields with clear validation and actions.
- **Required structure/behavior:** canonical inputs, explicit labels, `FormError`, logical tab order, responsive width containment and no page-local recreation of shared input visuals.
- **Allowed variation:** domain-specific field grids, disclosures, helper text and specialized pickers.
- **Do not use when:** content is read-only or a direct single-action row is clearer.
- **Implementation:** shared App* controls, `MoneyInput`, `CategorySelectInput`, `FormError`, `.settings-form` and domain composition CSS.

## 7. Detail / history section

- **Established by:** credit-card, loan, transaction and recurring detail/history flows.
- **Purpose:** provide secondary record history or drill-down without overwhelming the primary summary.
- **Required structure/behavior:** clear relation to the parent record, chronological/context labels and preserved edit/action semantics.
- **Allowed variation:** disclosure, table/list or dedicated semantic panel depending on record type.
- **Do not use when:** the information is required for the primary decision and should not be hidden behind a secondary section.
- **Implementation:** domain components; generic surface aliases only for geometry/elevation where appropriate.

## 8. Chart / insight block

- **Established by:** Dashboard, Savings, Planning and Reports.
- **Purpose:** explain trend/distribution/forecast information supported by canonical finance logic.
- **Required structure/behavior:** meaningful heading/context, semantic color roles, truthful data source and textual/accessibility support where needed.
- **Allowed variation:** chart type and neighboring insight summaries according to the question being answered.
- **Do not use when:** a single number or compact table communicates the information more precisely.
- **Implementation:** domain chart components and shared semantic theme tokens.

## 9. Attention / action queue

- **Established by:** Έλεγχος.
- **Purpose:** group real items that require user attention or a decision by urgency/type.
- **Required structure/behavior:** data-backed severity, explicit context/date/amount where relevant, truthful direct actions, real expand/collapse and no fabricated bank-sync/update states.
- **Allowed variation:** desktop grouped worklist vs established mobile severity/card presentation; secondary confirmation workflow may remain visually subordinate.
- **Do not use when:** content is informational only and has no attention/decision semantics.
- **Implementation:** `AttentionPage`, attention selectors/domain logic and its approved compact styles.

## 10. Modal dialog composition

- **Established by:** confirmation, money editing, card creation and Quick Entry overlays.
- **Purpose:** bounded tasks that must temporarily take focus without changing route context.
- **Required structure/behavior:** `aria-modal`, accessible title/description, `useModalFocus`, Escape behavior when allowed, initial focus, focus trap/restoration, scroll locking and clear cancel/confirm hierarchy.
- **Allowed variation:** `alertdialog` for destructive/confirmation semantics; specialized body such as card preview/design selection; approved larger Quick Entry composition.
- **Do not use when:** the interaction needs route history/deep linking or is too large to remain a bounded task.
- **Implementation:** current dialog components and modal/backdrop classes; future shared `DialogShell` will own repeated mechanics without flattening specialized bodies.

## 11. Empty / loading / error / all-clear state

- **Established by:** routed Phase-1 surfaces and shared QA contracts.
- **Purpose:** make data absence, pending work and failures explicit rather than leaving ambiguous blank space.
- **Required structure/behavior:** state-specific wording, accessible error semantics, shell/layout stability during loading and no false success/all-clear state when unresolved data exists.
- **Allowed variation:** inline empty row, full panel, skeleton or contextual status depending on scope.
- **Do not use when:** real content is available and the state would merely be decorative.
- **Implementation:** existing empty/error/status classes, page skeletons, `FormError`, persistence notices and domain state components.

## Pattern evolution rule

Prefer evolving an existing shared pattern when a later requirement broadens it. Create a new shared pattern only when the interaction or information architecture is materially different. Owner-approved surface-specific density or domain semantics are legitimate exceptions and must not be erased solely to reduce CSS/component count.