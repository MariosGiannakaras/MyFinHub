# Release-readiness automation checkpoint

This document records what repository/CI automation can prove without misrepresenting emulation as physical-device or assistive-technology evidence. Canonical tracking remains issue #165. The concrete manual evidence template is `docs/RELEASE_READINESS_MANUAL_EVIDENCE.md`.

## Current integration baseline

Production remains **v1.0.2** on `main@d054ad549549c19039b70e76780e84feca7f3104`.

The completed development batch is integrated in `develop`:

- PR #179 merged as `cdad04e67bfb5d782e9971f85f44ab51b0aef706` and contains the verified UI/UX/branding/Reports hardening, ledger/product roadmap and automatable release-readiness work.
- PR #181 merged as `78afee74db4893f208b14536123f1232625422eb` and closes the final Dashboard order, visible privacy-safe session history and route-shaped skeleton gaps.
- The PR #181 validated candidate tree is identical to the merged `develop` tree.
- No feature PR remains open. Issue #165 intentionally remains open for real-device, real assistive-technology, remaining installed-surface and release-only evidence.

Final exact-head automated evidence before #181 integration:

- CI #743: success — 48/48 test files, 228/228 tests, production build/API checks, bundle budgets and complete primary-Chromium rendered QA.
- CodeQL #697: success.
- Cross-engine smoke #43: success.
- Performance smoke #37: success.
- Windows Desktop #398: success — unpacked build, packaged executable/backend smoke, NSIS build and checksum verification.
- Primary Chromium remained mandatory with zero fallback activations.

## Bundle and loading architecture

The production build enforces explicit budgets for the eager main application JS, chart chunk and application CSS through `scripts/bundle-budget.mjs`. A ceiling is a regression boundary, not a target to raise when a new eager import appears.

Feature pages in `src/App.tsx`, including Reports, remain route-lazy through `React.lazy`. `recharts` remains imported by the lazy Reports page rather than the eager shell, preserving the separate chart chunk. Source regression coverage in `tests/release-readiness-source.test.ts` protects the route-lazy and chart-import boundary.

## Browser-engine coverage

The complete rendered QA harness is intentionally Chromium-specific and uses CDP for deep deterministic coverage. CI requires the primary Chromium binary; a Google Chrome fallback cannot make the gate green.

A separate focused compatibility workflow, `.github/workflows/cross-engine-smoke.yml`, uses pinned Playwright 1.62.1 / WebKit 26.5. It covers representative Login/MFA, desktop/mobile shell navigation, app-owned select/date controls, Quick Add focus/close behavior, Reports rendering/text alternatives, branding and one real mutation + undo.

This WebKit coverage has already found and prevented an engine-specific fixed-position/backdrop-filter regression. It remains engine-level evidence only. It is not physical iPhone Safari or VoiceOver evidence.

## Production-mode performance evidence

`.github/workflows/performance-smoke.yml` builds the QA fixture in production mode and runs pinned Lighthouse 13.4.1 plus the loading-shift audit. It checks desktop Dashboard, desktop Reports, narrow-mobile Dashboard and an extreme mobile fixture.

The regression contract covers performance/accessibility/best-practices scores, LCP, CLS and TBT, plus a direct skeleton-to-content layout-shift guard and horizontal-overflow checks. These are synthetic regression measurements, not field Core Web Vitals claims.

## Browser / installed-web-app identity

Automated source checks verify:

- document title is `MyFinHub`;
- manifest `name` and `short_name` are `MyFinHub`;
- standalone `start_url` is `/`;
- Apple touch icon resolves to the MyFinHub 192px asset;
- manifest 192px and 512px icon entries resolve to repository assets;
- the scalable 512 asset declares 512×512 geometry.

Actual browser-owned install UI, splash/standalone identity and home-screen presentation remain manual checks because CI cannot substitute for those browser surfaces.

## Windows installed-package automation

The Windows workflow already built the unpacked app, launched the packaged executable/backend, built the assisted per-user NSIS package and verified the update-channel checksum.

The #165 closeout work strengthens that gate by also performing a **real install/launch/uninstall smoke** on the fresh GitHub-hosted Windows runner:

1. Build the assisted NSIS installer.
2. Install it silently into the runner user profile.
3. Verify the installed Desktop shortcut and Start Menu shortcut use `MyFinHub` identity.
4. Resolve the shortcut target and verify `MyFinHub.exe` plus executable product/file-description metadata.
5. Extract and validate a usable associated Windows icon from the installed executable.
6. Verify a `MyFinHub` uninstall registration across the standard current-user, machine and WOW6432Node uninstall registry views, including a non-empty uninstall command.
7. Launch the installed app and require a `MyFinHub` main-window title.
8. Run the real generated uninstaller silently.
9. Verify the installed executable and shortcuts are removed.

This gives materially stronger installed-package evidence than build-only CI. A final visual check of the interactive installer, taskbar/window icon and absence of user-facing legacy artwork remains manual and is recorded in `docs/RELEASE_READINESS_MANUAL_EVIDENCE.md`.

## Explicitly manual / environment-dependent gates

Automation is not evidence for:

- real iPhone/iOS Safari touch, keyboard, viewport and safe-area behavior;
- real Android Chrome touch/keyboard behavior;
- NVDA + Chrome/Chromium announcements and navigation;
- VoiceOver + Safari announcements and navigation;
- final visual Windows installer/Desktop/Start Menu/taskbar identity;
- browser-owned installed-web-app/PWA UI;
- post-deployment production smoke before a deployment actually exists.

Those checks stay open in #165 until actual evidence exists or the owner explicitly dispositions them. Use `docs/RELEASE_READINESS_MANUAL_EVIDENCE.md` so device/browser/AT versions and concrete results are durable rather than remembered informally.

## Release boundary

None of the release-readiness automation authorizes a version bump, `develop -> main` merge, production deployment, GitHub Release/tag or installer publication. Production remains v1.0.2 until a separate owner-approved release action is performed.
