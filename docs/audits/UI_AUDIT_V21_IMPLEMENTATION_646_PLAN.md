# UI audit v2.1 implementation — issue #646

Branch: `fix/646-audit-v21-first-batch` (base `develop@18e925b3dfbc81ab82099f1351a2d25b19845a3d`)
Production main remains separate; Android owned separately. Input: owner-provided v2.1 audit and 19 unique screenshots, reconciled as **evidence**, not a code specification.

**Current checkpoint: Implementations 0/3 completed · Sub-implementations 0/13 completed**

Only fully **accepted** work counts; source edits are provisional until focused checks, rendered desktop evidence inspection, and repository-defined review gates.

## Implementation I1 — financial display / semantics (0/5)
- [ ] P-02 show baseline current portfolio, avoid redundant negative sign
- [ ] P-03 center flat sparkline (without changing forecast values)
- [ ] S-03 disambiguate shared savings balance from monthly flow
- [ ] A-03 correctly scope 'upcoming' to current, historical and future reporting periods
- [ ] A-04 locale-aware reporting percentages

## Implementation I2 — shared visual consistency (0/4)
- [ ] A-02 selected card credit limit labeled as per-card, not portfolio
- [ ] ST-03 provider summary spacing / header alignment; editing technical ID remains intact
- [ ] T-03 destructive buttons avoid primary accent-gradient rule
- [ ] A-01 report counterparties/income semantic text wrapper

## Implementation I3 — reconciled extended audit: financial privacy and overdue visibility (0/4)
- [ ] D-01 mask direct Dashboard EUR amounts and hide money-bearing chart details while masked
- [ ] E-02 connect Attention to existing global non-persisted privacy state (App and QA)
- [ ] E-03 replace misleading green all-clear message/icon when urgent alerts exist
- [ ] R-01 show recurring overdue date from the identical canonical Attention selector; leave cashflow forecast unchanged

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
