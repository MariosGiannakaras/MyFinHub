# MyFinHub UI Ownership Inventory

Status: **Stage-1 baseline for issue #357**.

This inventory describes the current Phase-1 implementation before shared-button/dialog/surface refactors. It is intentionally descriptive: Stage 1 does not change runtime styling or behavior. Later stages should use this document to migrate ownership in bounded steps while preserving approved visuals and finance/security semantics.

## Canonical contracts already established

| Concern | Canonical implementation | Current ownership |
| --- | --- | --- |
| Text | `AppTextInput` | shared component + `AppInputShell` / `.app-control` |
| Multiline | `AppTextarea` | shared component + `.app-control` |
| Select | `AppSelectInput` | shared app-owned select/dropdown behavior |
| Date | `AppDateInput` | shared app-owned date behavior |
| Money | `MoneyInput` | shared amount parsing/editing contract |
| Category | `CategorySelectInput` | shared category semantics and picker behavior |
| Validation | `FormError` | shared accessible validation message |
| Modal focus | `useModalFocus` | shared focus trap, Escape, scroll lock, error association, restoration |
| Application chrome | `AppShell` | shared routed shell |
| Page frame | `page-stack` + `page-heading` | shared routed-page composition |
| Theme | semantic light/dark tokens | `src/lib/theme.ts` token application plus legacy selector overlay |
| Generic controls | `.app-control` | `src/styles/part57.css` |
| Generic surfaces | `.neo-raised` / `.neo-flat` / `.neo-inset` | compatibility CSS pending `Surface` consolidation |

## Button inventory

### Current shared visual aliases

| Family | Current hooks | Intended migration |
| --- | --- | --- |
| Primary affirmative | `primary-action`, `save-button` | Stage 2 `Button` primary |
| Secondary/cancel | `secondary` and contextual secondary aliases | Stage 2 `Button` secondary |
| Danger/destructive | destructive classes layered on shared action styling | Stage 2 `Button` danger |
| Icon-only | `icon-button`; some domain close/action aliases | Stage 2 `IconButton` with mandatory accessible name |
| Text/ghost | page/domain text-button style hooks | Stage 2 typed lightweight variant only where semantics match |

Base primary and icon-button styling currently originates in `src/styles/part1.css`. Shared focus ownership is centralized in `src/styles/part57.css`; touch-target hardening is partly in `src/styles/part30.css`. `src/lib/theme.ts` also applies a broad selector overlay to the same families, which creates duplicate ownership and is a Stage-5 cleanup target.

### Raw-button classification

Raw `<button>` elements are not automatically defects: native button semantics remain correct and many current controls require domain composition. The duplication problem is visual/state ownership through repeated class selectors rather than the HTML element itself.

Stage 2 should migrate reusable action semantics first and leave domain-specific composites alone until an equivalent typed API exists. Examples of legitimate composites include segmented/sort controls, card-design radio options, taxonomy icon actions, payment-card interactions and navigation controls owned by `AppShell`.

## Dialog and overlay inventory

| Current component/pattern | Shared behavior already used | Duplicated shell mechanics | Legitimate specialization |
| --- | --- | --- | --- |
| `ConfirmDialog` | `useModalFocus`, reduced motion, accessible IDs | backdrop, motion section, close control, header/footer/action layout | `alertdialog`, destructive tone, busy-state dismissal rules |
| `MoneyEditDialog` | `useModalFocus`, reduced motion, `MoneyInput` | same `modal-backdrop` + `quick-modal` motion/header/footer pattern | amount field and inline amount validation |
| `CardCreateDialog` | `useModalFocus`, App* inputs, `FormError` | backdrop, modal section, close/action hierarchy | payment-card preview, bank/network/design picker, creation semantics |
| Quick Entry overlays | modal/focus conventions and approved modal styling | generic backdrop/shell/action mechanics | larger approved desktop composition and transaction-kind workflow |
| Editor/picker/popover families | shared focus/control conventions where applicable | several backdrop/surface aliases remain | some interactions are editor/picker/popover semantics rather than dialogs |

### Dialog migration boundary

Stage 3 should extract only mechanics that are truly common: backdrop, ARIA labelling hooks, modal container, focus/scroll ownership, Escape policy, reduced-motion wrapper, header/close affordance and optional footer action slots. Specialized bodies and domain validation remain in their domain components. Do not force popovers, route pages or complex card content into a dialog abstraction simply to reduce file count.

## Surface inventory

### Generic compatibility surfaces

- `.neo-raised`: elevated grouped content, including current modal/panel hosts.
- `.neo-flat`: lower-elevation/translucent grouped content such as approved chrome/panels.
- `.neo-inset`: recessed grouped/input-like presentation.

The base definitions live in `src/styles/part1.css`, while theme-specific selector overrides also exist in `src/lib/theme.ts`. Stage 4 should introduce a small `Surface` ownership layer and retain these aliases temporarily only as compatibility hooks.

### Intentional semantic surfaces

Do **not** replace the following merely because they visually resemble cards:

- KPI/metric cards (`MetricCard` and domain equivalents);
- account/balance and payment-card surfaces;
- credit-card stack/interactive card presentations;
- loan/lending/recurring/planning/report domain summaries;
- attention/Έλεγχος severity rows and grouped workspaces;
- specialized settings workspaces and security/device panels.

They may compose the future generic `Surface`, but their layout, accessibility and finance meaning remain domain-owned.

## CSS ownership and loader graph

### Root stylesheet path

`src/styles.css` directly imports numbered compatibility files `part1.css` through `part46.css`, then `part57.css`.

Important current ownership:

- `part1.css`: base palette/legacy tokens, generic surfaces, AppShell/page frame, base primary/icon action styling and core layout.
- `part30.css`: readability typography tokens, touch-target/accessibility hardening, tooltips and several shared responsive rules.
- `part57.css`: canonical `.app-control`, compact input density variant and the common `:focus-visible` rule.
- `part2.css`–`part46.css`: accumulated feature/page/responsive rules; ownership is historical rather than layer-oriented.

### Hidden component-loader path

`src/components/AccountIban.tsx` and `src/components/AccountMetadataSettings.tsx` import `src/styles/part47.css`.

`part47.css` is not merely IBAN/account-metadata styling. Its first imports load:

- `part48.css`
- `part49.css`
- `part50.css`
- `part51.css`
- `part54.css`
- `part55.css`
- `part56.css`
- approved-target/refinement styles for Loans, Credit Card, Lending, Recurring, Planning and Έλεγχος.

This means an account-metadata component currently acts as a stylesheet loader for unrelated approved route styling. That coupling is real but must **not** be removed in Stage 1 because doing so would change which CSS reaches production.

Observed owners in that hidden chain:

- `part48.css`: owner-approved Phase-1 Dashboard target/shell overrides.
- `part49.css`: Dashboard route/skeleton shell continuity rules.
- `part50.css`: final approved Dashboard desktop geometry refinements.
- `part51.css`: final owner-approved Dashboard desktop alignment.
- `part54.css`: owner-approved shared desktop shell treatment for Transactions.
- `part55.css`: owner-approved Quick Entry desktop composition.
- `part56.css`: owner-approved Savings desktop composition.

`part52.css` and `part53.css` physically exist but are not imported by `src/styles.css` or the `part47.css` chain. No current import path was identified in this bounded inventory; Stage 5 must prove whether they are dead or loaded elsewhere before deletion/movement.

### Named approved stylesheets

The styles directory also contains named owner-approved files including:

- `transactions-approved.css`
- `loans-approved-target.css`
- `credit-approved-target.css`
- `lending-approved-target.css`
- `recurring-approved-target.css`
- `planning-approved-target.css`
- `planning-approved-refinement.css`
- `attention-approved-target.css`
- `attention-approved-refinement.css`
- cards/credit-card host and stack styles.

These files encode approved presentation and are evidence-bearing compatibility owners. Stage 5 may rename/re-layer imports, but selector removal or consolidation requires fresh visual parity evidence for representative affected routes.

## Runtime theme ownership debt

`src/lib/theme.ts` correctly owns semantic Light/Dark token values and theme preference application. It also contains a large `THEME_STYLE` selector string that styles broad application selectors such as generic surfaces, navigation, buttons, inputs, mobile rows, cards and badges.

This split between CSS files and runtime selector injection obscures ownership. Stage 5 target:

1. keep semantic token values/runtime preference application in theme code;
2. move selector styling into explicit named CSS layers;
3. avoid changing the resulting computed appearance while moving ownership;
4. remove runtime selector rules only after parity tests/evidence prove the named layer fully replaces them.

## Allowed exceptions

The following differences are intentional unless a later owner-approved target says otherwise:

- desktop Έλεγχος retains its denser row typography/action rhythm;
- payment/credit cards keep specialized geometry and editing affordances;
- Quick Entry keeps its larger approved desktop modal composition;
- card creation keeps the visual card preview and design-picker semantics;
- data-dense desktop tables/lists may have different row composition from their mobile cards;
- domain summary/KPI components may have distinct layouts while reusing shared tokens/surfaces;
- route-specific approved shell overrides remain compatibility exceptions until Stage 5 can safely consolidate them.

An exception permits domain composition, not a second copy of base focus/input/button accessibility behavior.

## Staged migration map

- **Stage 2 — Buttons:** introduce typed `Button`/`IconButton`; migrate bounded action families; retain compatibility aliases until no longer referenced.
- **Stage 3 — Dialogs:** centralize dialog mechanics around `useModalFocus`; preserve specialized bodies and tone semantics.
- **Stage 4 — Surfaces:** centralize generic elevation/geometry; keep domain semantic components.
- **Stage 5 — CSS:** make loader ownership explicit, eliminate component-as-global-stylesheet-loader coupling, replace numeric loader chains with named layers, reduce selector/runtime-theme duplication only with visual parity proof.

## Guardrail principle

Source-level tests should assert durable ownership/behavior: canonical shared controls, `AppShell` ownership, page-frame adoption, common focus semantics and modal-focus adoption. They should not pin arbitrary whitespace, selector ordering or file names that a later ownership cleanup is explicitly meant to change.