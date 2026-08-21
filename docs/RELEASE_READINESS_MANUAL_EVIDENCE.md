# Manual release-readiness evidence

Canonical tracker: issue #165.

This file is the durable evidence template for checks that repository automation cannot honestly replace. Do not mark a section complete from emulation, screenshots alone, or a CI engine surrogate. Record actual device/OS/browser or assistive-technology versions and the concrete result.

## A. Physical iPhone / iOS Safari

Status: **not yet executed**.

Record:

- device model:
- iOS version:
- Safari version/build:
- tested build/commit:
- date:

Required checks:

- [ ] Login and MFA labels, validation, busy state and OTP entry behave correctly.
- [ ] Bottom navigation and More sheet remain reachable and respect safe areas.
- [ ] Dashboard, Transactions, Savings, Cards, Credit, Loans, Lending, Recurring, Planning, Attention, Reports and Settings scroll without page-level horizontal overflow.
- [ ] Fixed/sticky controls remain attached to the viewport during touch scrolling.
- [ ] App-owned select and date controls open, scroll, select and close correctly.
- [ ] Opening the software keyboard does not hide the active control or primary action.
- [ ] Focusing form controls does not trigger unwanted page zoom.
- [ ] Modal focus, close and background-scroll behavior remain usable with touch.
- [ ] Reports charts and text alternatives remain readable in portrait and one landscape smoke.
- [ ] No clipping, overlap, stale browser chrome interaction or broken safe-area geometry is observed.

Evidence / notes:

- pending

## B. Physical Android / Chrome

Status: **not yet executed**.

Record:

- device model:
- Android version:
- Chrome version:
- tested build/commit:
- date:

Required checks:

- [ ] Login and MFA labels, validation, busy state and OTP entry behave correctly.
- [ ] Bottom navigation and More sheet remain reachable.
- [ ] All primary routes scroll without page-level horizontal overflow.
- [ ] Fixed/sticky controls remain stable during touch scrolling.
- [ ] App-owned select/date interactions work with touch and the Android keyboard.
- [ ] Keyboard appearance does not hide active form controls or commit actions.
- [ ] Modal focus/close/background-scroll behavior remains usable.
- [ ] Reports charts and text alternatives render correctly.
- [ ] No clipping, overlap or touch-target regression is observed.

Evidence / notes:

- pending

## C. NVDA + Chrome/Chromium on Windows

Status: **not yet executed**.

Record:

- Windows version:
- NVDA version:
- browser/version:
- tested build/commit:
- date:

Required checks:

- [ ] Login fields, password reveal, validation, busy state and errors have useful announcements.
- [ ] MFA code, progress/readiness and errors are understandable without visual context.
- [ ] Quick Add and command palette announce their purpose, focus the expected control, support keyboard navigation and restore focus on close.
- [ ] App-owned select announces combobox/listbox state, selected option and disabled options correctly.
- [ ] App-owned date control announces the field, active date/grid context and selected date coherently.
- [ ] Modal title/description/error context is announced and focus returns to the invoker.
- [ ] Dashboard privacy controls and masked values are understandable without relying on icon shape or color.
- [ ] Reports headings/KPIs/progress states and chart text alternatives provide a coherent reading order.
- [ ] No duplicate announcement, unlabeled action, focus loss or keyboard trap is found.

Evidence / defects:

- pending

## D. VoiceOver + Safari on macOS or iOS

Status: **not yet executed**.

Record:

- device/OS:
- VoiceOver version/build if available:
- Safari version:
- tested build/commit:
- date:

Required checks:

- [ ] Login/MFA fields, errors and busy states are announced coherently.
- [ ] Quick Add / command surface opening, navigation, close and focus return work with VoiceOver.
- [ ] App-owned select/date semantics are understandable and operable.
- [ ] Modal title/description/error context and focus return are correct.
- [ ] Reports headings, KPIs, progress states and chart text alternatives have a useful reading order.
- [ ] Privacy-sensitive controls are understandable without visual context.
- [ ] No duplicate announcement, unlabeled control or focus loss is found.

Evidence / defects:

- pending

## E. Installed Windows application

Automated CI now performs a real silent NSIS install on a fresh GitHub-hosted Windows runner, verifies the installed executable, Desktop and Start Menu shortcuts, uninstall registration, main-window title/process startup and clean silent uninstall. This is useful installed-package evidence, but it does not replace a final visual check of a normal user desktop/taskbar.

Manual status: **not yet executed**.

Record:

- Windows version:
- installer filename + SHA-256:
- tested build/commit:
- date:

Required manual visual checks:

- [ ] Interactive installer shows MyFinHub name and intended branding.
- [ ] Desktop shortcut label/icon is correct.
- [ ] Start Menu label/icon is correct.
- [ ] Running window title and taskbar icon are MyFinHub.
- [ ] Setup/uninstall UI uses MyFinHub identity.
- [ ] No user-facing legacy RheomIQ artwork appears.

Evidence / notes:

- pending

## F. Browser / installed-web-app identity

Status: **not yet executed**.

Repository automation already validates document title, manifest identity and the 192/512 icon assets. The remaining check is the browser-owned install surface itself.

Record:

- browser/OS:
- tested build/commit:
- date:

Required checks:

- [ ] Browser tab/favicon uses the intended MyFinHub mark in supported light/dark surfaces.
- [ ] Add-to-home/install UI shows `MyFinHub` rather than a legacy product name.
- [ ] Installed app icon resolves cleanly without broken 192/512 artwork.
- [ ] Launch/splash/standalone identity is consistent where the browser provides those surfaces.

Evidence / notes:

- pending

## G. Release-only evidence

Do not run or complete this section until a separate owner-approved `develop -> main` release is actually performed.

- [ ] Record released `main` SHA and version/tag.
- [ ] Verify Vercel production deployment corresponds to the exact released SHA.
- [ ] Run fresh Production Smoke after deployment.
- [ ] Verify production `/`, `/api/health`, unauthenticated `/api/data`, security headers and no-store behavior.
- [ ] Verify published Windows installer filename and SHA-256 against the release asset.
- [ ] Perform post-release web smoke.
- [ ] Perform post-release installed-web-app/PWA identity smoke where applicable.
- [ ] Synchronize final evidence into `STATUS.md` and issue #165.

## Completion rule

Issue #165 stays open until the real-device, real assistive-technology and remaining manual installed-surface checks above have evidence, and until any release-only checks applicable to an approved release are completed or explicitly dispositioned by the owner.
