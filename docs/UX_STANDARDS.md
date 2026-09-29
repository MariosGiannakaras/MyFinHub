# MyFinHub UI/UX standards

The interface uses a **flat, restrained premium-fintech surface system**. Hierarchy comes from typography, spacing, borders and selective elevation rather than embossed neumorphism.

- Strong text/control contrast and visible boundaries.
- Minimum practical hit areas above WCAG 2.2's 24×24 CSS-pixel baseline.
- Explicit enabled, hover, focus, pressed, selected, disabled, saving, error, and conflict states.
- Motion communicates hierarchy/state change; it is not decorative noise.
- `prefers-reduced-motion` disables non-essential animation.
- Status feedback appears near the relevant task (save state, review confidence, split balance, reconciliation delta).
- Dense finance data uses lists/tables/charts rather than turning every datum into a card.
- Elevation is restrained and directional; shadows never replace semantic borders or focus rings.
- Product JSX uses semantic `surface-*`/`Surface` primitives; legacy `neo-*` classes are not part of the active design system.

Primary references used during redesign:
- W3C WCAG 2.2: contrast, non-text contrast, target size, focus visibility.
- Material Design 3: consistent interaction states and state layers.
- Apple Human Interface Guidelines: purposeful motion, feedback, reduced motion.
