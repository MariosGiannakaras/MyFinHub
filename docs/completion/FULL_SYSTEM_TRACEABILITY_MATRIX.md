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
| Auth + MFA | LoginScreen, MfaScreen | login/enroll/challenge/verify/logout | Supabase Auth via auth APIs | auth-resilience, security, account-security + Real Stack AAL2/session proof | canonical final auth matrix + focused session-expiry/MFA-downgrade evidence | Reusable — mandatory password→TOTP→AAL2, revoke/re-auth and expiry/downgrade paths are runtime-proven; canonical auth-unavailable/error visual states were directly reviewed. Direct interactive DevTools inspection remains an 8.13 protocol gap, not a traceability-cell gap. |
| Device sessions | DeviceAccessSettings | list/revoke/revoke-others | `/api/auth/devices`, device table | device-access tests + direct RLS negative contexts + Real Stack #14 | Settings rendered coverage | Reusable — real two-session revoke/revoke-others/stale-session/re-auth integration is proven on the isolated stack. |
| Dashboard | DashboardPage | selectors/balances/navigation | read-only FinanceData + metadata | frontend QA, shell-dashboard-hierarchy + canonical post-merge CI | canonical 216-matrix + focused dashboard hierarchy/dense evidence | Reusable — the exact canonical Dashboard group was directly reviewed in all six Light/Dark × desktop/tablet/mobile variants, with focused hierarchy/dense states and no unresolved visual defect. |
| Transactions | TransactionsPage | edit/delete/search/sort/page | FinanceData event/legacy state → atomic save | completion CRUD, legacy transaction QA, scanability + Real Stack #23/#29 | full-page/extreme mobile + directly reviewed persistence captures | Reusable — real built UI mutation + hard-reload persistence is proven for modern and legacy transaction paths. |
| Quick Entry | ContextualQuickAdd/QuickAdd | create/update finance events | atomic mutable save/history | ledger foundations, frontend/completion QA + exact-head Real Stack `37226283683` | dialog geometry/primitives + directly reviewed hard-reload matrix | Reusable — all eight generic intents mutate through the actual browser/API/local-Supabase path, survive hard reload and pass final canonical read-back. |
| Savings | SavingsPage | transfer/target/goals | event/settings/goals → save | ledger/savings source tests + rendered suite + Real Stack #31 | full-page/responsive + directly reviewed persistence capture | Reusable — real goal creation and current→savings transfer survive hard reload with same-origin API state and visible balance/progress reconciliation. |
| Cards | CardsPage/dialogs | bank/card upsert/archive/delete | FinanceData cards + vault deletion boundary | card/credit unit tests, CRUD rendered + Real Stack #37 | full-page/card visual suites + directly reviewed restored-card capture | Reusable — real create + secure details + archive + restore + permanent delete survive the local API/Supabase hard-reload lifecycle; final absence after delete is asserted. |
| Card vault | CardDetailsDialog | reveal/save/update/delete secret | `/api/card-secrets` → AES-GCM table | crypto + native-bearer-vault + direct live schema/RLS + Real Stack #17/#29 | dialog coverage | Reusable — isolated real-stack secret write/read/delete and backup-separation behavior are proven with synthetic secrets only. |
| Credit | CreditCardPage | purchase/payment/statement/card lifecycle | events/statements/cards → save | credit statements + overlimit QA + Real Stack #28/#29 | mobile/desktop visual evidence + directly reviewed real-stack purchase/payment captures | Reusable — purchase→statement→payment survives hard reload against the real local API/Supabase stack. |
| Loans | LoansPage | create/edit/pay/self-loan | loan state + finance event | obligation lifecycle + finance semantic tests + Real Stack #31 | full-page/dialog coverage + directly reviewed persistence capture | Reusable — a real created installment obligation survives API persistence and hard reload; payment/self-loan semantics remain covered by the accepted lifecycle/invariant suites. |
| Lending | LendingPage | lend/partial/full repay | finance events/receivable semantics | completion CRUD partial repayment + semantic tests + Real Stack #31 | full-page/privacy coverage + directly reviewed persistence capture | Reusable — real lend + partial repayment survive hard reload with person aggregation, €30 outstanding and API-backed event persistence; full-repayment semantics remain covered by the accepted lifecycle suite. |
| Recurring | RecurringPage | create/edit/cadence/status/pay | recurring state + event save | recurring-cadence QA/tests + Real Stack #31 | bounded disclosure/extreme mobile + directly reviewed persistence capture | Reusable — real create→hard reload→pause→hard reload is proven against the local API/Supabase stack; cadence/pay/reactivate/stop semantics remain covered by accepted lifecycle suites. |
| Planning | PlanningPage | schedule CRUD/complete/forecast | scheduled state + completed event | exact-head planning-forecast QA + completion/undo-redo + skip/cancel/load-more/negative/empty states + Real Stack #32 | direct desktop/mobile/negative evidence + directly reviewed persistence capture | Reusable — real scheduled create→reload→complete→reload is proven against the isolated API/Supabase stack; skip/cancel/forecast semantics remain covered by accepted lifecycle suites. |
| Attention | AttentionPage | action/snooze/dismiss/review | decision records + contextual action | action-center QA + exact-head Real Stack `37226283683` | full-page + focused split-review/decision evidence | Reusable — actual-browser snooze/dismiss persist across hard reload, durable Undo restores the decision/row across reload, final canonical API read-back confirms the decision, and the restored legacy split-review modal is directly reviewed. |
| Reports | ReportsPage | period/KPI/charts/privacy | selectors over canonical state | reports visual + semantic/report tests + Real Stack #32 budget mutation | chart/full-page evidence + directly reviewed persisted-budget capture | Reusable — Reports re-renders the persisted €777 overall budget after hard reload; period/KPI/chart semantics remain covered by accepted report suites. |
| Budgets | Reports budget UI | create/edit/delete/threshold | budgets state → relational budgets | budget-rules QA + persistence validation + Real Stack #32 | Reports visual + directly reviewed persisted-budget capture | Reusable — real overall-budget creation is persisted through the API/relational path and survives hard reload; edit/delete/threshold semantics remain covered by accepted budget suites. |
| Rules | TransactionRulesWorkspace | create/edit/delete/apply | rule state + applyTransactionRules | budget-rules/settings rules QA + Real Stack #32 | dialog/settings rendered + directly reviewed categorized-transaction capture | Reusable — a real rule survives hard reload and categorizes a subsequent Quick Entry transaction as `Rule Applied`, which also survives hard reload. |
| Accounts + IBAN | AccountManagementSettings | create/edit/delete/defaults/IBAN | FinanceData settings + account metadata API/RPC | account-metadata QA/tests + Real Stack #31 | Settings/account evidence | Reusable — real custom-account create survives hard reload and real destructive delete survives another hard reload/API read-back; edit/default/IBAN correction remain covered by the accepted account-metadata suite. |
| Providers/assets | FinancialProviderManagementSettings | provider create/edit/upload/bind/reuse | account-metadata API + provider RPCs + Storage | provider-brand QA/tests + live DB/storage integrity + Real Stack #44 | Settings/provider evidence + directly reviewed settled Storage/reuse capture | Reusable — real provider create + one-asset/two-binding reuse + hard reload + direct DB/Storage read-back + registration-failure cleanup are proven on the disposable local stack. |
| Taxonomy | CategoryIconsWorkspace | create/rename/move/retire | taxonomy transform → settings save | taxonomy-management QA/tests + Real Stack #37 + canonical focused CI | canonical Settings categories/rename matrix + blocker/confirm evidence | Reusable — real create/move/retire survives hard reload; canonical focused evidence directly covers retirement blocked/confirm states and the post-merge Settings matrix was reviewed across all six variants. |
| Icons/preferences | icon workspaces/readability | pack/assignment/color/text size | settings save | icon packs/category adoption/settings tabs + Real Stack #37 + canonical accessibility CI | canonical icon-selection/settings matrix + custom-color/pack focused evidence | Reusable — real assignment persists across hard reload; icon-pack/custom-color states and all six post-merge Settings icon variants were directly reviewed, while canonical keyboard/semantic/Large-text evidence is green. |
| Data/history | Settings data + history dialog | backup/import/reload/undo/redo | backup/import/history RPCs | durable history tests + real-stack backup/restore/conflict + Real Stack #29 Settings Data import/export | history/settings evidence + directly reviewed import-history capture | Reusable — isolated backup/export, invalid+valid import, hard reload, durable history, undo/redo and revision-conflict behavior are proven. |
| Receipt OCR | ReceiptInbox → Quick Entry | local capture/OCR/proposal/apply | IndexedDB local → normal finance event save | receipt OCR QA + privacy/parser tests + canonical focused CI | capture/outage/proposal/review/delete focused evidence | Reusable — packaged assets, outage/retry, proposal, manual correction/review, apply/delete and confirmation stacking are runtime-proven on the canonical product tree and the distinct evidence states were directly inspected. |
| Command/global tools | CommandPalette/AppShell | search/action/shortcut/refresh | routes/context actions/useFinance | command palette, shortcuts, persistence tests + canonical keyboard/semantic CI | canonical shell matrix + command desktop/mobile/focus/recovery evidence | Reusable — command palette desktop/mobile, shortcut/focus semantics, refresh recovery and canonical keyboard traversal checks pass; focused evidence was directly reviewed. Direct interactive DevTools inspection remains tracked only under 8.13. |
| 404/routing | NotFoundPage + 404.html | hash/HTTP/API recovery | router + static/Vercel/local API routing | routing-not-found + build 404 + API 404 tests + owner-approved preview runtime proof | directly reviewed responsive/light/dark/keyboard/200%-equivalent evidence | Reusable — 8.14 is 10/10: unknown hash, local/static HTTP 404, unknown API and temporary Vercel preview HTTP 404 behavior are directly proven. |
| Desktop host | Desktop lock/update/startup | startup, lock, update, card-vault proxy | local Node host + production API | prior exact-head Windows Desktop/First Run/Clean Launch + focused host QA | directly reviewed host captures + titlebar/lock/update/startup evidence | Reusable for implemented host behavior — current product host behavior is proven; final review-head Windows rerun remains a merge gate rather than a missing traceability cell. |

## 6. Evidence reuse disposition

Reusable without re-designing the test: source/unit validation for pure domain semantics; production read-only schema/RLS/integrity checks; exact-head CI/CodeQL for unchanged code cells; existing focused rendered QA for regression assertions.

Partial and must be revisited manually: every primary route screenshot, Settings tab, auth state, dialog state, dense/extreme data state, responsive breakpoint, light/dark state, keyboard/focus behavior and visual hierarchy. Automation producing a PNG is not human approval.

Insufficient for final closeout: synthetic QA alone for destructive CRUD, auth/device revocation, card-vault writes, provider Storage failure recovery, import replacement, conflict/concurrency and post-merge canonical validation. These require an isolated non-production real backend or explicitly safe production read-only actions.

## 7. Inventory conclusion

The inventory covers all source-defined product routes, Settings tabs, auth/desktop gates, dedicated modal/overlay components, global shortcuts, user-visible finance domains, public API routes, backend persistence boundaries and stateful entity classes. New capabilities or persistence paths discovered after this checkpoint must be added here and to the main completion plan before implementation/verification continues.


### Post-merge canonical disposition — 2026-10-05

The capability matrix above is fully classified for the implemented `develop` product tree. `Reusable` means the cell has direct supporting functional/rendered/backend evidence; it does not imply production release proof. The independent-manual protocol still has three explicit BLOCKED items (direct interactive canonical-runtime navigation, direct DevTools console/network inspection and direct DOM/accessibility-tree inspection), tracked separately in `INDEPENDENT_VERIFICATION_LEDGER.md`. Release-candidate and production verification remain outside this matrix's current `develop` closeout.

## 8. Post-v1.4 cross-stack reconciliation addendum (DV-FB; active, not accepted)

Baseline for this addendum: page remediation accepted through #547, Dashboard #528, and Settings #546 on `develop` as of 2026-10-09. The earlier traceability cells above remain historical proof references; they do **not** prove new service-asset mutation durability or the current Settings deep-link contract automatically. This addendum is the live DV-FB01/02/04/07/08 inventory delta; it is **not** DV-FB10 closure.

| Capability / entry | Frontend/domain owner | API, persistence and reload owner | Evidence to retain / missing gate | Classification |
| --- | --- | --- | --- | --- |
| Settings seven addressable tabs | `src/lib/routing.ts` `settingsHash` and `src/App.tsx` tab navigation/history; `SettingsPage` controlled `activeTab` | Hash navigation, reload, back/forward return to same tab; mutations still use revisioned FinanceData or dedicated secured account metadata | #546 exact-head routing/unit tests, seven Light/Dark tab screenshots, mobile + 1920/2560 evidence accepted; final combined FB regression pending | **Reachable; combined regression pending** |
| Savings historical month/goal shared pool | `SavingsPage`, canonical `src/lib/reportingPeriod.ts`, savings account selectors and shared goal allocation | FinanceData event+goal state → revisioned FinanceData save → historical period-end view after reload | #532 exact-head July ↔ August selected-period regression accepted; combined source/runtime semantics drift scan pending | **Reachable; cross-domain audit pending** |
| Credit additional card and card-local management | `CreditCardPage`, `CanonicalCreditCardStack`, existing profile/secure-details dialogs | FinanceData card mutations and protected card-vault API for secrets; debt/archive semantics enforced separately | Accepted Credit page QA covers populated add/edit and vault affordances; combined API/vault/negative-authorization audit pending | **Reachable; security/regression audit pending** |
| Recurring/service brand optional image | `RecurringPage` local unrendered selection → upload via `recurringServiceAssetClient` → durable `onUpsertDurably` | `/api/account-metadata?resource=recurring-service-assets` (authenticated owner+AAL2), separate Storage bucket `recurring-service-assets`, metadata/RPC and relational `logo_asset_key` + FinanceData `logoAssetKey`; reload via canonical recurring state | Source, API asset tests and rendered synthetic asset/fallback/pay/pause/remove evidence exist; **new exact-mutation save receipt, real-stack revisioned reload and failure cleanup still require targeted validation** | **Partial; DV-FB04/07/08 open** |
| Recurring image replacement | Upload new key first, then `useFinance.updateDurably` on the same optimistic/history queue; only after receipt, reference-aware DELETE previous key | `SequentialQueue.enqueueWithReceipt` resolves solely after `saveData` + matching history revision; dependent pending receipts reject on fail; separate reference-aware release/purge RPC protects shared/seeded references | New FIFO receipt tests, source regression, synthetic rendered cleanup/failure state must pass; real-stack stale-revision, network failure, shared-ref cleanup and reload proof pending | **Partial; never treat an asset upload as finance-save confirmation** |
| Recurring image removal and failed save | Clearing `logoAssetKey` is a finance mutation; previous image deletion only after durable success and only when not shared; new upload cleaned only on failed save | Server release validates actual references before Storage delete; cleanup failure is reported separately from successful durable FinanceData save | Server/client negative namespace tests and browser error rendering pending; previous asset must not be deleted on finance conflict | **Partial; fail closed** |
| Schema namespace | `src/types.ts` optional recurring `logoAssetKey`, `server/validation.ts` canonical `service-asset-[a-f0-9]{24}` | `accountMetadataHandler` parser + migration `20261008165700_add_recurring_service_assets.sql` FK/check + Storage path/RPC share canonical namespace | Source/API negative tests pending fresh exact-head CI + migration/real-stack validation | **Partial; no migration rule relaxation** |
| Windows/web API parity | Web and Windows desktop both access canonical API, FinanceData, revision/history and owner+AAL2 boundaries | Windows automated Desktop, First Run and Clean Launch gates; no privileged client shortcut | Final exact-head Windows/browser/API matrix and artifacts pending | **Partial; Android repo untouched** |

**Owner and compatibility invariants.** Recurring logo keys now reject non-canonical identifiers at document validation as already enforced by the asset API, Storage and relational constraints. Android is a separate repository and is not edited. Any Android client submitting a non-canonical recurring logo key must adopt the canonical `service-asset-` reference contract through its own owner-managed compatibility work; no claim about an Android deployment or supported version is made here.

**Open FB closeout requirements.** Continue the entire source-driven reachability/affordance/security/domain scan in DV-FB01–FB03/05–06, prove recurrence image create/replace/remove and failure/retry against the disposable real stack for FB04/07, validate schema/API/migration/owner+AAL2 for FB08, rerun current web/Windows for FB09, and classify or fix all remaining gaps before accepting FB10. DV-M motion work remains blocked.

## 9. DV-FB source-to-operation reachability matrix (active review)

This is the source-anchored inverse reachability inventory begun after Settings #546 and recurring-service durability #548. **Source reachability is not equivalent to durable runtime acceptance.** The column *Persisted owner* identifies the authoritative API/storage/FinanceData path; tests and gaps must still be independently reconciled and classified under DV-FB01–FB10. Server calls use the owner's mandatory AAL2/session provenance, validation, RLS and revision/history contract. No Android repository changes.

| User domain / operation | Reachable UI and handler | Canonical persisted owner / reload | Source/real-stack evidence and disposition |
| --- | --- | --- | --- |
| Login, MFA enroll/verify, session renewal, logout | `LoginScreen`, `MfaScreen`, `useSession` | `/api/auth/login`, `/api/auth/mfa/*`, `/api/auth/session`, `/api/auth/logout`; Supabase Auth + session cookies | Real Stack owner/AAL2, rejected wrong password/TOTP, restored session: **covered** |
| Device list, revoke one/revoke others | Settings Profile → `DeviceAccessSettings` → `getConnectedDevices`, `revokeConnectedDevice`, `revokeOtherConnectedDevices` | `/api/auth/devices` → device registry + owner-session provenance | Real Stack two AAL2 devices, revocation and re-auth: **covered** |
| Current/historical account balances and primary-account charts | `DashboardPage`, `dashboardAccounts`, period selection | Read-only FinanceData account/legacy/event selectors, `/api/data` GET; no new mutation | Accepted Dashboard QA for July/current and width variants; semantically compare selected period with Savings/Reports: **cross-domain audit open** |
| Modern event create/edit/delete, ledger splits and undo | `ContextualQuickAdd`, `TransactionsPage` → `FinanceApp.addEvent/deleteEvent/editEvent` | `useFinance.update` → `saveData` PUT `/api/data` + revisioned history; `/api/history` | Real Stack create/edit/delete/reload/undo and generic Quick Entry intents: **covered**, broad optimistic success-copy scan open |
| Legacy transaction override/tombstone | Transactions edit/delete → `withLegacyOverride/withLegacyTombstone` | FinanceData overrides/deleted via same `/api/data` revision | Real Stack legacy persistence/reload: **covered** |
| Savings target, transfer and goal create/edit/delete | `SavingsPage` → `updateSavingsTarget`, `upsertSavingsGoal/deleteSavingsGoal`, contextual savings transfer | FinanceData settings, savingsGoals, and ledger event; revision and history; selectors use selected reporting month | Real Stack goal and transfer/reload + accepted Savings selected-period QA: **covered** for representative mutation; historical negative parity scan open |
| Bank/card profile create/edit, archive/reactivate | `CardsPage`, `CardCreateDialog`, `CreditCardPage` → `upsertBank/upsertCard/archiveCard` | FinanceData cardBanks/cards; `/api/data` + history | Real Stack card CRUD/archive/restore/reload; accepted card-local Credit management: **covered** |
| Card-vault secret reveal/write/delete | `CardDetailsDialog` and card-local secure management → `cardVaultClient` | `/api/card-secrets` → encrypted Supabase vault, owner+AAL2 + rate-limit; **never in FinanceData/backup** | Real Stack vault read/write/delete and backup-separation: **covered** for direct actions; permanent-card-delete cross-store ordering **OPEN BLOCKER** (see below) |
| Credit card statement lifecycle, purchase/payment | `CreditCardPage`, `CanonicalCreditCardStack`, `ContextualQuickAdd`, `prepareCreditStatementEvent` | FinanceData events/statements/cards + revisioned `/api/data`; vault isolated | Real Stack purchase/payment hard reload; Credit multi-card Add/profile/details rendered proof: **covered**, permanent deletion gap remains |
| Loans / self-loan creation, installment payment | `LoansPage`, `ContextualQuickAdd` → `upsertLoan`, loan payment event | FinanceData customLoans/loanOverrides/events; ledger history | Real Stack loan create/reload, domain installment tests: **representative proof**, inverse operation inventory open |
| Lending / receivable lend, partial/full repay | `LendingPage` → contextual Quick Entry → `addEvent` | FinanceData receivable events and person aggregation | Real Stack lending + partial repayment/reload; full repayment domain tests: **representative proof** |
| Recurring create/edit/pay/pause/restart/stop | `RecurringPage` → `upsertRecurringDurably` for editor, `upsertRecurring` for lifecycle, contextual payment | `/api/data` FinanceData recurringCustom/recurringOverrides + history; payment ledger event | Real Stack create/pause/reload and FB receipt/asset pipeline: **covered for targeted paths**, lifecycle async success phrasing audit open |
| Service artwork create, replace, remove | `RecurringPage` editor local File selection → `recurringServiceAssetClient` upload → `updateDurably` → old-key release only after save | `/api/account-metadata?resource=recurring-service-assets` → owner+AAL2 Storage, relational recurring FK and reference-aware RPC; `/api/data` revisioned key; reload | Exact-head Real Stack #548: genuine Storage create/reload, stale revision rejection, replace, denial of deletion while referenced, remove/purge **PASS** at `ead9c0d`; rendered synthetic rollback/error coverage and new combined UI gate still pending |
| Scheduled planning create/edit, complete, skip/cancel | `PlanningPage`, `PlanningApprovedDesktop` → `upsertScheduled/completeScheduled` | FinanceData scheduled + completed event, `/api/data` history | Real Stack create/complete/reload; targeted skip/cancel tests: **representative proof**, optimistic feedback wording audit open |
| Attention action navigation, snooze/dismiss, review decisions | `AttentionPage` → `handleAttention`, `decideAttention`, `decide`; deep link to Transactions | FinanceData attentionDecisions/reviewDecisions, `/api/data`; action destinations are normal routes/dialogs | Real Stack decision/reload + undo; contextual legacy review QA: **representative proof**, error-success wording audit open |
| Reports, monthly budgets, transaction rules | `ReportsPage`, Settings Rules → `upsertBudget/deleteBudget/upsertRule/deleteRule` | FinanceData budgets/transactionRules; ordered evaluation in `applyTransactionRules`; `/api/data` | Real Stack budget+rule created/reloaded, applied to new event; Reports charts and period selector QA: **representative proof** |
| Account/provider manager, IBAN, logos | Settings Accounts → `AccountManagementSettings`, `FinancialProviderManagementSettings`; `accountMetadataClient` | FinanceData settings customAccounts/accountOverrides; `/api/account-metadata` owner+AAL2 record/provider/Storage RPCs | Real Stack account/provider create/reload + provider asset reused in two bindings; #548 adds durable settings receipt **before** ancillary IBAN write with partial-success warning: **new exact-head real-browser validation pending** |
| Category taxonomy/icons, text preference | Settings Categories/Icons/General → taxonomy workspace and icon assignments | FinanceData settings category identities/icons/packs/textSize via `/api/data`; no persistent app-level motion setting | Real Stack taxonomy/icon hard reload; reduced-motion is OS-owned: **covered** |
| Settings seven tabs/deep-link/history | `src/lib/routing.ts` + `SettingsPage` controlled activeTab | Hash route/history + FinanceData for settings mutations; reload/back/forward same tab | #546 seven-tab actual rendered Light/Dark/mobile, negative 404 and browser history QA: **accepted** |
| Backups, JSON import, durable undo/redo | Settings Data, AppShell history/undo/redo → `useFinance` | `/api/backup`, `/api/import`, `/api/history` with AAL2/revision/history cursor | Real Stack backup+restore/invalid import and history undo/redo; no destructive production re-import: **covered** |
| Web/Windows shared API behavior | Browser shell, Windows desktop host and API proxy | Same `/api/data`, `/api/history`, `/api/card-secrets`, auth/AAL2; Windows local PIN via OS safeStorage only | Cross-engine/Windows review-head gates **pending**; Android compatibility only (no Android code touched) |

### DV-FB03/04/06/07 permanent card deletion correction — implemented, pending acceptance

`withCardSecretCleanupPending` now atomically removes a card profile and records an opaque `pendingCardSecretDeletes` ID in the same revisioned FinanceData mutation; the existing `withCardProfileDeleted` still enforces archived/fully-settled credit and immutable financial history with minimal credit tombstones. `useFinance.updateDurably` must resolve **before** the lazy-loaded `cardSecretDeletion.finishCardDeletion` can issue the protected vault DELETE. The backend `requireCommittedDeletion:true` route invokes `rheomiq_delete_committed_card_secret` with a single SQL transaction: lock the canonical finance row, confirm owner+AAL2 and a pending deletion marker, reject active relational cards, then delete encrypted vault ciphertext under RLS. Local legacy CVV is removed after remote success and before the marker is durably acknowledged. On failure the marker remains in FinanceData and the UI reports partial success; background reconciliation attempts an outstanding marker at most once per mounted session, so a reload can retry without a busy loop. Source/unit tests and a new genuine Supabase test cover active-profile denial, marker reload, stale revision, protected deletion and marker acknowledgement, plus an explicit undo→DELETE denial→redo path.

**Still unaccepted:** current-head real-stack/migration recovery validation, screenshot and failure-path inspection, undo-after-delete messaging, older API/Windows rollout compatibility and final review matrix. The legacy DELETE body is maintained for backwards API compatibility and remains a separately authorized owner+AAL2 operation; only new committed-cleanup calls gain the transactional absence/marker guarantee. Do not imply that old clients automatically use the new protocol. DV-FB07/10 remain unchecked until full acceptance.

### Classified DV-FB04/07 cross-store risk — account Settings and IBAN metadata

Before this batch, `AccountManagementSettings` wrote IBAN metadata before a fire-and-forget FinanceData change and displayed a completed Save/Delete message immediately. #548 added `onFinanceDurably` only for account editor create/edit/delete. The FinanceData revision now commits **before** ancillary IBAN metadata updates; a metadata failure produces an explicit partial-success warning instead of an incorrect global failed-save claim. Draft exact-head unit and real-stack/browser evidence must pass. Simple Settings toggles retain the existing optimistic save-state notice in `AppShell`, not the account-editor durable receipt contract.

### DV-FB04/07 new-card secure-detail creation correction — implemented, pending acceptance

Both Cards and Credit use `onStageNewCard` wired to `finance.updateDurably`: after local PAN/expiry/CVV input validation, a new card profile with **no secrets** is revisioned and confirmed before `saveCardDetails` contacts the encrypted vault. Final card metadata (`last4`, `vaultRef`) is also committed through `onUpsertCardDurably`; a failed final receipt keeps the dialog open and reports that the server vault write succeeded but the card-profile link needs reload/retry. If initial staging fails, **no secret is sent** to the vault; if the vault fails after staging, the profile remains without stored secure details and can be completed later, not an unreferenced orphan. Existing card secure updates are similarly receipted; the error state explicitly distinguishes partial vault success. A new synthetic rendered regression `card-vault-finance-profile-failure` proves that a vault write with rejected FinanceData update does not close the dialog or falsely report total success. Full evidence and atomic backend real-stack/restart checks remain pending.

### DV-FB05 semantic parity finding — recurring cadence in Attention

Source comparison found `src/lib/attention.ts` previously used `monthDate(asOf,day)` for every recurring obligation, incorrectly flagging quarterly/annual subscriptions as monthly overdue despite `recurringCadence` and `nextRecurringDate` supporting multi-month/year intervals. The FB batch now routes **non-monthly** attention through `recurringCadence`/`addRecurringInterval`, deriving the last real cycle due and next scheduled cycle from `firstExpectedDate` or the last actual payment. Linked payments suppress already-paid previous cycles, and upcoming notices are bounded by the same seven-day attention window. Monthly attention is intentionally unchanged pending wider selected-month semantic review. Regression tests prove quarterly paid January does **not** become falsely overdue in February/March, flags real April warning/overdue, clears after payment, and yearly December remains silent until the true annual due window. This implementation is **not accepted** until current domain CI and rendered/real-stack regression evidence; DV-FB05 remains unchecked.

### DV-FB05 discovered future first loan due-date mismatch

`cashFlowForecast` already uses `loan.firstExpectedDate` as the first possible future installment, but `Attention.loanDue` previously substituted the current month's billing day when the first payment was in a later month, falsely marking not-yet-started loans overdue. The canonical future-first-date guard now suppresses all early reminders, produces an upcoming notice only inside the seven-day window, and marks overdue only after the actual first installment date if unpaid. `tests/attention.test.ts` guards October/December, the warning window and linked first payment. This is implemented but remains **unaccepted** until cross-domain and rendered evidence is reviewed.

### DV-FB05 discovered future-dated statement settlement mismatch

`creditStatementView(data, record, asOf)` previously summed every linked event regardless of `event.date`, while `creditDebtForCard` and canonical balances honor the selected as-of date. A future-dated repayment could therefore falsely mark the statement *paid* in an earlier date view and remove it from payable suggestions. The shared view now excludes events dated after `asOf` from totals, remaining balance, payment/purchase IDs and status **without altering persisted statement records or event history**. `tests/credit-statements.test.ts` locks unpaid August 17 vs paid August 21 and the pre-August-16 payment snapshot. This is implemented but remains pending cross-domain/rendered validation before accepting DV-FB05.

### DV-FB05 early-paid monthly forecast double-counting

The monthly recurring and loan forecast projections previously derived a due day from historical payment averages but could still forecast the current month's charge **after** an already linked early-cycle payment. This caused a duplicate prospective outflow while the corresponding Attention alerts were already suppressed. The recurrence and loan forecast owners now advance directly to the next month if a linked payment dated on/before `asOf` settled the current cycle. Multi-month/year cadence remains handled by the separate canonical interval engine. Added regression fixtures with June/July due-day payments and August 10 early settlement, checking no duplicate August movement and the next September installment. Implementation only; FB05 acceptance awaits rendered and current-head validation.

### DV-FB05 Reports/Savings current-month account and credit snapshot parity

`ReportsPage` and its `operationalReportSnapshot`, `reportInsightModel` and `primaryAccountSeries` previously sampled `monthEnd(month)` for current-month account balances and credit exposure. This included future-dated payments that `SavingsPage` correctly excluded with `reportingPeriodEndDate(month,asOf)`. The current Reports route now passes the same application `today` as-of date for account/credit snapshots; completed historical months keep their calendar month-end snapshots. Budget elapsed-day explanatory text likewise derives from the actual application as-of date rather than the finance document's `updatedAt` editing timestamp. `tests/reports.test.ts` checks a future bank expense, future credit purchase, current-month chart and historical month behavior. **Monthly flow/category/budget aggregation remains month-key scoped as before**; future-dated actual events within the current month require separate FB05 semantics review and are not falsely claimed fixed. Pending current-head rendered QA and full FB acceptance.

### Remaining inverse/invariant closeout

Unclassified backend exported operations and hidden/focusable frontend branches require ongoing DV-FB02/03 source + rendered inspection, notably shortcut actions, legacy/taxonomy negative states and saved-card deletion. Verify period/as-of/statement/forecast semantics against canonical selectors (FB05), AAL2/owner/RLS/vault per sensitive operation (FB06), deployment/Windows and Android API boundary (FB09). Do not check DV-FB01–FB10 as accepted or start DV-M before all classified gaps have validated outcomes.
