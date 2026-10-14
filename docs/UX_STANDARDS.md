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


## App-wide shared design standard

MyFinHub uses a **shared-first design system**. The default visual language is not owned by individual pages.

- **Same role, same contract:** default fields/input shells, selectors, date controls, money controls, buttons, dialogs, surfaces, badges, tabs, alerts and analogous controls use the same shared primitive/token/variant contract wherever their user-facing role is the same.
- **Owner-approved baseline:** the visual language established through the approved Quick Entry/reference reconciliation is the application-wide baseline for shared controls and surfaces. This means consistent semantic background/border ownership, radius family, typography, focus treatment, invalid/disabled/autofill states, Light/Dark behavior and responsive/touch behavior. Quick Entry-specific composition such as its modal layout or floating-label choreography may remain contextual; the underlying control boxes do not become a separate design system.
- **Shared variants before local CSS:** a recurring contextual need such as compact density, destructive tone, read-only presentation or specialized financial input should become an explicit shared variant when it has more than one credible consumer. Do not reproduce the default control appearance in page-local CSS.
- **Layout may differ; branding should not drift:** Login/MFA, Settings, finance editors and Quick Entry can have different information architecture and composition while still using the same branded primitives.
- **Exceptions are deliberate:** a one-off local visual/interaction exception is allowed only when a real domain, accessibility, security, responsive or interaction requirement makes the shared contract unsuitable and a reusable variant would be misleading.
- **Conflict rule:** when an exception would conflict with another accepted product or visual contract and the choice cannot be made without changing owner intent, the implementation stops and asks the owner which contract should win. Technical conflicts that can preserve both contracts are reconciled without creating a new exception.
- **Shared-owner acceptance:** when a shared primitive/token changes, validate representative consumers rather than only the originating screen. At minimum cover the materially affected Light/Dark, desktop/mobile, focus/error/disabled and relevant density/variant states.


## Preventive UI acceptance contract

For every user-visible change, implementation begins from the credible failure modes of the affected surface rather than from the happy-path screenshot alone.

- **Geometry invariants:** no unintended horizontal page overflow; no clipped or overlapping text/actions; dialogs, popovers and menus remain inside the usable viewport; controls do not cover financial values or primary actions.
- **Responsive invariants:** shared behavior is verified at the breakpoint classes materially affected by the change. A desktop fix must not silently collapse tablet/mobile composition, and a mobile adaptation must not become a shrunken desktop table.
- **Theme invariants:** semantic foreground/background/border/status colors come from shared theme ownership where possible and remain legible in both Light and Dark themes. Media/logo assets must not receive synthetic halos or surfaces unless the component contract explicitly requires them.
- **Data-state invariants:** populated, empty, loading, error and conflict states that exist for the surface remain deliberate and understandable. Empty states must not look like failed rendering.
- **Content-stress invariants:** layouts that display owner-provided names, descriptions, account identifiers, dates or monetary values must tolerate representative long Greek text, large values and dense rows without relying on one fixture's short content.
- **Interaction/accessibility invariants:** keyboard focus, semantic names/states, target sizing, disabled behavior and reduced-motion behavior remain intact across responsive/theme variants.
- **Shared-owner rule:** when the same defect can occur in multiple consumers because they share a primitive, token, selector or data contract, fix and regression-test the shared owner instead of applying parallel page-specific styling.
- **Rendered acceptance:** containment is necessary but not sufficient. Direct evidence must also show correct finance/product hierarchy, readable information density, coherent state communication and alignment with accepted owner intent.

Use the smallest state matrix that covers the credible blast radius of the change; do not generate every permutation when structural equivalence is already proven by a shared primitive/regression guard.

Primary references used during redesign:
- W3C WCAG 2.2: contrast, non-text contrast, target size, focus visibility.
- Material Design 3: consistent interaction states and state layers.
- Apple Human Interface Guidelines: purposeful motion, feedback, reduced motion.
