# MyFinHub status

## Current production

MyFinHub v1.3.0 is the completed web/production and Windows release baseline.

- Canonical redesigned application is on release-only `main`.
- Vercel production deployment is READY on the validated production tree.
- Production device-session registry and provider-brand refresh migrations are applied.
- Owner + AAL2 + active-device RLS/session enforcement is active.
- Production recurring/workbook reconciliation is complete.
- Final integration gates passed: CI, CodeQL, Cross-engine, Performance, Windows Desktop, Windows First Run and Windows Clean Launch.
- Final persistent visual evidence contains 63 PNGs plus its manifest under `visual-qa/final/**`.

## Windows v1.3.0 release

**Tasks 3/3 · Subtasks 9/9**

- Release tag: `myfinhub-v1.3.0`.
- Exact tagged release commit: `2673ce626c0e3db6c30fea04a46b6cf1ce9517df`.
- Windows Desktop run #2029 completed successfully.
- Published release: `MyFinHub Desktop myfinhub-v1.3.0`.
- Installer: `MyFinHub-Setup-1.3.0-x64.exe`.
- Installer size: `148992632` bytes.
- GitHub asset digest: `sha256:a405189e016ddd03e31ab1ba92979b3991a64516edfa2a657eb7b9928fadc556`.
- Matching `.sha256` asset is published in the same controlled GitHub Release.
- Release is neither draft nor prerelease.

Release-closeout tracker: **#288 — complete**.

## Durable security and finance invariants

- Single-owner authentication remains email/password + mandatory TOTP/AAL2.
- Finance access remains API-authorized and RLS-backed.
- PAN/expiry/CVV are excluded from FinanceData and normal backups and live only in the encrypted owner+AAL2 server card vault.
- `CARD_VAULT_KEY`, service-role credentials and other privileged secrets are never distributed in browser, Windows or Android clients.
- Optimistic revisions, backups, audit/history boundaries and the canonical finance/accounting engine remain authoritative.

## Active completion batch — #476

**Implementations 5/8 completed · Sub-implementations 13/21 completed**

- Branch: `feat/476-completion-audit-hardening`.
- **54 deep-audit findings are now tracked.** DA-01..DA-53 retain their existing implementation/disposition state; DA-54 adds the owner-reported dark-theme color/contrast defect.
- DA-54 analysis shows the core dark text/status palette is readable, but interactive boundaries and several light-biased component surfaces were not semantically themed. The source fix adds a dedicated >=3:1 interactive control-border role, semantic dark surfaces for mobile More/Settings chrome, and computed-style rendered contrast assertions.
- DA-54 is **completed**. Dashboard, Transactions, Quick Entry, Reports, Settings and mobile More now use readable semantic dark surfaces/boundaries. Computed contrast/luminance checks pass, and manual artifact review confirms the settled post-animation More sheet plus the representative desktop/mobile dark states with no residual light-island defect.
- FV-24 records the prior exact-head Settings QA failure: the harness expected a removed duplicate provider preview. The source fix now validates the selected branded radio card itself; provider-management product code remains untouched.
- FV-25 records the next Settings QA failure: edit mode intentionally supports correcting an existing account's provider, but the harness still required that field to be absent. The assertion is aligned with the accepted provider-correction behavior; product code remains untouched.
- FV-26 records the bundle-budget failure introduced by loading the DA-54 remediation eagerly. The same dark rules now load through the existing lazy workspace style layer; the 240 KiB CSS budget is unchanged.
- FV-27 records a real Dashboard regression exposed by final evidence: all three deferred Recharts panels were blank. The lazy-loading boundary is preserved, the extracted charts restore explicit `ResponsiveContainer` sizing, and both performance/source contracts now assert that architecture. The latest desktop full-page artifact visibly confirms all three charts render; final exact-head proof remains pending.
- FV-28 records the follow-up QA mismatch: final evidence incorrectly required desktop Recharts in the intentionally collapsed mobile Dashboard. The harness now proves desktop charts and mobile progressive-disclosure steady state separately; this does not add product scope or change the 12/20 counter.
- FV-29 records the next hierarchy-QA mismatch at 375px: the compact layout hides the category donut below 381px and keeps the category table, while the previous assertion was still coupled to an exact Recharts count. QA now verifies the semantic expanded state—summary visualization, cash-flow chart, open KPI/analytics regions, hidden donut and visible category table—with per-state timeout diagnostics. Product CSS and thresholds are unchanged.
- FV-30 records a dark-theme evidence timing defect: the mobile More screenshot was captured during its 160ms entrance animation, making the settled dark surface look falsely translucent. Theme QA now waits 220ms before measuring/capturing More; no product opacity or color token changed.
- FV-31 records a real mobile Dashboard analytics regression: after disclosure expansion the cash-flow Recharts surface stayed absent even though the surrounding analytics/KPI layout was open. The first two-RAF fix was still nondeterministic under headless/background throttling, so the post-layout mount now uses two animation frames with a 250ms timeout fallback. First-paint lazy loading and budgets remain unchanged; source contracts enforce the fallback.
- FV-32 closes the two remaining rendered functional-coverage gaps without adding product scope: Lending repayment now proves a partial repay reduces the receivable exactly once, and Settings creates then protected-deletes an unreferenced custom cash account. Device revoke is not exercised destructively because QA mocks only device-list GET; revoke POST remains covered by API/security contracts.
- The separate database workstream is complete by owner confirmation, including the relational ledger cutover. This branch will not touch the live database.
- Manual installation/upload of final authentic provider logo binaries remains an external owner-side prerequisite. Provider/logo management UX continues separately in #481/#482 and is intentionally not duplicated here.
- Remaining work: prove FV-31/FV-32 in rendered QA, complete the final exact-head screenshot review, reconcile with current `develop`, then finish the exact-final-head CI/security/cross-engine/performance/Windows validation wave and squash-merge to `develop`.
- No Android implementation and no `main` promotion/release are included.

## Next work

Subsequent changes are product fixes against the completed v1.3.0 baseline. Routine implementation remains **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only.
