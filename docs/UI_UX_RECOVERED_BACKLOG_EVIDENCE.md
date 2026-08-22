# MyFinHub recovered pre-branding backlog evidence

Tracking: issue #162 · PR #159 · branch `feat/ui-ux-hardening-batch`

This record exists because the later Reports/branding work was additive scope and must not replace UI/UX hardening work that was still intended to be verified before PR #159 merge. Issue #162 recovered that scope explicitly and keeps merge/release owner-gated.

## Recovered implementation

The recovery audit found and corrected concrete gaps rather than simply reopening old checklist text:

- **Recurring stale-account integrity** — create/edit rejects non-existent payment account ids; payment rejects non-existent ids; stored stale defaults/item accounts fall back only to an actually available non-credit account; no-account state is blocked with actionable user-facing feedback.
- **Savings account-role integrity** — submission now verifies that the source id still exists in the available non-savings source set and that the destination still exists in the available savings-account set, instead of checking only non-empty/different ids.
- **PageErrorBoundary recovery** — the error surface receives focus; Dashboard recovery schedules parent route/crash recovery before reopening the boundary child tree, including the same-route Dashboard→Dashboard failure case.
- **Mobile Compact touch target** — the balance privacy toggle has an explicit 44px minimum height so Compact typography cannot push it below the mobile target floor.

Previously requested behavior was also re-verified instead of assumed: loan creation remains modal, Quick Add/Ctrl/Cmd+K remains functional, the dead topbar avatar-style control remains removed, reporting uses the app-owned period control, and refresh uses `finance.reload()` rather than a page reload.

## Recovered regression coverage

New/expanded automated contracts include:

- `tests/recurring.test.ts` for valid fallback, stale id rejection and no-account behavior;
- `tests/shared-ui-source.test.ts` for recovered account validation, in-place refresh and PageError recovery ordering;
- `scripts/owned-controls-qa.mjs` exercising Lending known-person suggestions as a rendered app-owned listbox/options surface with ARIA linkage and no native datalist;
- `scripts/refresh-route-qa.mjs` proving manual refresh keeps the Reports route while displaying an in-place `PageSkeleton` and disabled refresh state;
- `scripts/recovered-surface-qa.mjs` proving PageErrorBoundary focus + same-page Dashboard recovery, Readability persistence, Savings account-role defaults and Login/MFA interaction semantics;
- the recovered scripts are part of `scripts/run-rendered-qa.mjs`, so CI cannot omit them.

The deeper audit also rechecked Readability Compact/Normal/Large persistence and Login/MFA validation/focus/loading behavior after branding integration. No additional regression was found on those two surfaces.

## Verified recovered implementation checkpoint

Recovered implementation head: `d7784724619cd7b5ca8e904afc4f48d8a3bc4953`.
PR merge ref verified by CI: `5de9765c9a609fc1b8d2f895f7fd9e5fbf3b694e`.

- CI `32461119019`: **success**.
  - privacy/security guard passed across 255 tracked files;
  - **34 test files / 154 tests passed**;
  - production TypeScript/Vite build passed;
  - API TypeScript check passed;
  - base rendered frontend QA passed;
  - owned-controls QA passed, including the Lending app-owned suggestion surface;
  - full desktop/mobile route-state, Compact/Large typography and accessibility matrix passed;
  - completion QA passed;
  - runtime console/network QA passed across desktop/mobile/auth/loading/conflict/error surfaces;
  - credit over-limit QA passed;
  - in-place refresh route QA passed;
  - recovered-surface QA passed for PageErrorBoundary, Readability, Savings and Login/MFA;
  - Reports visual QA, branding visual QA and full-page visual evidence QA all passed.
- Screenshot artifact `9439034848`: **59 PNG files**.
- Artifact ZIP SHA-256: `1b3374da3cfa4d93e1ede4456051f00d6c85d58dd23f77659200de184c5533cf`; this exactly matches the GitHub Actions artifact digest.
- Manual visual review covered all 59 screenshots via contact-sheet review plus full-resolution inspection of the recovered error/refresh/readability states and high-risk mobile Settings/Reports/Transactions surfaces. No new clipping, horizontal overflow, overlap or visual artifact was found. Full-page mobile captures can show the fixed bottom navigation at the viewport capture position; normal viewport screenshots remain correct and this is not a runtime layout regression.
- CodeQL `32461118772`: **success**.
- Windows Desktop `32461118820`: **success** — application/desktop boundary, PowerShell fallback, unpacked Windows build, packaged executable + hidden backend smoke, interactive NSIS Setup, update-channel checksum and installer evidence all passed. Release publication was skipped because this is not a release tag.

## Documentation closure rule

The commit that introduces this evidence record is documentation-only but becomes the final branch head. Therefore the technical closure of #162 requires a fresh same-head CI, CodeQL and Windows Desktop cycle after this document is committed. Those final documentation-head run IDs are recorded in PR #159 and issue #162 when the runs complete; no additional repository mutation is required merely to duplicate those run ids here.

## Owner-gated state

- PR #159 remains open and unmerged.
- Merge is not authorized by completion of #162.
- Release/version bump, production deployment and production installer publication remain outside #162 and require separate explicit owner approval.
