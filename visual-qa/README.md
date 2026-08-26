# MyFinHub Visual QA archive

This folder is the persistent, deploy-free visual record for **all** rendered visual QA in MyFinHub. It is intentionally bounded: the working tree keeps only the latest useful evidence for each page, object or focused QA surface. Older captures remain available through Git history instead of accumulating as folders and duplicate PNGs.

## Surface-first layout

The first directory level is the page or visual object. App version belongs in the filename, not in a directory name.

```text
visual-qa/
  current-version.txt
  manifest.json
  dashboard/
    v1.3__2026-08-24_083000__full-page__desktop-1440x1000.png
    v1.3__2026-08-24_083000__full-page__mobile-375x812.png
    v1.3__2026-08-24_083000__qa-shell-dashboard-hierarchy__desktop.png
  cards/
    v1.3__...__full-page__desktop-1440x1000.png
    v1.3__...__full-page__mobile-375x812.png
  credit/
  transactions/
  reports/
  controls/
  command-palette/
  ...
```

There are **no version directories, `runs/` directories or `baseline/` directories**. When v1.4 replaces v1.3, the latest v1.4 files replace the corresponding older capture source in the same surface folder. The Git commit history remains the historical archive.

## Latest-only replacement rules

- Full-page capture replaces only the previous `__full-page__` screenshots for that page.
- A focused suite replaces only files carrying its own `__qa-<suite>__` marker.
- Other current evidence in the same surface folder is preserved.
- `manifest.json` describes the latest full-page sweep; each focused suite writes a small `qa-<suite>.json` metadata file beside its screenshots.
- Filenames always contain the current implementation version and capture timestamp.

This keeps repository checkout size bounded while still leaving the exact merged visual state directly browsable in GitHub.

## Coverage and review gate

`npm run qa:frontend` is the canonical rendered QA coordinator. Any suite that produces PNG evidence is normalized into this archive by page/object. `npm run qa:visual` runs only the full-page sweep.

Visual assertions are not enough by themselves. After every visual QA run used for implementation acceptance, the generated PNGs must also be opened and visually inspected for layout inconsistencies, clipping, overlap, stale QA instrumentation, responsive problems and deviations from the agreed visual references. A visual implementation is not considered complete merely because DOM/browser assertions are green.

The images contain deterministic QA fixture data only. Real personal finance data, PAN, expiry, CVV or other secrets must never be captured here.

## Desktop redesign integration

The Phase 1 desktop redesign uses this archive as the **single current-state screenshot source**. Do not create a duplicate current-baseline screenshot tree under `docs/ui-redesign/`.

- Resolve the latest full-page desktop file for a page through `manifest.json`; filenames are intentionally version/timestamp-qualified.
- Owner-approved redesign targets are separate assets under `docs/ui-redesign/references/approved/<surface>/desktop.png`.
- The design-direction references live under `docs/ui-redesign/references/direction/`.
- During Phase 1, desktop captures are the visual-approval baseline. Existing mobile/focused evidence remains useful as regression evidence but does not create a mobile redesign obligation.

The `Visual QA Snapshots` workflow refreshes this bounded archive on non-`main`/non-`develop` branch pushes and persists only the latest useful evidence.
