# UI audit v2.1 implementation — issue #646

Branch: `fix/646-audit-v21-first-batch` (base `develop@18e925b3dfbc81ab82099f1351a2d25b19845a3d`)
Production main remains separate; Android owned separately. Input: owner-provided v2.1 audit and 19 unique screenshots, reconciled as **evidence**, not a code specification.

**Current checkpoint: Implementations 3/3 completed · Sub-implementations 13/13 completed (code and focused guards; validation separate)**

The current AGENTS.md distinguishes **implementation** from **validation/acceptance**: scoped code plus reviewed focused regression guard counts as implemented even when CI/rendered QA or merge is pending. These 13 source items are implementation-complete; rendered QA and review remain **NOT ACCEPTED**.

## Implementation I1 — financial display / semantics (5/5)
- [x] P-02 show baseline current portfolio, avoid redundant negative sign
- [x] P-03 center flat sparkline (without changing forecast values)
- [x] S-03 disambiguate shared savings balance from monthly flow
- [x] A-03 correctly scope 'upcoming' to current, historical and future reporting periods
- [x] A-04 locale-aware reporting percentages

## Implementation I2 — shared visual consistency (4/4)
- [x] A-02 selected card credit limit labeled as per-card, not portfolio
- [x] ST-03 provider summary spacing / header alignment; editing technical ID remains intact
- [x] T-03 destructive buttons avoid primary accent-gradient rule
- [x] A-01 report counterparties/income semantic text wrapper

## Implementation I3 — reconciled extended audit: financial privacy and overdue visibility (4/4)
- [x] D-01 mask direct Dashboard EUR amounts and hide money-bearing chart details while masked
- [x] E-02 connect Attention to existing global non-persisted privacy state (App and QA)
- [x] E-03 replace misleading green all-clear message/icon when urgent alerts exist
- [x] R-01 show recurring overdue date from the identical canonical Attention selector; leave cashflow forecast unchanged

## Pending backlog / deliberate exclusions from current 0/13 plan
- T-01/D-03 running per-event balances and lending signs: requires finance-impact integration and reconciliation tests across same-date, multi-leg, transfer, and legacy cases; don't copy receivable balances as account balances.
- Dashboard/Attention visibility and overdue **display** are scoped into I3; cross-route privacy beyond accepted surfaces and any **forecast inclusion** of old unpaid recurring cycles are separately gated by finance scenarios. Never invent or silently post historical cash movements.
- S-01/C-01/IL-01/LD-01/E-01 container/child alignments; ST-04/ST-05 category editor/icon mapping; CC-01/CC-02 card font/interaction: follow in coherent design batch.
- Remaining v2.1 findings need a source-and-visual evidence checkpoint before inclusion. Explicitly reject stale paths (e.g. ProviderVisualLibrarySettings.tsx), literal 1680px global width, unsupported assertions.
- Do not change Android, Supabase records, accounting history, release main, or production.

## Validation / acceptance
- [ ] Per-file source diff inspection and blast-radius sweep of shared primitives
- [ ] Focused source/finance regression tests and local preflight where executable
- [ ] Required rendered desktop screenshot evidence, inspected directly for layout, signs, labels and states (plus repo-required counterpart breakpoints/themes)
- [ ] Coherent review-head CI, CodeQL, Real Stack and Windows gates as applicable; check actual job results
- [ ] Reconcile approved implementation, issue, PR, branch/checkpoint and next owner decision; do not merge on pending/failing gates

## Last checkpoint — 2026-10-29
- Intake reviewed against current `develop`, `PROJECT_RULES.md`, `AGENTS.md`, #266 and UI standards; current unrelated draft release PR #645 targets main.
- Issue #646 created, new branch created from develop; no code edits committed yet.
- Current batch source-only preparation; cannot execute complete application locally because the container cannot resolve GitHub; GitHub connected app supports source reads/writes and CI visibility.
- Exact next action: implement nine specified changes on this branch in a coherent draft batch, add focused regression coverage, validate, and update this checkpoint before review-ready.

## Expanded audit checkpoint — 2026-10-29
- Owner requested an original + v2.1 + independent full-stack re-audit. A companion evidence register was added as `docs/audits/CONSOLIDATED_AUDIT_20261029.md` from the 20 historical screenshots (19 unique), current branch/develop source, live read-only Supabase metadata, and #616/#617 audit evidence.
- Live production finance revision **494**, latest in-app backup **485** (9 revisions behind), 52 backups / 30 history points. Fresh independently restore-tested PostgreSQL+Storage recovery remains unverified. No production write performed.
- Security advisors: 3 public authenticated SECURITY DEFINER app-lock RPCs require guarded review (source examined: owner + AAL2 + active session; no anonymous execution), 2 app-lock tables have RLS but no direct policies, leaked-password protection WARN, two private RLS performance WARN. Not all warnings equal exploitable bugs.
- Source-only I3 changes prepared in a coherent commit; no accepted counters updated without focused/runtime rendered evidence.
- Pre-expansion head `4cffa93f5876ae96a5ce7512cffdab23d0928f1c`: CI #40896566800 SUCCESS, CodeQL #40896566400 SUCCESS. Since PR is draft, rendered and Windows gates SKIPPED; do not count as final QA.
- Next action: narrow source/domain assertions on newest branch head, inspect all affected source/rendered evidence including original exact viewports; fix failures coherently; full required CI/CodeQL/browser/Windows only on final review-ready head. No production merge/deploy, Android or Supabase mutation.

## Current validation failure and fix — 2026-10-29
- Exact head 7d4276b61fa0001ad1b4449e491224465eb03aad: CI #40899265244 FAILED (1,565/1,567 Vitest PASS, 2 fails) while CodeQL #40899264832 SUCCESS. Failed existing contracts were lazy Chart rendering on mobile and decorative Recharts aria-hidden. Root source fix restores the original chart deferral and hidden a11y contract while gating visible sensitive values; added mask-check assertions.
- This is source-only work, not yet a new CI PASS or rendered QA.

## Hygiene correction — 2026-10-29
- On head 55f7de172b118a70300bfd5568148087761780e2, CI #40900953984 FAILED at TypeScript hygiene: TS1005 missing nested ternary ':' in Dashboard category chart privacy guard; CodeQL #40900953979 SUCCESS. Corrected code uses parenthesized `privacyVisible?(heavyChartsReady?...:null):null` preserving existing heavy-chart deferral, accessibility and new masking test. New head requires fresh actual checks; counters unchanged.

## 2026-10-29 — Full Ready review evidence and coherent correction
- Previous Ready review head `d77adcbc8bf266de0b88d75c322c17c807fc64e4` CI [#40902368375](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40902368375) **FAILED** at rendered frontend QA only: `scripts/ui-ux-visual-evidence-qa.mjs` waited for painted Dashboard Recharts even though initial shared privacy visibility is deliberately false. The browser/QA state contracts must verify masked default, click the real reveal toggle, then require full desktop painted charts and mobile collapsed donut. The prior source CI #40901777504 and separate CodeQL #40901777364 **SUCCEEDED**; ready-head Windows installer, Windows clean launch, first run, WebKit, Lighthouse and CodeQL also **SUCCEEDED**; Unified gate failed closed because rendered QA failed.
- Downloaded and directly inspected the Ready WebKit reports desktop/mobile images and 10 representative generated screenshots from the 597-file Chromium artifact. Confirmed A-02 residual: inner `report-operations-grid` has one credit item but inherits 4-column grid; card is ~1/4 intended width, wrapping its numbers vertically. Root correction is scoped to `.report-upcoming-card .report-operations-grid.report-credit-portfolio` (one full-width column), preserving multi-KPI global operations layout, with horizontal icon+copy composition. A **live rendered geometry assertion at desktop/mobile** and cheap source guard added.
- Source correction: `scripts/ui-ux-visual-evidence-qa.mjs` now asserts the privacy-hidden initial dashboard numeric state and absence of financial Recharts; clicks real `.dashboard-approved-heading .privacy-toggle`, verifies reveal, then uses the established chart readiness acceptance. Reports route uses a bounded geometry assertion in both QA viewports.
- Regression lock: `tests/ui-audit-v21-rendered-source.test.ts` plus expanded A-02 source assertions in `tests/ui-audit-v21-presentation-source.test.ts`. No finance arithmetic, account history, Android, database or main change.
- **Current implementation progress:** Implementations 3/3 completed · Sub-implementations 13/13 completed (scoped code + reviewed source guard). **Validation remains pending on corrected head**; a green previous run cannot be borrowed. No merge/deploy. Keep the PR draft during correction, then use one coherent Ready validation cycle and inspect the regenerated reports and 24 canonical visual evidence screens.
- **Exact next action:** confirm new source diff/CI on branch; mark #647 Ready after narrow preflight; validate exact branch head across CI/CodeQL/rendered/Windows/WebKit/Lighthouse; directly inspect screenshots for credit card width/desktop and mobile dashboard after revealed privacy. Merge to develop only after required successful gates and no unresolved visual findings. Main release separately gated.

## Second Ready matrix regression and targeted correction — 2026-10-29
- Exact review head `d0bd723ae3970b705bf048917f75d326fa90968f`, Ready CI [#40914264518](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40914264518): **FAILED** only `scripts/ui-ux-visual-evidence-qa.mjs` at privacy masking inspection; CodeQL, Windows installer, clean installed launch, app-owned first run, WebKit and Lighthouse **SUCCESS**; the unified gate correctly failed closed.
- Root cause from source: broad selector `.summary-net b` included two separate donut percentage `<b>` elements along with the saving KPI, so `summary.length===3` was impossible. This is a **test harness selector mistake**, not evidence that live numeric private values escaped; hidden-state assertion remains required.
- Scoped fix targets the exact three direct monetary KPI `<b>` nodes and independently checks both masked donut percentages. Failure now reports **counts and booleans only**, never actual finance values. Existing source regression lock updated.
- PR #647 returned to DRAFT for coherent correction. Next: focused/draft source CI preflight, then one Ready-head full gate and screenshot inspection. Implementation counts unchanged at 3/3 and 13/13; validation is distinct.
