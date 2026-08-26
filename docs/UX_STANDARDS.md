# MyFinHub UI/UX standards

These are the application-wide accessibility and interaction-quality requirements. They remain mandatory during the desktop redesign. Evolving visual decisions for the redesign are recorded under `docs/ui-redesign/`; do not duplicate speculative design tokens here.

The interface uses **accessible neo-neumorphism**, not low-contrast pure neumorphism. The redesign may evolve the visual expression while preserving these quality constraints.

- Strong text/control contrast and visible boundaries.
- Minimum practical hit areas above WCAG 2.2's 24×24 CSS-pixel baseline.
- Explicit enabled, hover, focus, pressed, selected, disabled, saving, error, and conflict states.
- Motion communicates hierarchy/state change; it is not decorative noise.
- `prefers-reduced-motion` disables non-essential animation.
- Status feedback appears near the relevant task (save state, review confidence, split balance, reconciliation delta).
- Dense finance data uses lists/tables/charts rather than turning every datum into a card.
- Neumorphic shadows never replace semantic borders/focus rings.

## Current redesign scope

Phase 1 owner approval is desktop-only. Existing tablet/mobile web behavior remains regression-protected, but visual redesign of those viewports is deferred. Android is a separate native project. See `docs/ui-redesign/PROJECT_SCOPE.md` for the authoritative current-phase boundary.

Primary references used for these baseline standards:
- W3C WCAG 2.2: contrast, non-text contrast, target size, focus visibility.
- Material Design 3: consistent interaction states and state layers.
- Apple Human Interface Guidelines: purposeful motion, feedback, reduced motion.
