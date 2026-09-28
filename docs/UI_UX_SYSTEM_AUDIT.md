# MyFinHub UI/UX system audit — post-v1.3.0

## Scope and method

This audit covers the canonical routed product surfaces, authentication, dialogs/owned controls, desktop/tablet/mobile screenshots, and the source-level implementation of shared primitives and style layers.

The v1.3.0 information architecture and finance semantics are retained. The visual direction changes: the application should no longer depend on heavy neumorphic elevation to communicate grouping.

## Executive findings

1. **The information architecture is stronger than the visual system.** Dashboard, Transactions, Credit, Planning, Attention and Settings generally expose the right information, but too many nested rounded surfaces compete for hierarchy.
2. **The former neumorphic foundation was a root cause.** The implementation has now migrated `Surface`, dialogs, owned popovers and routed pages to semantic `surface-raised`, `surface-flat` and `surface-inset` primitives.
3. **Shared primitives exist but adoption is incomplete.** The 12 routed pages contain **65 raw `<button>` elements** even though `Button`/`IconButton` exist. `Surface` is used directly by only one routed page while most pages create their own panel/card shells.
4. **Geometry is not single-sourced.** Radius, shadow, border, control height and local surface values are repeated across page-specific CSS layers.
5. **Visual hierarchy relies too much on shadow/radius and too little on typography, spacing, borders and section structure.** This is most visible on Dashboard, Savings, Cards, Credit and mobile.
6. **Global navigation was route-conditioned.** Dashboard-specific CSS changed sidebar width, branding/logo treatment, nav typography, quick-entry/search placement, topbar actions and period controls only on the Dashboard route. Global AppShell chrome is now required to remain route-invariant; pages may style only their workspace content.
7. **Auth is too low-contrast.** Login/MFA controls visually sink into the canvas; focus is stronger than the resting control state.
8. **Mobile uses the correct navigation model but inherits too many desktop cards.** The result is long vertical stacks, excessive surface nesting and inconsistent density.

## Target direction

Use a cleaner premium-fintech system inspired by the useful qualities of the archived `NEW REDISIGN.png` reference without treating it as a literal layout contract:

- flat or lightly elevated surfaces;
- one restrained elevation scale, never bilateral light/dark embossing;
- thin semantic borders;
- fewer nested cards;
- typography and spacing as the primary hierarchy;
- consistent control heights and radii;
- one page-header contract;
- one metric-card family;
- one section/panel surface family;
- one action-button family;
- one form-control family;
- specialized financial objects (for example the visual payment card) may remain bespoke when their semantics justify it.

## Canonical primitives

### Action primitives

- `Button`: primary, secondary, danger, ghost.
- `IconButton`: icon-only actions with mandatory accessible name.
- Raw buttons are reserved for **semantic composite controls** such as listbox options, calendar grid cells, navigation items, segmented/radio-like choices and domain objects whose entire row/card is interactive.

### Surface primitives

- `Surface raised`: primary section/panel.
- `Surface flat`: low-emphasis grouped content.
- `Surface inset`: embedded state/preview area; visually uses border + tonal background rather than an embossed inset shadow.
- Legacy `neo-*` selectors have been removed from the active source; semantic `surface-*` primitives are the only generic surface vocabulary.

### Form primitives

- `AppTextInput`, `AppSelectInput`, `AppDateInput`, `AppTextarea`, `MoneyInput`.
- Page CSS may control layout, not redefine the basic field chrome.

## Page-by-page audit

| Surface | Current strengths | Main inconsistencies / target |
| --- | --- | --- |
| Dashboard | Strong account-first overview and useful secondary data | Too many independent cards and shadows; secondary sections need fewer containers; account/metric/panel geometry should be shared; mobile stack is excessively long and visually fragmented |
| Transactions | Good KPI → filter → ledger/detail flow | Search/select/date/sort/button shells differ; table/detail panel should use canonical section/action styling; row actions should use shared icon actions |
| Savings | Clear action choice and goal model | Three bespoke action cards + hero + goals create layered softness; convert to shared action-card/section/progress patterns and flatten nested surfaces |
| Cards | Strong specialized payment-card visualization | Surrounding bank columns, empty states and summary cards are over-elevated; keep the card object bespoke but make all surrounding UI canonical |
| Credit | Good focal-card + debt/statement model | Stage, stats, tables and statement groups each use separate surface treatments; normalize panels, table actions, segmented controls and statement rows |
| Loans | Clear obligations and progress | Loan cards, toolbar, editors and action buttons use local geometry; normalize section/toolbar/action primitives and reduce large soft shadows |
| Lending | Useful master/detail model | Very large soft containers and custom person/action controls; define one master-detail surface and shared semantic action treatment |
| Recurring | Grouping by obligation type is understandable | KPI cards, group shells and row actions use mixed local styles; flatten groups and standardize table/list actions |
| Planning | Good forecast-first hierarchy | Dense grid of cards; forecast summary/account cards should share metric/panel primitives and use borders/spacing rather than repeated elevation |
| Attention | Comprehensive action center | High number of nested category containers and action styles; use tonal severity sections with shared rows/actions instead of card-on-card presentation |
| Reports | Appropriate analytics composition | Chart/KPI/insight panels need one shared report surface and spacing contract; remove residual soft elevation from every chart block |
| Settings | Logical tabs and grouping | Generic panels, action cards, forms and diagnostics still vary; all settings sections should use shared Surface/form/action primitives |
| Login / MFA | Simple, focused security flow | Resting inputs are visually too faint and card shadow is overly soft; use explicit field borders, stronger text contrast and restrained single-direction elevation |

## Responsive audit

### Desktop
- Preserve sidebar + sticky topbar.
- Reduce nested elevations and normalize panel gutters.
- Keep data-dense tables where appropriate.

### Tablet
- Use the same token system, not a separate visual language.
- Avoid converting every desktop column into independently elevated cards.

### Mobile
- Preserve bottom navigation and app-owned overlays.
- Reduce card count and surface nesting.
- Prefer section dividers, tonal groups and compact list rows.
- Maintain >=44 px coarse-pointer targets while keeping visual density controlled.

## Implementation guardrails

1. Shared geometry/elevation tokens live at the theme foundation.
2. AppShell navigation, branding, topbar, search/quick-entry chrome and mobile navigation are route-invariant; page-specific CSS must never target AppShell based on the active route.
3. New generic actions must use `Button`/`IconButton`.
4. New generic section shells must use `Surface`.
5. Generic text/select/date/textarea controls must use app-owned input primitives.
6. Tests should reject new `neo-*` JSX usage and new raw generic controls on routed pages.
7. Page-specific CSS may define domain layout, data visualization and semantic state, but not invent a parallel button/input/panel design system.
8. Dark/light themes must resolve the same semantic tokens; theme switching must not require page-specific overrides.
9. Final acceptance requires rendered desktop/tablet/mobile review across all canonical routes and auth states.

## Migration order

1. Foundation tokens + Surface/action/control primitives.
2. Shell, dialogs, owned popovers and auth.
3. Routed page generic actions and section surfaces.
4. Domain-specific cards/tables/list rows.
5. Responsive reconciliation.
6. Rendered QA, accessibility checks, duplicate-style guardrails and final screenshot review.
