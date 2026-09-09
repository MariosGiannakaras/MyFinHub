# MyFinHub desktop redesign system

Status: **Phase-1 approved contract — implementation ownership is being consolidated without redesigning the product**.

This file records the durable visual and interaction language established by the owner-approved Phase-1 surfaces. It is a contract for future implementation work, not a license to normalize away intentional domain-specific layouts or to invent a new visual system.

## Non-negotiable quality baseline

The UI must preserve the accessibility/interaction requirements in `docs/UX_STANDARDS.md`: strong contrast, visible focus and control boundaries, explicit hover/pressed/disabled/error states, keyboard access, reduced-motion support, responsive containment and dense-data patterns appropriate to a personal-finance product.

The approved Phase-1 surfaces remain authoritative for visual parity. Real finance data, dates and labels may vary; hierarchy, density, geometry, interaction semantics and responsive behavior must not drift during code-health refactors.

## Application shell

- `AppShell` owns application chrome: desktop sidebar, top bar, workspace, global navigation, quick-entry access, persistence status and mobile navigation.
- Routed pages must not create their own sidebar/topbar copies.
- The owner-approved desktop shell uses the compact 210px navigation treatment on verified Phase-1 routes where the approved shell rules apply. Older base geometry in `part1.css` is compatibility scaffolding, not a reason to create another shell variant.
- Mobile keeps the established compact header and bottom-navigation containment. Code-health work must preserve route access and touch targets.

## Layout and page frame

- `page-stack` is the canonical routed-page vertical composition container.
- `page-heading` is the canonical page header: optional eyebrow, title, supporting copy and page-level actions.
- Pages own composition: section order, responsive grid choice, available width and domain-specific density.
- Shared primitives own their internal visual language; page CSS should not restyle the same primitive merely to solve local spacing.

## Typography

Readability is controlled through the shared UX tokens in `part30.css`:

- `--ux-body-size`
- `--ux-small-size`
- `--ux-tiny-size`
- `--ux-heading-size`

The `compact`, `normal` and `large` text-size preferences remain supported. Page titles use the shared heading token. Supporting text, table text and labels use the shared body/small/tiny hierarchy.

Some approved dense workspaces intentionally use a more compact row/action rhythm than general pages. In particular, the desktop Έλεγχος/attention workspace keeps its owner-approved dense treatment. Such differences are explicit domain variants, not a new global typography scale.

## Spacing and density

There is no independent numeric spacing token API yet. The durable rule is compositional consistency:

- compact gaps for navigation, toolbars and dense finance rows;
- moderate gaps for page sections and KPI groups;
- enough internal padding for scanability without oversized cards or empty space;
- minimum mobile touch targets remain 44px where interactive controls need touch access.

A future token cleanup may name repeated values, but must prove visual parity before changing geometry.

## Theme and color roles

- `src/lib/theme.ts` owns the semantic Light/Dark token values and System/Light/Dark preference behavior.
- Use semantic variables such as `--canvas`, `--surface*`, `--control-*`, `--text-*`, `--border-*`, `--accent*`, `--success*`, `--error*`, `--warning*`, `--info*`, `--finance-*`, `--chart-grid`, `--overlay`, `--shadow-*` and `--focus*`.
- Finance meaning must not depend on color alone; labels/icons/text remain required where meaning matters.
- The broad runtime selector stylesheet currently embedded in `theme.ts` is compatibility debt scheduled for code-health cleanup. New UI must not extend that selector net; runtime theme code should ultimately apply semantic tokens while named CSS layers own selectors.

## Surfaces, borders, radii and elevation

Current generic compatibility aliases are:

- `.neo-raised` — elevated/primary grouped surface;
- `.neo-flat` — low-elevation/translucent grouped surface;
- `.neo-inset` — recessed/input-like grouped surface.

These are migration-era aliases. Stage 4 of the code-health plan will introduce a shared `Surface` base with raised/flat/inset variants while preserving the approved appearance.

Domain surfaces remain semantic: KPI cards, account/payment cards, attention rows, planning/report blocks and similar finance-specific components may compose a generic surface but should not be flattened into an anonymous card abstraction when their semantics or layout differ.

## Buttons and icon buttons

The approved action hierarchy is stable even though the implementation is not yet componentized:

- **Primary:** current `primary-action` / `save-button` visual language for the main affirmative action.
- **Secondary:** current `secondary` visual language for neutral alternatives/cancel actions.
- **Destructive/danger:** explicit destructive semantics layered on the shared action language; never infer danger from placement alone.
- **Icon action:** current `icon-button` visual language, always with an accessible name.
- **Text/ghost action:** lightweight action only when its reduced emphasis is semantically appropriate.

Stage 2 will replace selector aliases/raw-button duplication with typed shared `Button` and `IconButton` primitives. Until then, do not introduce new page-local base button systems when an existing action family covers the behavior.

## Inputs, selects and validation

Canonical app-owned controls are:

| Concern | Contract |
| --- | --- |
| Text | `AppTextInput` |
| Multiline text | `AppTextarea` |
| Select/dropdown | `AppSelectInput` |
| Date | `AppDateInput` |
| Money/amount | `MoneyInput` |
| Category | `CategorySelectInput` |
| Validation message | `FormError` |

`AppInputShell` and `.app-control` provide shared ownership underneath these controls where applicable. The shared layer owns typography, height, padding, radius, boundary, focus, keyboard/accessibility behavior and mobile sizing. Pages may control surrounding layout and width.

Do not replace app-owned dropdown/date/category behavior with native browser popups merely to match a screenshot.

## Tables, lists and filters

- Desktop finance data should favor compact, scan-friendly rows and stable column alignment when tabular comparison matters.
- Responsive presentations may switch to stacked semantic rows/cards where that behavior is already established.
- Filter/search controls use shared inputs/selects and preserve explicit labels or accessible names.
- Row actions must remain truthful to their handler and retain the context needed to act on the correct finance record.
- Density is a product property; code-health work must not enlarge every row/card to a generic component default.

## Financial summaries and cards

- KPI/metric bands provide a fast summary before detailed workspaces when the approved surface uses them.
- `MetricCard` and domain-specific summary components retain finance semantics rather than becoming generic decoration.
- Cards are grouping tools, not the default wrapper for every datum.
- Positive/negative/neutral presentation must reuse canonical finance meaning, not reimplement accounting logic in view code.

## Charts and data visualization

- Charts must be derived from canonical finance selectors/domain logic.
- Use semantic chart/grid/finance color roles and provide textual context or accessible alternatives where required.
- Do not manufacture trends, linked-bank freshness, projections or analytical states unsupported by the underlying data.
- Visual parity does not justify changing the reporting/accounting meaning of a series.

## Status, badges and feedback

- Use semantic success/error/warning/info/neutral roles consistently.
- State text must be truthful and not imply unsupported synchronization or completion.
- Error and validation feedback must remain perceivable to assistive technology; `FormError` is the shared validation contract.
- Loading, empty and all-clear states are data-dependent product states, not decorative placeholders.

## Dialogs, overlays and tooltips

- `useModalFocus` is the canonical modal accessibility behavior: initial focus, topmost-modal focus trap, Escape dismissal when allowed, scroll locking, form-error association and focus restoration.
- Existing modal implementations currently repeat backdrop/motion/header/footer mechanics. Stage 3 will consolidate eligible dialogs under a shared `DialogShell` without changing specialized bodies.
- `ConfirmDialog`, `MoneyEditDialog` and `CardCreateDialog` are current reference adopters of the modal-focus contract; card creation remains a specialized composition because its preview/design-picker body is domain-specific.
- Tooltips must remain keyboard discoverable and must not be the only source of an accessible control name.

## Empty, loading and error states

Every routed surface must preserve meaningful loading, empty, error and persistence/conflict states where supported. Skeletons should preserve the surrounding shell geometry to avoid large layout shifts. Error states must never hide an auth/security/persistence failure behind a visually successful state.

## Motion

- Respect `prefers-reduced-motion` and the existing reduced/full motion preference behavior.
- Motion is subordinate to comprehension and must not change control semantics or hide focus.
- Refactors may centralize repeated transitions, but must preserve the approved visual timing/behavior unless the owner explicitly approves a change.

## Ownership rule for code-health work

When the same defect or style occurs across several pages, fix the canonical component/shared layer rather than copying page overrides. When a surface has an owner-approved domain-specific variant, document and preserve that exception instead of forcing it through an abstraction that changes appearance or behavior.