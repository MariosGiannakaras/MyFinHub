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

The recovered Approved target was visually inspected region-by-region against the fresh exact-head rendered Dashboard evidence generated for commit `905c8a72f6be18eeb09d5aa9993c991794ca766e` and then persisted by the visual-evidence refresh commit `fc3e1580f4f575d4eb036df450a6bcee829b08a7`.

Validated evidence:

- `visual-qa/dashboard/v1.3__2026-08-27_185016__qa-shell-dashboard-hierarchy__shell-dashboard-hierarchy-desktop.png`
- `visual-qa/dashboard/v1.3__2026-08-27_185552__full-page__desktop-1440x1000.png`

The shell, sidebar, topbar, heading, three primary-account cards, secondary-account strip, three-panel middle row, two analytics panels and six-card KPI strip align to the approved desktop hierarchy and macro geometry. The refreshed evidence replaced the previous Dashboard screenshots rather than retaining stale duplicates.

Normalized structural comparison against the fresh 1440 × 1000 Actual produced:

- Gaussian structural blur 10 px: SSIM `0.9642`
- Gaussian structural blur 20 px: SSIM `0.9919`

The remaining raw-pixel differences are presentation-state differences, not unimplemented Dashboard structure: deterministic QA finance data/chart series differ from the static mock, while the live application intentionally preserves canonical semantics where the mock is internally inconsistent. In particular, privacy state/labels, account actions, metric sources, reporting periods and percentage semantics remain driven by application state and domain logic and are not replaced by screenshot-only hard-coded values.

## Final implementation gate

The runtime tree at `905c8a72` passed CI, CodeQL, cross-engine smoke and Windows Desktop validation. The first Lighthouse measurement on the documentation-only successor showed runner variance despite byte-identical production bundle hashes; a targeted rerun passed unchanged thresholds. The automatic visual-evidence refresh contains no runtime changes. The next owner-authored head exists only to retain this durable final validation record and to obtain normal exact-head checks over the final tree before merge to `develop`.
