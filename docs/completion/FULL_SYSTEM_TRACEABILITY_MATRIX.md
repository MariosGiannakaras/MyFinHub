# MyFinHub full-system traceability matrix

Source-audit baseline: PR #477 completion branch. This document is an assistant-built inventory from application source, server/API source, persistence schema, QA harnesses and production-backend contracts. It is not a substitute for the remaining manual rendered/runtime checks; it defines what must be proven.

## 1. Route, navigation and user-surface inventory

### Primary authenticated routes

| Route id | User surface | Primary source | Persistent/global controls |
| --- | --- | --- | --- |
| dashboard | Dashboard / account overview | `src/pages/DashboardPage.tsx` | period, privacy, account quick action, transactions/planning/attention/reports navigation |
| transactions | Transactions | `src/pages/TransactionsPage.tsx` | search/filter/sort/pagination, modern edit/delete, legacy edit/delete |
| savings | Savings | `src/pages/SavingsPage.tsx` | savings transfer, target rate, goals |
| cards | Cards | `src/pages/CardsPage.tsx` | bank/card create/edit, archive/delete, card details |
| credit | Credit card | `src/pages/CreditCardPage.tsx` | purchases, payments, statements, card actions |
| loans | Installments & loans | `src/pages/LoansPage.tsx` | create/edit/pay, self-loan |
| lending | Lending / receivables | `src/pages/LendingPage.tsx` | lend/repay, privacy |
| recurring | Recurring / subscriptions | `src/pages/RecurringPage.tsx` | create/edit, cadence, pause/reactivate/stop, pay |
| planning | Scheduled / forecast | `src/pages/PlanningPage.tsx` | schedule create/edit/complete, forecast |
| attention | Review / action center | `src/pages/AttentionPage.tsx` | action dispatch, snooze/dismiss/review decisions |
| reports | Reports / analytics | `src/pages/ReportsPage.tsx` | period, privacy, budgets, rules |
| settings | Settings | `src/pages/SettingsPage.tsx` | seven nested Settings tabs |
| unknown hash | Product 404 | `src/pages/NotFoundPage.tsx`, `src/lib/routing.ts` | Dashboard recovery, browser-back recovery |
| unknown HTTP path | Static 404 | `404.html`, local/static server routing | safe recovery link; no executable inline script |

Navigation authority is `src/components/AppShell.tsx`: grouped desktop sidebar, four primary mobile destinations, global mobile Quick Entry, mobile More dialog, Dashboard brand-home, search/command, undo, redo, history, refresh and logout.

### Settings tabs

| Tab | Surface(s) |
| --- | --- |
| general | readability/text size, Desktop update panel, keyboard shortcuts, optional support diagnostics |
| profile | account email/password security, connected device access, Desktop local PIN/app lock |
| accounts | financial provider management + account metadata/account configuration |
| categories | taxonomy/category/subcategory management |
| icons | category/subcategory icon assignment and pack selection |
| rules | transaction rule create/edit/delete |
| data | backup/download, JSON import confirmation |

### Authentication and host-only surfaces

- Login: `LoginScreen` — email, password, password visibility, caps-lock state, validation and busy/error feedback.
- MFA challenge: `MfaScreen` — six-digit OTP, failure/busy state, logout.
- MFA enrollment: `MfaScreen` — enroll action, QR, fallback secret, OTP verification.
- Desktop lock: `DesktopAppLockGate` — four-digit local PIN, idle timeout, failed-attempt behavior.
- Desktop setup/startup/update: `desktop/main.cjs`, `DesktopUpdatePanel`, startup diagnostics and controlled first-run/clean-launch flows.

### Dedicated modal/dialog/overlay/editor surfaces

- Contextual Quick Entry / generic Quick Add.
- Command Palette.
- Change History dialog.
- Mobile More dialog/sheet.
- Receipt Inbox and local OCR/review flow.
- Card Create dialog.
- Card Details dialog.
- Money Edit dialog.
- Legacy Transaction editor and legacy confirmation panel.
- Shared Confirm dialog / DialogShell destructive confirmations.
- Category icon picker/assignment surfaces.
- Transaction rule editor workspace.
- Provider edit/create + image library/upload/binding editor.
- Import destructive confirmation.
- Persistence recovery confirmation.
- Page error boundary recovery.
- Desktop app-lock gate.

### Global keyboard shortcuts

Source: `src/lib/shortcuts.ts`.

| Action | Windows/Linux | Apple |
| --- | --- | --- |
| Command Palette | Ctrl K | Cmd K |
| Quick Entry | Ctrl Shift Space | Cmd Shift Space |
| Undo | Ctrl Z | Cmd Z |
| Redo | Ctrl Y / Ctrl Shift Z | Cmd Shift Z |
| Dismiss top overlay | Esc | Esc |

Global shortcuts are suppressed while editing native form controls/contenteditable and while modal ownership blocks global commands.

## 2. User capability and mutation/read inventory

| Domain | Reads / navigation | Mutations / destructive operations |
| --- | --- | --- |
| Session/auth | session bootstrap, current email, MFA status | login, MFA enroll/verify, logout, email change, password change |
| Device access | list current/other devices | revoke one, revoke all others |
| Dashboard | balances, account list, period, privacy | IBAN copy only; contextual Quick Entry launches |
| Modern transactions | list/search/filter/sort/page, split disclosure | create, edit, delete, undo/redo |
| Legacy transactions | list/search/filter | override edit, tombstone delete, undo/redo |
| Quick Entry | contextual defaults/balances | expense, income, transfer, withdrawal, refund/reconciliation-capable event, split and special-domain actions |
| Savings | account history, goals, target rate | savings transfer, cash offset paths, target-rate update, goal create/edit/delete |
| Cards | bank/card profiles, artwork, details | bank/card create/edit, archive, profile delete, restore/reactivate where surfaced |
| Card vault | reveal encrypted secret | save/update/delete PAN/expiry/CVV secret |
| Credit | statements, purchases, payments, limits/debt | purchase event, payment event, card update/archive/delete subject to debt constraints |
| Loans | schedule/history/outstanding | create/edit, payment, self-loan creation, completion semantics |
| Lending | per-person history/outstanding | lend, partial repayment, full repayment |
| Recurring | active/inactive/history/cadence | create/edit, pause/reactivate/stop, pay |
| Planning | scheduled items, forecast | create/edit scheduled, complete into event, skip/cancel where supported |
| Attention | action items/review suggestions | snooze/dismiss/review decision, contextual action launch |
| Reports | KPI/category/flow/table/chart views | period/privacy, budget and rule management |
| Budgets | category/overall scopes | create/edit/delete, threshold |
| Transaction rules | ordered enabled rules | create/edit/delete; apply to newly created/import-reviewed events |
| Accounts | names/kinds/defaults/provider/IBAN | custom account create/edit/delete, overrides, default/exclusion changes, IBAN update |
| Providers | catalog/assets/bindings | provider create/edit, image upload, image reuse/binding/replacement |
| Taxonomy | categories/subcategories/identity/history | create/rename/move/retire, blocker handling |
| Icons/preferences | icon packs/assignments/theme/text size | assignment/pack/color preference updates |
| Data management | backup/export/history/read/reload | backup, JSON import/replace, undo/redo, refresh/reload |
| Receipt OCR | local draft/inbox/preview/OCR proposal | capture, delete, scan/cancel, proposal correction, apply to Quick Entry |
| Global tools | command search, shortcuts, save state/history | command execute, global quick entry, refresh, undo/redo |

## 3. API and backend dependency inventory

| Public path | Methods | Auth mode | Main dependency / mutation boundary |
| --- | --- | --- | --- |
| `/api/health` | GET | public | process health only |
| `/api/auth/login` | POST | same-origin bootstrap | Supabase Auth password grant; owner validation; HttpOnly cookies |
| `/api/auth/logout` | POST | same-origin cookie | device-session end + Supabase logout + cookie clear |
| `/api/auth/mfa/enroll` | POST | cookie owner | Supabase Auth TOTP factors |
| `/api/auth/mfa/verify` | POST | cookie owner | Supabase Auth TOTP challenge/verify, AAL2 cookies |
| `/api/auth/session` | GET | cookie | Supabase Auth user/factors + owner state |
| `/api/auth/account` | PATCH | cookie owner+AAL2+active device | rewrite to session handler; Supabase Auth user email/password mutation |
| `/api/auth/devices` | GET, POST | cookie owner+AAL2+active device | rewrite to session handler; `myfinhub_device_sessions` |
| `/api/data` | GET, PUT | cookie or approved bearer, owner+AAL2+active device | read state / atomic mutable save RPC, revision + history generation |
| `/api/android-update` | GET | cookie or approved bearer, owner+AAL2+active device | rewrite to data handler; private Android release metadata read only; no Android repo mutation |
| `/api/history` | GET, POST | cookie or approved bearer, owner+AAL2+active device | durable history read / undo / redo RPC |
| `/api/backup` | POST | cookie or approved bearer, owner+AAL2+active device | backup RPC |
| `/api/import` | POST | cookie or approved bearer, owner+AAL2+active device | complete-document validation + transactional import RPC |
| `/api/account-metadata` | GET, PUT, POST, PATCH | cookie or approved bearer, owner+AAL2+active device | account metadata; provider create/update; Storage asset upload; asset binding |
| `/api/card-secrets` | POST, PUT, DELETE | cookie or approved bearer, owner+AAL2+active device | AES-GCM vault + `rheomiq_card_secrets` |
| unknown `/api/*` | any | n/a | final Vercel/local JSON `API_NOT_FOUND` path |

Shared HTTP boundaries: same-origin for ambient-cookie mutations, no broad CORS, bounded JSON/binary readers, strict Content-Length, strict query parsing, no-store JSON responses, request IDs and redacted unexpected 5xx details.

### Supabase/PostgreSQL authority

- `public.rheomiq_app_state` — non-ledger mutable envelope + revision/storage mode.
- `private.rheomiq_accounts`.
- `private.rheomiq_cards`.
- `private.rheomiq_credit_statements`.
- `private.rheomiq_transactions`.
- `private.rheomiq_transaction_legs`.
- `private.rheomiq_budgets`.
- `private.rheomiq_recurring`.
- `private.rheomiq_scheduled`.
- `public.rheomiq_history_points`, `public.rheomiq_history_cursor`.
- `public.rheomiq_backups`, `public.rheomiq_audit_log`.
- `public.rheomiq_card_secrets` — ciphertext-only card vault.
- `public.rheomiq_account_metadata`.
- `public.rheomiq_financial_providers`, `rheomiq_financial_provider_assets`, `rheomiq_financial_provider_asset_bindings`.
- Supabase Storage bucket `financial-provider-assets`.
- `public.myfinhub_device_sessions`.
- `public.rheomiq_android_releases` read boundary only.

All sensitive finance/provider/vault mutations are owner + AAL2 + active-device protected at API/RPC/RLS boundaries.

## 4. Stateful entity and relationship inventory

### FinanceData seed / compatibility inputs

Accounts, reporting months, legacy transactions, snapshots, seeded recurring items, subscriptions, seeded loans, lending source data and source statistics.

### FinanceData mutable state

- Legacy transaction custom rows, overrides and delete tombstones.
- Recurring custom rows and seeded recurring overrides.
- Loan extras, seeded overrides and custom loans.
- Lending custom state.
- Settings: exclusions, names, custom accounts, account overrides, category trees/identities/icons/packs/colors, presets/default accounts, savings target, text size/motion compatibility.
- Card banks, cards, deleted-card references and credit statements.
- Modern finance events and ordered ledger legs; optional split parts and domain deltas.
- Scheduled transactions.
- Review decisions and attention decisions.
- Monthly budgets.
- Savings goals.
- Transaction rules.
- Migration metadata.

### Local-only state

- Receipt drafts/images/proposals in application-local IndexedDB; not FinanceData and not uploaded by OCR.
- Legacy local CVV compatibility read path; explicit server save is the migration boundary.
- Desktop local PIN/app-lock record protected by Electron safeStorage/Windows DPAPI.
- Desktop public runtime config contains only canonical public client values; card-vault/server secrets are removed by the release bootstrap.

### Key relationships

- FinanceEvent legs reference accounts and must balance according to event semantics.
- Credit events may reference card + statement; statement references a card.
- Recurring/scheduled/default-account/rule account ids reference valid accounts.
- Scheduled transfers require distinct from/to accounts.
- Provider asset binding references an active asset belonging to the same provider.
- Card secret is keyed by owner + card id but is deliberately outside FinanceData/backups/history.
- History cursor references a durable history point and its finance revision must match canonical app-state revision.
- Relational ledger compose/apply round-trip must equal supported finance state or fail.

## 5. Product traceability matrix

Evidence classification:
- **Reusable**: direct unit/source/rendered evidence already maps cleanly to the cell.
- **Partial**: useful evidence exists but remaining manual/real-stack states still need direct inspection.
- **Insufficient**: synthetic/source proof cannot satisfy the required real runtime/destructive/manual cell.

| Capability | UI/control | Domain operation | Persistence/API path | Existing success/failure evidence | Visual/a11y evidence | Classification / remaining proof |
| --- | --- | --- | --- | --- | --- | --- |
| Auth + MFA | LoginScreen, MfaScreen | login/enroll/challenge/verify/logout | Supabase Auth via auth APIs | auth-resilience, security, account-security | final auth screenshots; semantic form labels/alerts | Partial — real invalid/expired/revoked/auth-outage states |
| Device sessions | DeviceAccessSettings | list/revoke/revoke-others | `/api/auth/devices`, device table | device-access tests + direct RLS negative contexts | Settings rendered coverage | Partial — safe real revoke integration scenario |
| Dashboard | DashboardPage | selectors/balances/navigation | read-only FinanceData + metadata | frontend QA, shell-dashboard-hierarchy | full-page/geometry/dark-theme | Partial — personal manual route review at all required states |
| Transactions | TransactionsPage | edit/delete/search/sort/page | FinanceData event/legacy state → atomic save | completion CRUD, legacy transaction QA, scanability | full-page/extreme mobile | Partial — real API reload persistence |
| Quick Entry | ContextualQuickAdd/QuickAdd | create/update finance events | atomic mutable save/history | ledger foundations, frontend/completion QA | dialog geometry/primitives | Partial — complete special-kind real-stack matrix |
| Savings | SavingsPage | transfer/target/goals | event/settings/goals → save | ledger/savings source tests + rendered suite | full-page/responsive | Partial — CRUD/reload real stack |
| Cards | CardsPage/dialogs | bank/card upsert/archive/delete | FinanceData cards + vault deletion boundary | card/credit unit tests, CRUD rendered | full-page/card visual suites | Partial — restore/delete/reload real stack |
| Card vault | CardDetailsDialog | reveal/save/update/delete secret | `/api/card-secrets` → AES-GCM table | crypto + native-bearer-vault + direct live schema/RLS | dialog coverage | Partial — safe real-stack secret CRUD using isolated backend |
| Credit | CreditCardPage | purchase/payment/statement/card lifecycle | events/statements/cards → save | credit statements + overlimit QA | mobile/desktop visual evidence | Partial — real-stack lifecycle/reload |
| Loans | LoansPage | create/edit/pay/self-loan | loan state + finance event | obligation lifecycle + finance semantic tests | full-page/dialog coverage | Partial — real-stack CRUD |
| Lending | LendingPage | lend/partial/full repay | finance events/receivable semantics | completion CRUD partial repayment + semantic tests | full-page/privacy coverage | Partial — full lifecycle/reload |
| Recurring | RecurringPage | create/edit/cadence/status/pay | recurring state + event save | recurring-cadence QA/tests | bounded disclosure/extreme mobile | Partial — real-stack CRUD/reload |
| Planning | PlanningPage | schedule CRUD/complete/forecast | scheduled state + completed event | exact-head planning-forecast QA + completion/undo-redo + skip/cancel/load-more/negative/empty states | direct desktop/mobile/negative evidence inspected | Partial — functional UI lifecycle is verified; isolated real-stack reload/persistence remains pending |
| Attention | AttentionPage | action/snooze/dismiss/review | decision records + contextual action | action-center QA | full-page | Partial — every decision/failure path |
| Reports | ReportsPage | period/KPI/charts/privacy | selectors over canonical state | reports visual + semantic/report tests | chart/full-page evidence | Partial — mutation reconciliation after real-stack flows |
| Budgets | Reports budget UI | create/edit/delete/threshold | budgets state → relational budgets | budget-rules QA + persistence validation | Reports visual | Partial — real reload/reconciliation |
| Rules | TransactionRulesWorkspace | create/edit/delete/apply | rule state + applyTransactionRules | budget-rules/settings rules QA | dialog/settings rendered | Partial — real transaction application/reload |
| Accounts + IBAN | AccountManagementSettings | create/edit/delete/defaults/IBAN | FinanceData settings + account metadata API/RPC | account-metadata QA/tests | Settings/account evidence | Partial — complete destructive/reload real stack |
| Providers/assets | FinancialProviderManagementSettings | provider create/edit/upload/bind/reuse | account-metadata API + provider RPCs + Storage | provider-brand QA/tests + live DB/storage integrity | Settings/provider evidence | Partial — safe isolated real upload/binding failure cases |
| Taxonomy | CategoryIconsWorkspace | create/rename/move/retire | taxonomy transform → settings save | taxonomy-management QA/tests | Settings category evidence | Partial — blocker/destructive manual states |
| Icons/preferences | icon workspaces/readability | pack/assignment/color/text size | settings save | icon packs/category adoption/settings tabs | rendered light/dark/mobile | Partial — every control state and 200% zoom |
| Data/history | Settings data + history dialog | backup/import/reload/undo/redo | backup/import/history RPCs | durable history tests + direct production atomicity/backups | history/settings evidence | Partial — isolated destructive import + conflict/concurrency |
| Receipt OCR | ReceiptInbox → Quick Entry | local capture/OCR/proposal/apply | IndexedDB local → normal finance event save | receipt OCR QA + privacy/parser tests | receipt rendered QA | Partial — OCR asset/outage/manual correction states |
| Command/global tools | CommandPalette/AppShell | search/action/shortcut/refresh | routes/context actions/useFinance | command palette, shortcuts, persistence tests | shell/focus/dialog QA | Partial — keyboard-only full traversal/error recovery |
| 404/routing | NotFoundPage + 404.html | hash/HTTP/API recovery | router + static/Vercel/local API routing | routing-not-found + build 404 + API 404 tests | final 404 capture target | Partial — assistant manual rendered review + deployed runtime proof |
| Desktop host | Desktop lock/update/startup | startup, lock, update, card-vault proxy | local Node host + production API | Windows/first-run/clean-launch prior green gates | desktop-specific source/QA | Partial — exact final-head Windows gates |

## 6. Evidence reuse disposition

Reusable without re-designing the test: source/unit validation for pure domain semantics; production read-only schema/RLS/integrity checks; exact-head CI/CodeQL for unchanged code cells; existing focused rendered QA for regression assertions.

Partial and must be revisited manually: every primary route screenshot, Settings tab, auth state, dialog state, dense/extreme data state, responsive breakpoint, light/dark state, keyboard/focus behavior and visual hierarchy. Automation producing a PNG is not human approval.

Insufficient for final closeout: synthetic QA alone for destructive CRUD, auth/device revocation, card-vault writes, provider Storage failure recovery, import replacement, conflict/concurrency and post-merge canonical validation. These require an isolated non-production real backend or explicitly safe production read-only actions.

## 7. Inventory conclusion

The inventory covers all source-defined product routes, Settings tabs, auth/desktop gates, dedicated modal/overlay components, global shortcuts, user-visible finance domains, public API routes, backend persistence boundaries and stateful entity classes. New capabilities or persistence paths discovered after this checkpoint must be added here and to the main completion plan before implementation/verification continues.
