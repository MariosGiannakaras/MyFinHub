# Release-readiness automation checkpoint

This document records what can be proven from repository/CI automation without misrepresenting emulation as physical-device or assistive-technology evidence. Canonical tracking remains issue #165.

## Candidate baseline

Baseline feature head before this hardening branch: `47180c096e05c8c8b0d840e8944321cef3f2fd99`.

Latest verified production-build output on that baseline:

| Asset | Raw | Gzip | Enforced ceiling |
| --- | ---: | ---: | ---: |
| Main application JS | ~463.4 KiB | ~142.9 KiB | 525 / 165 KiB |
| Recharts/chart chunk | ~343.7 KiB | ~100.2 KiB | 380 / 115 KiB |
| Application CSS | ~217.2 KiB | ~41.0 KiB | 240 / 46 KiB |

The ceilings intentionally leave limited headroom for toolchain/hash variation while making a material eager-import or dependency regression fail the normal production build. A ceiling should not be raised merely to make CI green; first inspect route splitting, duplicate dependencies and new eager imports.

## Loading architecture

- Feature pages in `src/App.tsx`, including Reports, are loaded through `React.lazy`.
- `recharts` is imported by the lazy Reports page rather than the eager application shell.
- Current Vite output therefore keeps the chart implementation in a separate `CartesianChart-*` chunk.
- `scripts/bundle-budget.mjs` now makes the main JS, chart JS and CSS ceilings executable build contracts.
- `tests/release-readiness-source.test.ts` guards the lazy-route/chart-import boundary.

## Browser-engine inventory

The existing rendered QA harness is intentionally **Chromium-specific**. It launches Chromium/Chrome and drives it through the Chrome DevTools Protocol (CDP), including `Runtime`, `Page`, `Network`, `Emulation` and `Input` domains. This provides deep deterministic coverage but is not WebKit/Safari evidence.

The critical flows suitable for a future isolated WebKit-compatible smoke are:

1. Login/MFA shell labels, errors and focus.
2. Desktop and narrow-mobile navigation.
3. App-owned select/date controls.
4. Modal focus, Escape and focus return.
5. Reports layout, text alternatives and chart rendering.
6. Branding/PWA identity assets.
7. One representative financial mutation with undo.

These should **not** be bolted onto the raw-CDP helpers. A WebKit smoke should use a separate WebKit-capable automation layer (for example Playwright WebKit) and remain a small compatibility suite rather than duplicate the complete primary-Chromium screenshot matrix. The existing Chromium suite remains the authoritative deterministic regression gate.

A WebKit runtime is not currently declared in the repository dependencies or Actions setup, so desktop/narrow WebKit execution remains pending rather than being falsely marked complete.

## PWA/browser identity

Automated source checks verify:

- document title is `MyFinHub`;
- manifest `name` and `short_name` are `MyFinHub`;
- standalone start URL is `/`;
- the Apple touch icon resolves to the 192px MyFinHub asset;
- manifest 192px and 512px icon entries resolve to repository assets;
- the 512 SVG declares 512×512 geometry.

Actual browser install UI/splash rendering still requires a supported installed-browser/manual run and remains a release-readiness gate.

## Explicitly manual / environment-dependent gates

Automation on GitHub-hosted Chromium runners is not evidence for:

- real iPhone/iOS Safari;
- real Android Chrome;
- NVDA + browser announcements;
- VoiceOver + Safari announcements;
- clean-user Windows NSIS installation identity (Start Menu/Desktop/taskbar/uninstall UI);
- post-deployment production smoke.

Those items must remain open in #165 until real evidence exists or the owner explicitly records them as manual pre-release gates.

## No release authorization

This hardening work does not merge any stacked feature PR, bump a version, publish an installer, deploy production, or close #165 while real-device/assistive-tech gates remain outstanding.
