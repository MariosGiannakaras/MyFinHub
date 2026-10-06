# MyFinHub — GPT Technical Code Audit for Visual Findings

## Scope

This is the second stage of the audit. It intentionally inspects source **only to explain the visual findings in `ui_ux_visual_audit.md`**. It is not a general repository, backend, security, finance-domain or database audit.

Baseline inspected: current `develop` source corresponding to the interactive-verification workstream, with screenshot evidence from `chore/476-close-8.13-interactive-verification`.

Confidence labels:

- **High** — the rendered symptom maps directly to an explicit source/CSS rule.
- **Medium** — the source strongly suggests the cause, but computed-style/asset inspection would be required to prove the final cascade.
- **Low** — hypothesis only; none of the findings below relies on a low-confidence cause as established fact.

## T-01 — V-01 Dashboard account ordering — High confidence

**Files**

- `src/pages/DashboardPage.tsx`
- `src/lib/accountSelection.ts`

`DashboardPage` renders `accountChoices.dashboardPrimary`.

`financeAccountChoices()` attempts the desired slot order:

```ts
add(dailyCash);
add(operating);
add(savings);
```

but `dailyCash` is only resolved when an account satisfies:

```ts
account.kind === 'cash'
&& account.cashRole === 'daily'
&& showInQuickChoices !== false
```

If the cash account lacks that metadata or is excluded from quick choices, it is not inserted in slot 1. The later generic fallback loops can then append it only after operating and savings, producing the exact screenshot order.

**Technical conclusion:** the owner-defined Dashboard ordering is currently conditional on account metadata rather than guaranteed by the presentation contract. The fix should make the primary-slot resolution explicit and deterministic while preserving the canonical account model; it should not hardcode display names.

## T-02 — V-02 cross-app micro-typography — High confidence

The repository already defines shared readability tokens in `src/styles/ui-hardening-foundations.css`:

- body: 15px
- small: 13px
- tiny: 11px

Several desktop-specific styles bypass those tokens with materially smaller literal values.

Examples:

### Dashboard — `src/styles/dashboard-approved-target.css` / `dashboard-desktop-fidelity.css`

- `--dashboard-caption-size: 8.5px`
- `--dashboard-row-size: 9.5px`
- data footer down to 7.5px
- movement/category/summary/KPI metadata commonly 8–9.5px

### Transactions — `src/styles/transactions-approved.css`

- table: 10px
- headers: 9px
- date inputs: 9px
- detail rows: 10px
- pagination/filter text: 9–11px

### Cards — `src/styles/cards-v15-presentation.css`

- bank subtitle: 8px
- empty-state text: 9px
- card field label: `.50rem`
- network type: `.54rem`

### Loans — `src/styles/loans-approved-target.css`

- loan meta: 9.5px
- supporting text around 9–11.5px

### Recurring — `src/styles/recurring-approved-target.css`

- table base: 9px
- headers: 8px
- row secondary text: 7.8px
- payment action label: 8px

### Reports — `src/pages/ReportsPage.css`

Many operational labels are between `.58rem` and `.72rem` (roughly 9–11.5px at a 16px root).

**Technical conclusion:** this is design-system bypass, not a single browser rendering bug. The desktop target styles need to consume the shared typography scale (or a justified dense variant with a minimum readable floor) instead of maintaining a parallel 7.5–10px scale.

## T-03 — V-03 Dashboard hollow empty panels — High confidence

**Files**

- `src/styles/dashboard-desktop-alignment.css`
- `src/styles/dashboard-approved-target.css`
- `src/pages/DashboardPage.tsx`

Desktop Dashboard geometry explicitly fixes large panel heights:

- mid-grid panels: approximately 248–260px
- chart panels: approximately 195–202px

The React page still renders the normal movement/chart structures when the monthly collections are empty; the empty visual does not switch to a compact explanatory state.

**Technical conclusion:** fixed presentation heights and data-present layout are being reused for zero-data states. Add explicit empty-state rendering and either let empty panels shrink or use a purpose-designed placeholder that visually occupies the space.

## T-04 — V-04 Dashboard low-contrast secondary information — High confidence

**File:** `src/styles/dashboard-approved-target.css`

The base approved Dashboard stylesheet hardcodes light-theme colors for secondary account content, for example:

- secondary account name: `#3f5579`
- secondary balance: `#142d68`
- summary/trend copy: `#6c7e99`, `#71819a`, etc.

These are combined with the very small sizes described in T-02. Dark-theme reconciliation therefore depends on later overrides being exhaustive; the screenshot shows that this contract is not consistently successful.

**Technical conclusion:** semantic text should use theme tokens (`--ink`, `--text-secondary`, `--muted`) at the owning rule rather than light-theme hex values that require downstream repair.

## T-05 — V-05 provider-image glow/rectangles — Medium confidence

**Files**

- `src/components/BankBrandMark.tsx`
- `src/styles/dashboard-bankmark-chart-attention.css`

`BankBrandMark` renders local assets as `<img class="bank-logo-image">`.

For local-image Dashboard marks, the current CSS explicitly removes wrapper decoration:

- transparent background
- no border
- `box-shadow:none`

Therefore the bright white rectangle/halo visible in the screenshots is **not well explained by the generic Dashboard wrapper shadow**. The remaining likely causes are:

1. white/opaque pixels or baked glow inside the source PNG;
2. a role/surface-specific image rule outside the Dashboard wrapper;
3. an asset variant inappropriate for dark surfaces.

**Technical conclusion:** inspect the actual provider asset alpha/background and the computed image rule before adding another CSS shadow/filter workaround. Fix the asset/surface contract at its source.

## T-06 — V-06 Transactions weak empty state — High confidence

**File:** `src/pages/TransactionsPage.tsx`

The zero-row branch is only:

```tsx
<div className="empty-state transaction-empty-state">
  Δεν υπάρχουν κινήσεις για τα επιλεγμένα φίλτρα και την περίοδο.
</div>
```

There is no dedicated visual composition, reset-filters action, icon, title or period-specific guidance.

**Technical conclusion:** this is a component-state design gap rather than a layout engine bug. The page needs a purpose-built transaction empty state while retaining the existing filtering semantics.

## T-07 — V-07 Transaction detail truncation — High confidence

**Files**

- `src/pages/TransactionsPage.tsx`
- `src/styles/transactions-approved.css`

The details markup correctly contains the full account and description strings. The truncation is introduced by CSS:

```css
.transactions-detail-row b {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

The panel itself is also deliberately narrow:

```css
.transactions-approved-grid {
  grid-template-columns: minmax(0,1fr) minmax(0,310px);
}
```

**Technical conclusion:** list/table truncation semantics were applied to the detail view. In the detail panel, value cells should wrap (`white-space:normal`, appropriate `overflow-wrap`) and row height should be content-driven. A modestly wider detail column can be considered at large desktop widths, but wrapping is the essential fix.

## T-08 — V-08 Savings whitespace/route imbalance — High confidence for typography, Medium for final layout

**Files**

- `src/pages/SavingsPage.tsx`
- `src/styles/savings-workspace-base.css`

The transfer path uses `.saving-route`, whose account chips are explicitly set to `font-size:9px`. This makes the source/destination relationship unusually small despite being one of the key pieces of financial meaning in the section.

The page's action content is comparatively sparse, so fixed/full-width cards create the observed whitespace imbalance.

**Technical conclusion:** elevate the route to the shared readable text scale and let action-card geometry follow content rather than using large visual containers around micro-copy.

## T-09 — V-09 bright card contrast — High confidence

**Files**

- `src/styles/root-compat.css`
- `src/styles/cards-prototype-presentation.css`
- `src/styles/cards-v15-presentation.css`
- `src/components/InteractivePaymentCard.css`
- `src/components/InteractivePaymentCard.tsx`

There is a concrete cascade conflict.

`cards-prototype-presentation.css` defines the Piraeus yellow theme correctly with dark text:

```css
.r-card-piraeus-yellow {
  --card-text:#0b3852;
  --card-muted:rgba(11,56,82,.6);
}
```

Later in `root-compat.css`, `cards-v15-presentation.css` is imported after the prototype stylesheet. It contains:

```css
.payment-card {
  --card-text:#fff;
  --card-muted:rgba(255,255,255,.67);
}
```

Both selectors have one class of specificity, so the later generic `.payment-card` declaration can overwrite the earlier theme variables. That matches the screenshot where the Piraeus yellow card renders white/light details despite the theme-specific intention.

The Alpha light card is also configured with very light text in its theme and therefore needs its own verified contrast pair.

**Technical conclusion:** card design variables must be owned by a rule with unambiguous precedence—e.g. load generic defaults before themes or increase semantic theme specificity without page-specific hacks. Add computed-style/contrast regression coverage for every light-surface card design.

## T-10 — V-10 desktop Cards clipping/overflow affordance — High confidence

**File:** `src/styles/cards-v15-presentation.css`

Desktop geometry is explicitly:

```css
.cards-workspace { overflow:hidden; }
.cards-grid {
  grid-template-columns:repeat(var(--bank-count,5),minmax(310px,1fr));
  min-width:1590px;
}
```

Horizontal scrolling is only added to `.cards-prototype-workspace` under `max-width:680px`.

With many providers, the desktop grid can exceed the available workspace while the owning surface clips it. This directly explains the partially cut final bank column.

**Technical conclusion:** desktop needs an explicit overflow contract: responsive column sizing/wrapping, a deliberate horizontal scroller with visible affordance, or a bounded carousel. `overflow:hidden` plus a forced minimum grid width is the wrong combination.

## T-11 — V-11 faint Credit card caption — High confidence

**Files**

- `src/styles/canonical-credit-card-stack-1.css`
- `src/styles/canonical-credit-card-stack-3.css`

The Piraeus green card correctly defines light semantic tokens:

```css
--card-text:#eee7d5;
--card-muted:rgba(238,231,213,.62);
```

However, the card nickname/caption uses the muted token at only `.66rem`.

**Technical conclusion:** this is primarily a size/emphasis problem rather than the wrong dark/light token. Increase the card-identity caption's readable floor and/or muted opacity on dark card surfaces. Do not replace the entire Piraeus green text palette.

## T-12 — V-12 Loans wide-desktop imbalance — High confidence

**File:** `src/styles/loans-approved-target.css`

The exact geometry creates the screenshot:

```css
.loan-list-row .installment-segments {
  width:min(520px,62%);
}

.loan-list-row .loan-list-meta > span {
  min-width:126px;
}
```

Meanwhile the row itself spans the full workspace and places actions at the far right.

**Technical conclusion:** the progress/meta region is artificially capped while the outer card continues to expand. The wide-screen grid should allocate a coherent progress column or allow the progress track/meta cluster to scale with the card instead of stopping at 520px.

## T-13 — V-13 Recurring whitespace and compressed operations — High confidence

**Files**

- `src/styles/recurring-approved-target.css`
- `src/pages/RecurringPage.tsx`

The summary region is deliberately capped:

```css
.recurring-approved-page > .recurring-summary-grid {
  width:min(100%,900px);
}
```

That is the direct cause of the unused right half on a wide desktop.

The table also explicitly uses:

- base `font-size:9px`
- headers `8px`
- secondary rows `7.8px`
- action gap `6px`
- payment-action label `8px`

**Technical conclusion:** the page simultaneously limits summary width and over-compresses the operational table. Remove/revisit the 900px desktop cap and use the shared readability scale plus a less cramped action-cell contract.

## T-14 — V-14 Reports dark-theme budget contrast — High confidence

**File:** `src/pages/ReportsPage.css`

The budget status cards use light-theme RGBA backgrounds regardless of resolved theme:

```css
.report-budget-summary-grid > article.positive {
  background:rgba(232,250,244,.58);
}
.report-budget-summary-grid > article.warning {
  background:rgba(255,247,222,.62);
}
.report-budget-summary-grid > article.negative {
  background:rgba(255,238,242,.62);
}
```

At the same time their text uses theme-aware `var(--ink)` / `var(--muted)`. In dark theme those text tokens become light, but the status background remains a pale translucent color. The result is the observed light-on-light contrast failure.

The same file also deliberately uses many `.58rem`–`.72rem` labels, contributing to the Reports scanability issue.

**Technical conclusion:** semantic status surfaces must be derived from theme semantic tokens (or `color-mix()` against the current surface), not fixed light-theme RGBA values. Contrast tests should cover these specific budget classes in dark mode.

## T-15 — V-15 Settings localization/low-emphasis labels — High confidence for localization

**File:** `src/components/ReadabilitySettings.tsx`

The theme choices are literal strings:

- `Σύστημα`
- `Light`
- `Dark`

The mixed-language result in the screenshot is therefore source-authored, not browser behavior.

**Technical conclusion:** if the UI language contract is Greek, the visible labels should be localized consistently (while internal values remain `light` / `dark`). Inactive-tab legibility should use the shared secondary-text token and readable-size floor rather than further reducing opacity/size.

## T-16 — V-16 User & Access field-state inconsistency — Medium confidence

**Files**

- `src/components/AccountSecuritySettings.tsx`
- `src/components/AccountSecuritySettings.css`

The current-password field explicitly uses:

```tsx
autoComplete="current-password"
```

while the base field CSS sets its own background but does not visibly define a dedicated browser-autofill normalization contract. The rendered current-password field's lighter fill is therefore consistent with browser/password-manager autofill styling winning or blending with the app surface.

**Technical conclusion:** verify computed `:autofill` / `:-webkit-autofill` styles in Chromium and normalize them with theme-safe tokens if confirmed. Do not remove useful `autocomplete` semantics merely to make the fields look identical.

The PIN dots should likewise use a semantic border/fill token with sufficient dark-theme contrast rather than relying on very faint neutral styling.

## Findings intentionally not expanded into unrelated code work

The visual audit did **not** identify an additional structural defect in Lending, Planning or Attention beyond the cross-cutting typography/brand-mark issues already mapped above. No backend, Supabase, finance-engine, auth, Windows or Android conclusions are drawn from this audit.

## Recommended implementation grouping

If these findings are implemented later, the safest coherent batches are:

1. **Shared readability/theme batch:** T-02, T-04, T-14, T-15, T-16.
2. **Dashboard semantics/state batch:** T-01, T-03, T-05.
3. **Transactions batch:** T-06, T-07.
4. **Cards/Credit batch:** T-09, T-10, T-11.
5. **Wide-layout batch:** T-08, T-12, T-13.

Each batch should rerun only the affected rendered evidence first, then the repository-required final visual/full gates on the final integrated review head. No quality threshold should be weakened to accept the current rendering.
