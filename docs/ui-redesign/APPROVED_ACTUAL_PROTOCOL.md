# Approved ↔ Actual visual implementation protocol

This protocol applies to every owner-approved Phase-1 desktop target. `IMPLEMENTATION_RULES.md` defines the complete resumable implementation workflow.

## What the Approved target controls

The exact owner-approved pixels are authoritative for the surface's intended presentation: application-shell geometry, section order, relative widths/heights, cards/surfaces, typography hierarchy, icon/control placement, tables/lists/charts, spacing, data density and visual status treatment.

The target is a reference for how information is presented, not a requirement to reproduce its literal sample values, names or branding. MyFinHub branding and real/deterministic application data remain valid. Do not distort finance logic or hard-code screenshot values to force numerical equality.

## What must adapt to repository behavior

Preserve existing routes, supported actions, validation, data semantics, auth/security, accessibility, keyboard behavior and responsive safety. Derived metrics must come from canonical repository domain/selectors with truthful period/sign/percentage labels.

If a target contains a reference-only control whose backend capability does not exist, it may remain as clearly non-operative/disabled presentation when needed for the composition. Never attach it to an unrelated handler or silently add persistence/schema/API behavior.

## Mandatory comparison loop

1. Inspect the exact Approved target region-by-region.
2. Inspect the current implementation and functional contract.
3. Implement the remaining maintainable delta.
4. Render a fresh representative desktop Actual.
5. Compare global frame, sidebar/topbar, page header, summary regions, filters, main grid/table/list/chart regions, detail/action panels, typography/icons and final spacing/surfaces.
6. Correct material differences.
7. Rerender and recheck.
8. Separately complete functional-parity verification.

A single render or green DOM assertion does not constitute visual verification.

## Acceptance

Small rasterization/font-engine differences and naturally different dynamic values are acceptable. Material differences in structure, relative geometry, visual hierarchy, data density, action placement, typography scale or spacing are not.

The surface cannot be marked `VERIFIED` or merged for routine redesign work until both Approved ↔ Actual and functional parity pass, required checks are green, and the final fresh Actual has been visually inspected.