# MyFinHub Visual QA archive

This root-level folder is the persistent, deploy-free visual record produced by the rendered browser QA suites.

## Version separation

Every app version has its own directory. The active implementation version is declared in `current-version.txt`.

Example:

```text
visual-qa/
  current-version.txt
  v1.3/
    baseline/   # OLD / last owner-approved reference for v1.3
    latest/     # NEW / most recent rendered capture for v1.3
    runs/       # immutable dated snapshots for v1.3
```

A future v1.4 uses `visual-qa/v1.4/...`; v1.3 evidence is never mixed with it.

## Naming contract

Generated screenshots use this form:

```text
v1.3__2026-08-24_010305__credit__desktop-1440x1000__NEW.png
```

The name identifies, without opening the file:

- app version
- capture date/time (`Europe/Athens` by default)
- app surface/route
- viewport and dimensions
- whether the file is the new/current capture (`NEW`) or an approved reference (`BASELINE`)

Each archived run is also grouped under:

```text
runs/2026-08-24_010305__4f21b4d8/
```

The run includes `manifest.json` with the full source SHA, branch, generated timestamp, timezone, viewport metadata, and screenshot list.

## Meaning of the folders

- `baseline/`: the OLD/approved comparison point for the version. It changes only when a visual state is explicitly accepted.
- `latest/`: the NEW/current rendered state. The visual QA capture rewrites it on each snapshot.
- `runs/`: dated historical captures. These let us inspect older implementation states without deploying them.

The generated images contain only deterministic QA fixture data. Real personal finance data and card secrets must never be captured here.

## Commands

- `npm run qa:visual` captures the current version into `latest/` and a dated `runs/` directory.
- `npm run qa:visual:approve` copies the current `latest/` set into `baseline/` and marks those filenames as `BASELINE`.

During feature development, the dedicated Visual QA Snapshot workflow persists the generated images back to the feature branch. This makes them directly browsable in GitHub while the implementation is still under review and before any deployment.
