# Release-readiness automation checkpoint

This document records the repository/CI evidence used for MyFinHub release-readiness tracking. Issue #165 is complete and closed. Human-only physical-device, assistive-technology and browser-owned visual checks are not repository completion gates.

## Current integration baseline

Production remains **v1.0.2** on `main@d054ad549549c19039b70e76780e84feca7f3104`.

The completed development batch is integrated in `develop`:

- PR #179 merged as `cdad04e67bfb5d782e9971f85f44ab51b0aef706` and contains the verified UI/UX/branding/Reports hardening, ledger/product roadmap and automated release-readiness work.
- PR #181 merged as `78afee74db4893f208b14536123f1232625422eb` and closes the final Dashboard order, visible privacy-safe session history and route-shaped skeleton gaps.
- PR #182 merged as `6b015b7e73a0a23d844fc99bc6631901631ce148` and completes the #165 automation closeout with stronger installed-Windows validation and synchronized release-readiness state.
- Current `develop` is three integration commits ahead of the v1.0.2 `main` baseline.

Final exact-head automated evidence for PR #182:

- CI #755: success.
- CodeQL #709: success.
- Cross-engine smoke #54: success.
- Performance smoke #49: success.
- Windows Desktop #410: success.
- Primary Chromium remains mandatory.

## Bundle and loading architecture

The production build enforces explicit budgets for the eager main application JS, chart chunk and application CSS through `scripts/bundle-budget.mjs`. A ceiling is a regression boundary, not a target to raise when a new eager import appears.

Feature pages in `src/App.tsx`, including Reports, remain route-lazy through `React.lazy`. `recharts` remains imported by the lazy Reports page rather than the eager shell, preserving the separate chart chunk. Source regression coverage in `tests/release-readiness-source.test.ts` protects the route-lazy and chart-import boundary.

## Browser-engine and responsive coverage

The complete rendered QA harness is Chromium-specific and uses CDP for deep deterministic coverage. CI requires the primary Chromium binary; a Google Chrome fallback cannot make the gate green.

A separate focused compatibility workflow, `.github/workflows/cross-engine-smoke.yml`, uses pinned Playwright/WebKit and covers representative Login/MFA, desktop/mobile shell navigation, app-owned select/date controls, Quick Add focus/close behavior, Reports rendering/text alternatives, branding and a real mutation + undo.

The automated mobile matrix covers dedicated narrow/mobile viewports and protects touch-target geometry, overflow, fixed/sticky layout behavior and route rendering at the source/browser-engine level.

## Accessibility evidence

Accessibility is enforced through source and rendered-browser contracts rather than a human screen-reader gate. Coverage includes:

- labels, descriptions, validation/error and busy-state semantics;
- modal title/description relationships, focus entry/return and Escape behavior;
- app-owned select/date keyboard and ARIA semantics;
- command/Quick Add focus behavior;
- privacy-sensitive control labels;
- Reports headings, KPI/progress semantics and chart text alternatives;
- minimum touch-target and narrow-mobile interaction constraints.

Physical NVDA/VoiceOver sessions are not a repository completion requirement.

## Production-mode performance evidence

`.github/workflows/performance-smoke.yml` builds the QA fixture in production mode and runs pinned Lighthouse plus the loading-shift audit. It checks desktop Dashboard, desktop Reports, narrow-mobile Dashboard and an extreme mobile fixture.

The regression contract covers performance/accessibility/best-practices scores, LCP, CLS and TBT, plus a direct skeleton-to-content layout-shift guard and horizontal-overflow checks. These are deterministic CI regression measurements, not field Core Web Vitals claims.

## Browser / installed-web-app identity

Automated source checks verify:

- document title is `MyFinHub`;
- manifest `name` and `short_name` are `MyFinHub`;
- standalone `start_url` is `/`;
- Apple touch icon resolves to the MyFinHub 192px asset;
- manifest 192px and 512px icon entries resolve to repository assets;
- scalable 512 artwork declares 512×512 geometry;
- light/dark branding assets are present and locally owned.

Browser-owned install prompts/splash presentation are not repository completion gates.

## Windows installed-package automation

The Windows workflow builds the unpacked app, launches the packaged executable/backend, builds the per-user NSIS package and verifies the update-channel checksum.

PR #182 strengthens that gate with a **real install/launch/uninstall smoke** on a fresh GitHub-hosted Windows runner:

1. Build the NSIS installer.
2. Install it silently into the runner user profile.
3. Verify the installed Desktop shortcut and Start Menu shortcut use `MyFinHub` identity.
4. Resolve the shortcut target and verify `MyFinHub.exe` plus executable product/file-description metadata.
5. Extract and validate a usable associated Windows icon from the installed executable.
6. Verify a `MyFinHub` uninstall registration across standard Windows uninstall registry views, including a non-empty uninstall command.
7. Launch the installed executable, require that the process remains alive and verify that it runs from the installed `MyFinHub.exe` path.
8. Run the generated uninstaller silently.
9. Verify the installed executable and shortcuts are removed.

Source regression coverage also locks `PRODUCT_NAME = 'MyFinHub'`, BrowserWindow titles and the application/setup icon contracts. No separate human Windows visual check is required by the repository readiness contract.

## Completion

Issue #165 is complete and closed because PR #182 passed all required exact-head GitHub gates and was integrated into `develop`.

Human-only physical-device, screen-reader and browser-owned visual checks are explicitly out of scope and do not block repository readiness.

A future production release remains a separate deliberate workflow. Production deployment, release smoke, tag/version changes and public installer publication are performed and verified only when a separately approved `develop -> main` release occurs.

## Release boundary

None of the #165/#182 closeout work authorized or performed a version bump, `develop -> main` merge, production deployment, GitHub Release/tag or installer publication. Production remains v1.0.2 until a separate release action is approved.
