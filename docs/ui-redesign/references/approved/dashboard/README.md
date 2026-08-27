# Dashboard approved desktop target

Owner-approved Phase-1 desktop Dashboard target recovered during the active implementation session on 2026-08-27.

- Surface: Dashboard + application shell
- Source attachment dimensions: `1536 × 1066`
- SHA-256: `a31d4c8b7de911839303a1f6454791e11bcf29dacaff365ccfe38c7ca201f49a`
- QA comparison viewport: `1440 × 1000` (same target aspect ratio after normalization)
- Active implementation branch: `ui/300-dashboard-approved-target`
- Active PR: `#302`

The connected repository writer available to this implementation session accepts UTF-8 text but does not provide a safe binary-file upload path for the owner attachment. Therefore this file records the exact target identity and provenance without committing a degraded reconstruction.

## Approved ↔ Actual validation

The recovered Approved target was visually inspected against the latest rendered Dashboard evidence from the active PR. The shell, sidebar, topbar, heading, three primary-account cards, secondary-account strip, three-panel middle row, two analytics panels and six-card KPI strip align to the approved desktop hierarchy and macro geometry.

Normalized structural comparison against the 1440 × 1000 Actual produced:

- Gaussian structural blur 10 px: SSIM `0.9616`
- Gaussian structural blur 20 px: SSIM `0.9910`

Remaining raw-pixel differences are dominated by deterministic QA data/chart series and by cases where the static mock conflicts with canonical application semantics. Production behavior must remain authoritative for privacy state, account actions, metric sources, reporting periods and percentage semantics; those must not be replaced by screenshot-only hard-coded values.
