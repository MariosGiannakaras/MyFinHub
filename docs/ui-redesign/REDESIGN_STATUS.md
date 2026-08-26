# MyFinHub desktop redesign status

Phase: **1 — Desktop web UI/UX redesign**  
Bootstrap tracker: **#296**

Design states: `NOT STARTED` · `DESIGNING` · `DESIGN APPROVED`  
Implementation states: `NOT STARTED` · `IMPLEMENTING` · `IMPLEMENTED` · `VERIFIED`

Current full-page baselines are resolved dynamically from `visual-qa/manifest.json`; filenames contain version/timestamp and must not be hard-coded here.

## Automatic progression contract

The owner does not choose or retrieve the next redesign surface manually.

Chat A owns the ordered design queue defined in `WORKFLOW.md`. After the owner explicitly approves a target, Chat A must automatically advance to the next eligible surface, retrieve its latest current desktop evidence, inspect the relevant repository implementation and generate the next redesign without waiting for `next`, `continue`, or another page name.

Primary page order below is stable unless repository evidence requires a dependency-aware supporting surface to be inserted according to `WORKFLOW.md` (for example Quick Entry after Transactions). Supporting/global surfaces are reviewed automatically when they require an independent desktop target.

Chat B updates durable design/implementation states as approved targets move through implementation. Chat A may continue designing later surfaces while Chat B implements earlier approved targets.

## Primary page surfaces

| Order | Surface | Repository source | Current desktop baseline | Design | Implementation |
| ---: | --- | --- | --- | --- | --- |
| 1 | Dashboard + application shell | `src/pages/DashboardPage.tsx`, `src/App.tsx` | `visual-qa/manifest.json` → `dashboard` | DESIGN APPROVED | IMPLEMENTING |
| 2 | Transactions | `src/pages/TransactionsPage.tsx` | manifest → `transactions` | NOT STARTED | NOT STARTED |
| 3 | Savings | `src/pages/SavingsPage.tsx` | manifest → `savings` | NOT STARTED | NOT STARTED |
| 4 | Cards | `src/pages/CardsPage.tsx` | manifest → `cards` | NOT STARTED | NOT STARTED |
| 5 | Credit Card | `src/pages/CreditCardPage.tsx` | manifest → `credit` | NOT STARTED | NOT STARTED |
| 6 | Loans | `src/pages/LoansPage.tsx` | manifest → `loans` | NOT STARTED | NOT STARTED |
| 7 | Lending / receivables | `src/pages/LendingPage.tsx` | manifest → `lending` | NOT STARTED | NOT STARTED |
| 8 | Recurring | `src/pages/RecurringPage.tsx` | manifest → `recurring` | NOT STARTED | NOT STARTED |
| 9 | Planning / forecast | `src/pages/PlanningPage.tsx` | manifest → `planning` | NOT STARTED | NOT STARTED |
| 10 | Needs Attention | `src/pages/AttentionPage.tsx` | manifest → `attention` after bootstrap QA refresh | NOT STARTED | NOT STARTED |
| 11 | Review | `src/pages/ReviewPage.tsx` | manifest → `review` | NOT STARTED | NOT STARTED |
| 12 | Reports | `src/pages/ReportsPage.tsx` | manifest → `reports` | NOT STARTED | NOT STARTED |
| 13 | Settings | `src/pages/SettingsPage.tsx` | manifest → `settings` | NOT STARTED | NOT STARTED |

## Supporting/global surfaces

These may need independent desktop approval targets when inspection shows their layout is not sufficiently defined by the parent page target. Chat A determines this from repository evidence and schedules them according to `WORKFLOW.md`; the owner does not need to inventory them manually.

| Surface | Current evidence/source | Design | Implementation |
| --- | --- | --- | --- |
| Quick Entry / transaction-entry overlays | existing focused `visual-qa/` evidence + repository code | NOT STARTED | NOT STARTED |
| Account management | existing focused `visual-qa/` evidence + repository code | NOT STARTED | NOT STARTED |
| Budgets / category-management UI | existing focused `visual-qa/` evidence + repository code | NOT STARTED | NOT STARTED |
| Action center / attention interactions | existing focused `visual-qa/` evidence + Attention page | NOT STARTED | NOT STARTED |
| Command palette | existing focused `visual-qa/` evidence + repository code | NOT STARTED | NOT STARTED |
| Owned controls / dialogs / popovers | existing focused `visual-qa/` evidence + repository code | NOT STARTED | NOT STARTED |
| Authentication/MFA and other secondary states | repository + rendered QA evidence | NOT STARTED | NOT STARTED |

Add, merge or split supporting rows only when repository evidence justifies a distinct design-approval surface. Do not invent screens for tracking convenience.

## Phase-1 exclusion

Tablet/mobile web redesign and Android redesign are not tracked here. Existing non-desktop behavior remains regression-protected during desktop implementation.

## Protected META issue

Issue #266 is not a tracker for this work and must never be mutated by either redesign chat.
