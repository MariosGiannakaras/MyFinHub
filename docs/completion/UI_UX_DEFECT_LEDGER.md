# UI/UX defect ledger

Owner: ChatGPT direct design/development audit  
Scope: MyFinHub web/desktop application only  
Last updated: 2026-10-02

## Severity model

- **Critical** — blocks safe use or exposes data.
- **High** — materially breaks task completion, readability or accessibility on a supported surface.
- **Medium** — significant inconsistency or usability defect with a viable workaround.
- **Low** — polish/evidence defect with no meaningful task or data impact.

## Current defects

| ID | Severity | Affected surfaces | Direct finding | Systemic root cause | Preferred remediation layer | Proof state |
| --- | --- | --- | --- | --- | --- | --- |
| FV-46 | Medium | Reports · mobile · dark | Privacy placeholder becomes a conspicuous light card in dark mode. | Fixed light-only background in responsive CSS instead of semantic theme tokens. | Shared semantic surface/status tokens; page CSS only for layout. | Source remediation tracked; dual-theme rendered reproof required. |
| FV-47 | High | Settings → Icons · dark | Category/subcategory/icon-workspace cards become pale with low-contrast text. | Local white/light RGBA surfaces bypass the shared theme system. | Settings/shared inset/control tokens; remove page-local light surfaces. | Source remediation tracked; desktop/tablet/mobile dark reproof required. |
| FV-48 | Medium | Settings → Rules · dark | Empty state renders as a large pale low-contrast panel. | Fixed light empty-state background. | Shared empty/inset surface token. | Source remediation tracked; rendered reproof required. |
| FV-49 | High | Settings → User & Access · dark | PIN/security inputs and no-device state lose dark-theme legibility. | Account-security controls own light-only idle/input backgrounds. | Shared control/input/empty-state tokens across Settings security surfaces. | Source remediation tracked; rendered + focus/disabled reproof required. |
| FV-50 | High | Credit · mobile · dark | Purchase/repayment rows become pale cards while dark-theme text remains, reducing legibility. | Mobile table-to-card rule hard-codes a light border/background. | Semantic table/card tokens in the shared mobile finance presentation layer. | Source regression contract + rendered reproof required. |
| FV-51 | High | Lending · desktop · dark | Search, selected person, metric cards, information strip and table heading become pale/low-contrast. | Multiple desktop-only fixed light RGBA workspace surfaces. | Lending shared workspace tokens for selected/control/metric/status/table surfaces. | Source remediation tracked; desktop dark reproof required. |
| FV-52 | High | Recurring · desktop/tablet · dark | Active recurring groups/rows and tablet heading become pale bands with poor text contrast. | Fixed light row/group backgrounds outside semantic surface tokens. | Recurring group/row/table-heading semantic tokens. | Source regression contract + rendered reproof required. |
| FV-53 | High | Planning · desktop · dark | Scheduled rows, forecast cards, segmented controls and info strip become pale and partially unreadable. | Fixed light page-local surfaces across forecast/table controls. | Planning shared control/surface/status tokens; keep risk colors semantic. | Source regression contract + rendered reproof required. |
| A11Y-404-FOCUS | Low | 404 | Programmatic H1 focus produced a visible halo in final visual evidence. | Focus-visible styling did not distinguish heading focus from interactive focus. | 404 heading-specific presentation while preserving focus ownership. | Fix integrated; exact-head recapture required. |
| QA-AUTH-ANIM | Low | Login/MFA evidence | Direct artifact inspection found downgrade screenshots captured during auth entrance motion, making evidence look washed out. | Runtime screenshot harness captured immediately after state transition instead of after finite entrance motion completed. | QA harness timing only; product animation remains unchanged. | Harness waits 430 ms before MFA/login recovery captures; exact-head rerun required. |

## Systemic causes

1. **Theme-token bypass** — fixed white/light RGBA backgrounds inside page-specific responsive CSS. Fix shared semantic surface/control/inset/status tokens rather than accumulating dark-mode overrides.
2. **Component ownership drift** — specialized pages occasionally own generic control/panel chrome. Keep domain layout local but move generic surface/control styling to shared primitives/tokens.
3. **Evidence timing drift** — animated state transitions can produce misleading screenshots if capture occurs before settling. Evidence harnesses must wait for both product state and finite entrance motion.
4. **Accessibility presentation coupling** — programmatic focus must remain real for assistive/keyboard recovery without styling a non-interactive heading like an interactive control.

## Closure rule

A defect is not closed by source change alone. It closes only after the required rendered/runtime proof is generated on the candidate head and directly inspected. Shared-root-cause fixes require rechecking every affected surface.
