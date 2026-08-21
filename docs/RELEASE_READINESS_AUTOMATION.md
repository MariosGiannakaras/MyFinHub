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
- `scripts/bundle-budget.mjs` makes the main JS, chart JS and CSS ceilings executable build contracts.
- `tests/release-readiness-source.test.ts` guards the lazy-route/chart-import boundary.

## Browser-engine coverage

The complete rendered QA harness remains intentionally **Chromium-specific**. It launches Chromium/Chrome and drives it through the Chrome DevTools Protocol (CDP), including `Runtime`, `Page`, `Network`, `Emulation` and `Input` domains. This provides deep deterministic coverage but is not Safari evidence.

A second, deliberately small compatibility gate now lives in `.github/workflows/cross-engine-smoke.yml` and `scripts/webkit-smoke.mjs`. It uses the pinned stable **Playwright 1.62.1 / WebKit 26.5** toolchain, installed transiently in that job so Playwright does not become an application/runtime dependency or alter the application lockfile.

The isolated WebKit smoke covers:

1. Login identity/password interaction and MFA focus/6-digit submission readiness.
2. Desktop shell navigation and narrow-mobile bottom/more navigation.
3. App-owned account-select listbox and app-owned date grid.
4. Quick Add focus, Escape close and mobile containment.
5. Reports chart rendering, accessible text alternative and horizontal-overflow checks.
6. MyFinHub browser/shell identity.
7. One real Quick Add expense mutation followed by app-level undo.
8. A small desktop/mobile WebKit screenshot artifact rather than a duplicated full visual matrix.

The WebKit job intentionally **does not** invoke `npm run qa:frontend`. Primary Chromium remains the authoritative full deterministic regression/screenshot gate; WebKit is a focused compatibility gate. `tests/release-readiness-source.test.ts` locks the Playwright version, WebKit-only install, non-duplication rule and representative coverage contract.

WebKit on GitHub-hosted Linux is useful engine-level compatibility evidence. It is still **not** evidence for physical iPhone Safari behavior, iOS virtual keyboard/viewport quirks, or VoiceOver integration.

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

CI engine automation is not evidence for:

- real iPhone/iOS Safari;
- real Android Chrome;
- NVDA + browser announcements;
- VoiceOver + Safari announcements;
- clean-user Windows NSIS installation identity (Start Menu/Desktop/taskbar/uninstall UI);
- post-deployment production smoke.

Those items must remain open in #165 until real evidence exists or the owner explicitly records them as manual pre-release gates.

## No release authorization

This hardening work does not merge any stacked feature PR, bump a version, publish an installer, deploy production, or close #165 while real-device/assistive-tech gates remain outstanding.
