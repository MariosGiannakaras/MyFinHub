# Approved ↔ Actual visual implementation protocol

This protocol applies to Chat B (UI Implementation Engineer) for every owner-approved desktop redesign target.

## Core rule

The attached owner-approved image is the authoritative visual target for presentation. It is **not** a loose inspiration, mood board, or style reference.

Repository functionality, finance/security invariants, realistic data behavior and accessibility still take precedence when there is a real conflict. Outside those conflicts, the implementation must reproduce the approved target's composition and visual system materially and deliberately.

## Mandatory target analysis before code changes

Before touching production UI code, Chat B must visually inspect the exact approved image and decompose it into an internal visual contract covering at least:

- application shell geometry: sidebar width, top bar height, content bounds and page gutters;
- section order and vertical rhythm;
- grid/column structure and relative widths;
- card/surface dimensions, padding, radii, borders and shadows;
- typography hierarchy, approximate sizes/weights and alignment;
- icon placement, icon container treatment and control sizing;
- chart type, series count, legend placement, plot density and chart-to-text balance;
- table/list row density, column alignment and visible record count;
- button placement, labels and action hierarchy;
- spacing between all major regions;
- color roles and semantic status treatment;
- visible data-density expectations and important states;
- footer/KPI strip composition when present.

The target must be analyzed region-by-region, from top-left to bottom-right. Do not start implementation from a vague overall impression.

If the environment cannot visually access the pixels of the attached approved image, stop and report that as a genuine blocker. Do not implement from memory, filename, previous screenshots or textual inference.

## Three-part contract

For each target element, classify it internally as one of:

### MUST MATCH
Presentation that should materially match the approved image:

- structure and section order;
- relative geometry and sizing;
- spacing and alignment;
- typography hierarchy;
- card/surface treatment;
- chart composition;
- list/table density;
- control placement and visual hierarchy;
- icon treatment;
- colors and status styling where compatible with accessibility.

### MUST ADAPT TO REAL DATA
The UI shape must match, but values remain dynamic:

- balances and currency amounts;
- dates;
- transaction names and categories;
- account names and masked identifiers;
- chart values;
- trend percentages;
- counts and statuses.

Do not hard-code screenshot values into production UI just to match the image.

### MUST PRESERVE FUNCTIONALLY
Repository behavior that may not be visually obvious in the target:

- routes and navigation;
- actions and forms;
- validation;
- loading/empty/error/disabled/conditional states;
- finance/accounting semantics;
- authentication/security behavior;
- accessibility and keyboard behavior;
- responsive regression safety.

## Representative QA data

Approved targets may show a dense, realistic state. Visual QA must exercise a representative data state that can actually render the target structure.

If the existing deterministic QA fixture is too sparse to exercise approved components (for example, missing secondary accounts, too few transactions, missing categories, or nearly empty charts), update the QA fixture/state rather than accepting a visually empty Actual screenshot.

Fixture changes must remain valid against the real data model and must not become screenshot-specific production hard-coding.

If the approved target shows functionality that the repository genuinely does not support, stop and report the product/design conflict instead of inventing it.

## Mandatory implementation loop

1. Analyze the approved image into the visual contract above.
2. Inspect the corresponding current implementation and shared components.
3. Implement the smallest maintainable delta that satisfies the approved contract.
4. Run relevant tests.
5. Render a fresh Actual screenshot using the same canonical desktop review conditions.
6. Inspect Approved and Actual side-by-side, region-by-region.
7. Record material mismatches internally by region.
8. Fix the mismatches.
9. Re-render Actual.
10. Repeat until no material visual mismatch remains, or a justified invariant/accessibility conflict is documented.

Do not treat a single implementation pass as sufficient by default.

## Approved ↔ Actual comparison order

Compare in this order:

1. global frame and page bounds;
2. sidebar and top navigation;
3. page title/header actions;
4. primary summary/account row;
5. secondary account or summary strip;
6. mid-page content grid;
7. tables/lists and row density;
8. charts and graph density;
9. financial-summary panels;
10. bottom KPI/summary strip;
11. typography/icon/detail pass;
12. whitespace, borders, radii and final polish.

A material mismatch in an earlier layer must be fixed before fine-detail polish later in the page.

## Forbidden shortcuts

Do not:

- treat the approved image as merely a style guide;
- preserve the old layout when the approved target clearly changes it;
- declare success because the same kinds of cards/charts exist;
- accept empty or sparse QA regions when the target demonstrates supported dense states;
- replace target chart types with easier existing charts without a real technical conflict;
- move sections substantially while claiming the intent is preserved;
- ignore major differences in relative widths/heights;
- declare `VERIFIED` after only tests/build without visual inspection;
- merge while known material Approved ↔ Actual differences remain unresolved.

## Verification gate

A surface cannot be marked `VERIFIED` and its PR cannot be merged for routine redesign work while any known material mismatch remains in:

- overall layout;
- section order;
- major component geometry;
- visual hierarchy;
- chart composition;
- data density;
- action placement;
- typography scale;
- spacing/alignment;
- primary color/surface treatment.

Small rasterization/font-rendering differences are acceptable. Structural or clearly visible design differences are not.

## Completion evidence

The final implementation report must state that the exact attached Approved target was visually inspected and that a fresh Actual render was compared against it after the final correction pass. If intentional deviations remain, list only genuine functionality/accessibility/invariant reasons.
