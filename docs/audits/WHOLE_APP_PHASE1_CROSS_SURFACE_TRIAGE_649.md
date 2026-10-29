# #649 phase 1/2 — bulk suite-to-source coverage and source-confirmed findings

**Audit-only supplement, 2026-10-29.** This is not a product patch or an assertion that all 23 areas have passed a hands-on runtime audit. The 23 rows below cross-map the **whole** proposed correction plan to the existing exact-head QA artifacts and current code. **Area closure 0/23** pending full per-area triage and disposition. **Implementation:** Implementations 0/23 completed · Sub-implementations 1/132 completed (#652 pre-staged only).

## Provenance and mass QA methodology

- The exact PR #647 full Ready run [#40921547456](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40921547456) finished **SUCCESS** across all required gates; generated artifact #12920225365 contains **736 PNG and 50 JSON**, split into **712 QA-suite captures and 24 canonical full-page captures** in 45 categories.
- The suite JSON records `source.sha=f61a2f6569e041ff3ad6ee1416ac7c9be27d23af` (the CI synthetic merge ref associated with PR #647), not the PR head `1814d72bfa3d6aa151a7a50a43feee80d6a8ba16`. The distinction matters for reproducibility. Full-page captures occurred in the same artifact but after the earlier suite screenshots.
- Personally inspected native `transactions-baseline-desktop` 1280×900 and `transactions/full-page/desktop-1440x1000` 1425×1661, plus full-page Reports and previous native Dashboard/Reports/WebKit samples. Additional generated suites/catalogs are indexed, **not** automatically claimed as full-resolution human reviewed.
- Each package maps multiple QA categories because shared components and domain semantics span pages; category count is coverage **availability**, not per-state passing proof. Current `develop@f10b963f650a5b9c185512986d62d572c7ef4420` contains merged #646. Staged #648/#652 are excluded from existing exact-head rendered evidence.
- Status terms: **A** code+visual/source-confirmed, **B** reproduction needed, **D** already accepted/regression-protected, **S** nontrivial safety/recovery evidence gap rather than assumed vulnerability. No product UX choices are accepted from screenshots alone.

## 23-area cross-surface evidence map

| Work | Area | Existing generated QA surfaces (PNG count per category) | Unproven or next exact audit check | Status |
|---|---|---|---|---|
| **I01** | AppShell, πλοήγηση | app-shell (128); command-palette (20); branding (11); not-found (2) | Tooltip/focus route switch, mobile More, global period; exact keyboard/200% zoom needed | B: previous G-01 topbar tooltip; no new app regression verified |
| **I02** | Κοινό design system | theme (71); cross-page-motion (48); controls (6); accessibility (4) | Shared button/danger/focus, reduced motion, 320px/2560px sibling control scans | D: #646 destructive variant fixed; B: CSS root ownership |
| **I03** | Login/MFA/Session | auth-session (3); runtime (6); recovery (6); accessibility (4); desktop-host (15) | Wrong-password, enrollment/challenge/expired AAL2, bearer/cookie refusal paths and live app-lock | S: negative auth/owner/AAL2 runtime proof; #645 release separate |
| **I04** | Dashboard | dashboard (13); app-shell (128); accounts (5); theme (71) | Masked vs revealed full account/KPI/graph privacy and ± receivable cash | D: #646 privacy pass; staged #648 sign; B cross-route privacy scope |
| **I05** | Transactions | transactions (19); ledger (6); large-data (6); persistence (13) | Same-day EOD vs running, account movement cash direction, count vs painted row, mobile table | A: EOD provenance, #648 staged; A: premature full-page capture; B: event selector |
| **I06** | Savings | savings (8); planning (18); functional-flows (24) | Small-value tick precision, common pool vs flow, goal CRUD/negative cases | D: #646 flow-vs-balance passed; B: tick/geometry revisit |
| **I07** | Cards | cards (17); card-vault (3); core-flows (15); branding (11) | Literal card edit WYSIWYG, secure vault roundtrip, archive/pointer and 320px | D: physical owner approved contract; S: vault partial save and secrets |
| **I08** | Credit | credit (22); cards (17); payments (7); core-flows (15) | Statement/limit card vs total, interest effective-date, bank nickname at breakpoints | D: #646 limit labeling; B glyph/stack affordance; owner card WYSIWYG |
| **I09** | Loans | loans (7); obligations (9); payments (7); functional-flows (24) | Actual installment amount vs preset, partial/full paid, historical/future as-of | D: domain invariants; B: due-day/number label and width |
| **I10** | Lending | lending (14); payments (7); functional-flows (24) | Receivable vs cash, writeoff/settlement no-history erase, privacy and due state | A: staged signs #648; S: destructive semantics and error receipt |
| **I11** | Recurring | recurring (13); recurring-branding (7); obligations (9); payments (7) | Overdue vs future date, variable recurring, missed cycle forecast policy, early paid | D: #646 shared due; B/S: forecast double-count risk |
| **I12** | Planning | planning (18); large-data (6); persistence (13); recovery (6) | Full pending-list reachability, schedule skip/complete once, forecast estimates vs actual | D: #646 baseline/sparkline; B: nested scrolling at desktop |
| **I13** | Attention | action-center (9); attention (2); app-shell (128); budgets (47) | Alert urgency tone, advisory action, deep link, privacy session and long list | D: #646 urgent/visibility; B: source focus and crowding |
| **I14** | Reports | reports (9); budgets (47); categories (5); theme (71); large-data (6) | Current as-of vs history, positive-only accounts, credit subpanel data/geometry | D: #646 period/credit/grid; B: blank-looking panel fixture |
| **I15** | Settings general/profile | settings (46); accessibility (4); desktop-host (15); theme (71) | General/profile/readability tabs, PIN, session, tab keyboard and dark text | S: device sessions provenance; B: dense tabs |
| **I16** | Settings account/providers | settings (46); accounts (5); settings-provider-branding (13) | Create/edit/delete blocked dependencies, provider media upload partial success | D: #646 provider summary; S: ancillary Storage ack |
| **I17** | Settings taxonomy/rules | settings (46); taxonomy (6); icons (8); categories (5); budgets (47) | 20/6/71 actual owner taxonomy and icon fallback, disabled rule save conflict | B: source mapping gaps are not proven missing glyphs; no data rewrite |
| **I18** | Settings data/recovery | settings-desktop-backup (12); settings (46); persistence (13); recovery (6) | JSON-vs-full restore, backup freshness, damaged index, permission denied, destructive confirmation | A: backup copy ambiguous (#652 staged); S: independent DB+Storage restore unproven |
| **I19** | Quick Entry/receipts | quick-entry (10); receipts (18); payments (7); budgets (47) | Input/error/dirty close, one posting, OCR local limits, cross-store partial success | S: conflict and receipt; domain semantics audited with seeded fixtures only |
| **I20** | Dialogs/history/commands | controls (6); command-palette (20); persistence (13); large-data (6) | Focus trap, Escape, owner confirmation, undo/redo import irreversibility | D: existing suite coverage; B: sibling nested dialog/focus |
| **I21** | Windows desktop | desktop-host (15); desktop-titlebar (3); settings-desktop-backup (12) | PIN lock/idle, loopback, clean first-run, updater, Windows backup errors | D: Windows mandatory CI passed; S: independent restore proof absent |
| **I22** | Finance/API/Supabase | ledger (6); auth-session (3); persistence (13); accounts (5); runtime (6) | Negative owner+AAL2/RLS/RPC/partial write, revisions, finance event legs and import | S: live DB recovery and production negative-path tests not proven |
| **I23** | QA/a11y/performance | cross-page-motion (48); app-shell (128); accessibility (4); large-data (6); theme (71) | Screenshot after painted state, metadata source SHA, keyboard, LCP/CLS and 200% zoom | A: full-page capture 120 ms vs delayed animation; CI green not screenshot accepted |

## Source-confirmed audit finding: QA screenshot taken before table content paint

**QA-649-01 — confirmed instrumentation issue (A), not a proven missing finance transaction.**

1. `src/styles/content-entrance-motion.css` animates `[data-content-entrance="table"] > tr` with `rh-backdrop-in 170ms` and **`animation-delay:90ms`** from the third row onward (`45ms` second row), using a **backwards** fill mode. Thus an image captured before animation end can depict blank or faded cells.
2. `scripts/ui-ux-visual-evidence-qa.mjs` navigation uses **`await sleep(120)`** after waiting only for route heading, and then the full-page screenshot path. Its special Dashboard readiness is not a general list/table animation-readiness check.
3. The full-page Transactions screenshot (`__full-page__desktop-1440x1000.png`) shows a complete grid, one normal row, one faint row and many apparently blank rows although the footer indicates a 20-row batch; the same run's `qa-transactions-scanability` image `transactions-baseline-desktop.png` shows **many readable ledger rows**, same August dataset with the selected 26/08/2026 supermarket event and next 25/08 income.
4. **Interpretation:** the discrepancy is **consistent with** premature capture of a staggered entrance, not evidence that the ledger dropped records or incorrectly reports 20 rows. The actual app data-state/DOM count and no-animation-after-capture still warrant a focused QA reproduction; do not label a finance-loss incident.
5. **Proposed phase-2 owner:** I23.01/Transactions rendered QA. Before capturing a full-page snapshot, require genuinely settled render/animations for representative content, with bounded timeout and an assertion on at least the expected visible ledger rows/opacity at baseline; preserve reduced-motion behavior and do not merely add large arbitrary sleeps. Include a sibling sweep for other `[data-content-entrance]` lists/grids and prevent screenshots from passing while content is invisible. **Do not implement during phase 1.**

## Other verified boundaries; no speculative patch

- **Finance EOD:** `TransactionsPage.rowBalance` uses `selectAccountBalances(data,row.date)` for first account, therefore an end-of-day state, not an event-by-event intermediate balance. #648's pending label is correct. Full per-event computation must be anchored to deterministic legacy, reconciliation, snapshot and signed legs; not reverse-engineered from arbitrary record order.
- **Receivables:** domain `createEvent` posts negative account leg for lending and positive for repayment, with inverse receivable delta and neutral operational income/expense; #648's shared sign presentation is staged. It should be revalidated on its *new* head before final combined acceptance.
- **Backup vs recovery:** existing Windows local snapshot is FinanceData JSON, not a PostgreSQL+Supabase Storage restore. Explicit excluded secrets/assets and destructive import confirmation remain correct; #652 staged UI-copy fix removes a misleading "πλήρες backup" phrase. Full independent restore is still unverified and must not be claimed complete from JSON checksum.
- **Reports credit panel:** full-page Reports shows populated financial charts and category data; an apparently sparse credit breakdown elsewhere in the screenshot needs direct selected-card/fixture/DOM inspection. There is no proof of loss or an accounting error from blank space.
- **Security:** full green CodeQL, session tests and read-only RLS inventory do not constitute a successful live adversarial probe or prove the 3 SECURITY DEFINER RPCs exploitable. Review owner+AAL2 negative-path evidence while preserving audited boundaries.

## Phase 1 next evidence gate

- Expand current 23 mapped areas into a **single deduplicated defect ledger** with test case, expected behavior, actual outcome, severity, affected platforms/breakpoints, and disposition (fix, verified correct, blocked on owner decision, evidence missing).
- Prefer direct QA source/test inspection of unverified states and existing CI logs before rerunning a full suite. The already completed #651 full Ready CI is retained but not reused to prove the entire future #649 batch.
- Do not count any of these 23 **implementation** packages as completed until actual phase-2 code plus regression guard. All work remains documentation-only in the current task. No new micro PRs, CI gates, production mutations or Android changes.

