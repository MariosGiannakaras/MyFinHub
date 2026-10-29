# MyFinHub — full application correction roadmap (#649, 2026-10-29)

**Authority:** issue #649 · `AGENTS.md` · durable owner decisions #266 · [whole-app evidence matrix](./WHOLE_APP_AUDIT_649_EVIDENCE.md) · previous [consolidated audit from #646](https://github.com/MariosGiannakaras/MyFinHub/blob/fix/646-audit-v21-first-batch/docs/audits/CONSOLIDATED_AUDIT_20261029.md).

**Planning state: Implementations 0/23 completed · Sub-implementations 1/132 completed (I18.01 source code and focused regression guard on #652 branch; validation pending).** These are **proposed code/contract/QA-tool implementation packages**, not 132 proven defects or 132 independent PRs. A candidate failing reproduction can be retired/replaced explicitly before implementation, with the plan denominator updated. Count completion only when scoped code/config and a relevant reviewed regression guard exist. Do **not** count screenshots/CI/merge/deploy as code work.

## Scope and source of truth
- Scope **only** `MariosGiannakaras/MyFinHub`: web, API, Supabase contract and Windows/desktop. Android code is strictly excluded.
- Snapshot: `develop@18e925b3dfbc81ab82099f1351a2d25b19845a3d` as integration base; audited exact UI head PR #647 `1814d72bfa3d6aa151a7a50a43feee80d6a8ba16` (full mandatory [CI #40921547456](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40921547456) **SUCCESS**, PR not merged at audit intake); `main@78325762d564d0aa04cc576d04e1f22b5c8d2871` is separate production/release. Draft #645 owns v1.7.1 auth production promotion. Separate #648 owns Transactions EOD labeling and lending cash signs (`cd433580d68fd1c948714dc3c088b41fdb777ef5`), currently 1/2 implementations and 2/3 sub-implementations code-complete on its own plan.
- Source reviewed: all 12 route JSX owners, 7 Settings tabs, AppShell/App, 17 representative complex interactions, finance selectors, auth/API, desktop-related source, prior #616/#630/#646, 24 exact-head full-page desktop+mobile renders and 32 representative other generated states; 786 image entries exist in final visual artifact, **not** all individually inspected at native resolution. Completed automated CI is an important *positive baseline*, not proof that every workflow/negative state has been exercised.
- **Evidence disposition:** **A** confirmed source/runtime failure or semantic contradiction; **B** candidate from screenshot/code requiring controlled reproduction; **C** owner-dependent UX choice; **D** already correct/accepted invariant; **S** cross-store/security/recovery risk requiring targeted evidence, not presumed exploit. Do not mutate to resolve B/C/S without first proving necessity and preserving constraints.
- Preserve finance event/leg engine, historic edits, RLS, single-owner+AAL2, save receipts, backup/audit, card vault boundaries and non-destructive storage. Do not add destructive migrations or production restores without explicit owner approval.

## Sequencing and scope ownership
| Phase | Focus | Rules |
|---|---|---|
| **Gate 0** | Integrate already accepted #647 into develop only after direct final screenshot/diff review; reconcile #648 on current develop | *Excluded* from new 0/23 plan counters; never lose concurrent changes |
| **P0 domain/recovery** | I03, I05, I10, I11, I18, I19, I22 | Independent bounded issues and finance/security negative-path tests; high-risk gates before adjacent work |
| **P1 shared system** | I01–I02, I23 | Shared-first; prevent duplicated CSS and run sibling theme/control blast-radius |
| **P1 route semantics** | I04–I14 | Coherent route groups after shared owner stabilizes; focused rendered Desktop/Tablet/Mobile |
| **P1 Settings/overlays** | I15–I17, I20–I21 | Complete 7 tabs, all dialogs/Windows contracts and relevant dark/light/error states |
| **Integration** | Final coherent review heads then develop; separate validated develop→main release | No merge while required gates pending/failing; no implicit production deploy |

This ordering is a **dependency graph**, not a request to start all 23 branches. Security/database/migration/backup boundaries get intermediate gates where unsafe to proceed otherwise.

## Code work packages and explicit sub-implementations

### I01. Shared AppShell, navigation and routing — 0/6

**Priority:** P1 · **Owner:** `AppShell, routing, period controls, command entry` · **Dependencies:** none

- [ ] **I01.01** Align sidebar/More-menu, route titles, current-route highlight and Greek labels across desktop/tablet/mobile without changing canonical route IDs.
- [ ] **I01.02** Verify global period-navigation availability and actual active period after route switch; standardize contextual month/as-of semantics where wrong.
- [ ] **I01.03** Give global search, history, refresh and notification popovers anchored flip/edge containment and keyboard/focus return; reproduce historical G-01 tooltip overlap.
- [ ] **I01.04** Audit route loading, lazy-import failure, unknown hash, route recovery and changed-route focus; preserve recoverable PageErrorBoundary.
- [ ] **I01.05** Reconcile persistent shell privacy visibility and route-scoped money screens against an explicitly approved scope; document nonpersistent reset/no accidental reveal.
- [ ] **I01.06** Guard mobile bottom bar/More-menu, safe areas, 200% zoom, text scaling, route transitions and overlay z-index as one shell contract.

### I02. Shared visual system, typography and semantic controls — 0/6

**Priority:** P1 · **Owner:** `src/lib/theme.ts, Surface/Button/Input, root-compat.css and tokens` · **Dependencies:** after #647 visual baseline

- [ ] **I02.01** Inventory 80+ ordered CSS compatibility imports and effective selector/token ownership; consolidate repeated root causes rather than adding narrow override chains.
- [ ] **I02.02** Normalize default buttons, selects, money/date inputs, autocomplete and validation/focus states by shared role across login, editors, settings and Quick Entry.
- [ ] **I02.03** Ensure destructive action tokens survive primary accent rules in standard and confirm surfaces; regress exact #646 T-03 fix.
- [ ] **I02.04** Resolve dense Greek typography/minimum readable sizes, truncation/overflow-wrap rules and number tabular alignment at 320/375/390/768/1440/2560.
- [ ] **I02.05** Audit dark/light/forced high-contrast + reduced-motion + browser autofill states and accessible semantic positive/negative/warning contrast.
- [ ] **I02.06** Replace risky `nth-of-type`/DOM-index and ad hoc width assumptions with explicit component/variant semantics, backed by bounded sibling tests.

### I03. Login, TOTP, sessions and authentication recovery — 0/6

**Priority:** P0 · **Owner:** `LoginScreen, MfaScreen, server/auth, API/session guard` · **Dependencies:** independent release #645 login fix; owner/AAL2 invariants

- [ ] **I03.01** Reconcile current Login error state with #641/#645 and validate failed credential, offline, server-unavailable and retry in all viewports/themes.
- [ ] **I03.02** Cover TOTP enrollment, challenge, invalid/expired OTP, auto-verify, factor reset and back navigation; never introduce an MFA bypass.
- [ ] **I03.03** Verify session-expiry and AAL2 downgrade from active pages, stale cookies/bearer provenance, failed refresh and recoverable focus without leaking finance data.
- [ ] **I03.04** Recheck API owner-UID and AAL2 denial paths for login-adjacent/profile/vault/finance requests, SameSite/Origin and cookie vs bearer behavior.
- [ ] **I03.05** Confirm accessibility of labels, OTP digit entry, paste/keyboard, live error announcements, 200% zoom and mobile dark mode.
- [ ] **I03.06** Preserve and regression-lock app-lock PIN and active-device session revocation interaction and timing without asserting device identity data not available.

### I04. Dashboard / Επισκόπηση — 0/5

**Priority:** P1 · **Owner:** `DashboardPage.tsx, DashboardRecharts, dashboard selectors` · **Dependencies:** #647 before modification; #648 owns cash sign

- [ ] **I04.01** Reconcile Dashboard lending/repayment cash signs with #648 after it owns the head; preserve receivable/operational-income separation.
- [ ] **I04.02** Guard hidden/revealed money and charts across account cards, summary, categories, recent movements, secondary balances and tooltips; privacy scope requires owner contract.
- [ ] **I04.03** Confirm account hierarchy, IBAN absence, account chart historic/future dates, first-/last-month balance provenance and large-number stress.
- [ ] **I04.04** Improve EOD vs event contextual labels and comparison percent-zero-basis explanation without changing canonical finance computations.
- [ ] **I04.05** Resolve duplicate recurring/exposure labels and verify footer security/encryption claims against actual scoped guarantees before copy changes.

### I05. Transactions / Συναλλαγές — 0/6

**Priority:** P0 · **Owner:** `TransactionsPage, selector, ledger and legacy adapter` · **Dependencies:** #648 owns EOD/sign work; full per-event balance separate

- [ ] **I05.01** Integrate #648 truthful end-of-day balance labeling, first-account provenance and ± lending cash direction; preserve existing merged logic.
- [ ] **I05.02** Design canonical per-event account running-balance contract only with deterministic same-day ordering, snapshots, legacy overrides, transfers and account-leg reconciliation tests.
- [ ] **I05.03** Correct 200%/mobile/tablet ledger geometry, selected-detail panel width, long Greek notes, dates and keyboard selectable rows without hiding actions.
- [ ] **I05.04** Reproduce full-page QA screenshot showing only ~2 visually painted rows despite '20 of 68'; distinguish animation capture timing from actual rendering/infinite scroll fault, then lock stable capture.
- [ ] **I05.05** Recheck filtering/sorting/date range/pagination/export, accurate counts, empty/no-results states, and shortcut/deep focus for exact event.
- [ ] **I05.06** Exercise edit/delete/undo/receipt/recurring linkage/correction conflict and native/legacy semantic preservation, with durable receipt and failure UI.

### I06. Savings / Αποταμίευση — 0/5

**Priority:** P1 · **Owner:** `SavingsPage, goal projections, domain savings` · **Dependencies:** #646 S-03 completed

- [ ] **I06.01** Align savings header/action/content widths across large desktop and mobile; preserve shared Surface grid ownership.
- [ ] **I06.02** Correct chart tick precision and repeated labels for low ranges without synthetic maximum or manipulating underlying balances.
- [ ] **I06.03** Explicitly distinguish monthly savings flow, common cash pool, per-goal target and nonreserved goals; verify #646 S-03 remains intact.
- [ ] **I06.04** Reproduce and guard saving transfer, manual cash offset, HELP/RETURN and goal allocation with linked-account selection and no double posting.
- [ ] **I06.05** Test goal create/edit/delete/over-target, date/deadline, future events, conflict, autosave receipt, empty/large-state and dark/light.

### I07. Debit and prepaid Cards / Κάρτες — 0/5

**Priority:** P1 · **Owner:** `CardsPage, CardCreateDialog, CardDetailsDialog, bank visuals` · **Dependencies:** no Android repo change

- [ ] **I07.01** Reconcile card header/recent activity panel widths and large desktop whitespace without implying debit card owns a separate ledger.
- [ ] **I07.02** Verify exact 16-digit PAN 4×4 input, expiry/CVV, credential reveal/hide, clipboard state, and zero layout shift at 320/375/1440.
- [ ] **I07.03** Review card stack, archive/recovery/hard-delete settled-state requirements, close focus, keyboard/drag interactions and responsive action affordances.
- [ ] **I07.04** Validate linked-account transaction provenance: repeated merchant charges remain separate account ledger events, no fabricated card transaction grouping.
- [ ] **I07.05** Guard vault receipt, encrypted secret exclusion from ordinary FinanceData, reveal after reload, partial save/upload failure, cleanup/retry and privacy.

### I08. Credit cards / Πιστωτική — 0/6

**Priority:** P1 · **Owner:** `CreditCardPage, credit statement selectors, secure card UI` · **Dependencies:** #647 A-02 verified

- [ ] **I08.01** Reconcile individual selected-card limit vs aggregated portfolio limits/debt/available credit in every card, report and statement.
- [ ] **I08.02** Reproduce Greek nickname/glyph clipping at exact 320/375/1440/2560 and computed font; preserve real on-card edit WYSIWYG geometry.
- [ ] **I08.03** Add discoverable clickable card stack indicators if compatible with existing drag, touch and ArrowUp/ArrowDown keyboard behavior; focus state and reduced motion.
- [ ] **I08.04** Localize statement/order terms accurately (κατάσταση λογαριασμού), verify dense header/progression and mobile long-page section navigation.
- [ ] **I08.05** Retest purchase/spending, card-payment non-spending, multi-source payment, due-cycle, interest, overlimit, historic as-of and unposted future state.
- [ ] **I08.06** Verify archive only when settled, debt tombstone invariant, delete confirmation, card vault secret isolation, negative paths, real save receipt.

### I09. Loans and installments / Δόσεις & Δάνεια — 0/5

**Priority:** P1 · **Owner:** `LoansPage, loan lifecycle and linked payments` · **Dependencies:** canonical Loans domain remains owner

- [ ] **I09.01** Reconcile full-width panels/embedded rows for 1440/1920/2560 and compact mobile without moving ownership of payment actions.
- [ ] **I09.02** Clarify installment number vs actual payment date/elapsed status and support historical/future as-of without fabricated due dates.
- [ ] **I09.03** Verify exact installment coverage, partial/full payments, duplicate prevention, loan-specific payoff, end-of-term and forgiven status.
- [ ] **I09.04** Test linkage from Recurring and Attention to canonical loan and deep-focus, without creating duplicate active recurring loan obligations.
- [ ] **I09.05** Render-check loading/empty/completed long lists, 320/375 dark/light, keyboard and ownership of confirmation/notification.

### I10. Lending and receivables / Δανεικά-Οφειλές — 0/5

**Priority:** P0 · **Owner:** `LendingPage, receivable selector and settlement dialog` · **Dependencies:** #648 Dashboard cash sign overlap

- [ ] **I10.01** Align master/list/detail/summary widths and selected person focus across desktop/tablet/mobile without nested clipping.
- [ ] **I10.02** Reconcile receivable positive asset vs account cash −/+ movements; preserve non-operational income/expense semantics.
- [ ] **I10.03** Verify writeoff vs archive vs deletion confirmation copy and only allowed neutral-tombstone/history-preserving operations.
- [ ] **I10.04** Exercise partial/multiple repayments, historic as-of, future-dated event exclusion, overpayment guards and custom person mapping.
- [ ] **I10.05** Guard masked/unmasked receivables across summary and details, date/amount formatting, failure/conflict/pending receipts.

### I11. Recurring subscriptions and obligations / Πάγια — 0/6

**Priority:** P0 · **Owner:** `RecurringPage, recurrenceCadence, Attention selector, forecast` · **Dependencies:** #646 overdue-display done; forecast approval gated

- [ ] **I11.01** Preserve shared canonical `recurringDue` current/overdue state and separate `nextRecurringDate` future schedule, with explicit time reference in UI.
- [ ] **I11.02** Define unpaid past-cycle forecast policy via approved booked/due/estimated distinction; guard no double counting across 1/2/12/24-month cadences.
- [ ] **I11.03** Retest early/partial/duplicate payments, pause/stop/resume, day-end/Feb/annual rollover and linked canonical Loans payment.
- [ ] **I11.04** Clarify variable amount estimate vs actual recorded amount; align due-state primary/secondary CTA hierarchy after visual/product review.
- [ ] **I11.05** Check provider logos/branding partial upload failure, mobile/dark long names, event origin and retry/conflict feedback.
- [ ] **I11.06** Protect historical legacy identity and lifetime purchases from forced monthly recurring reclassification.

### I12. Planning and future cashflow / Προγραμματισμός — 0/5

**Priority:** P1 · **Owner:** `PlanningPage, scheduled cashflow, forecast components` · **Dependencies:** #647 P-02/P-03 complete

- [ ] **I12.01** Reconcile nested pending-list scroll/last-row reachability, keyboard wheel/trackpad and 320/mobile long-viewport accessibility.
- [ ] **I12.02** Keep current portfolio visible and flat sparklines centered as fixed #646, with true forecast vs booked value provenance.
- [ ] **I12.03** Distinguish scheduled/estimated/due/actually posted transactions in labels, chart legend, tooltip and date resolution.
- [ ] **I12.04** Test create/edit/skip/cancel/complete/failure/undo scheduled events with exact one logical posting, negative scenarios and conflict receipts.
- [ ] **I12.05** Verify multi-account cash projections, large dates/amounts, expected negative balances and history comparison without double posting.

### I13. Attention center / Έλεγχος — 0/5

**Priority:** P1 · **Owner:** `AttentionPage, action contracts and canonical due selectors` · **Dependencies:** #647 E-02/E-03 complete

- [ ] **I13.01** Recheck urgent count/icon/copy semantic correctness and group hierarchy in the last full-page 375×2495 capture.
- [ ] **I13.02** Audit per-alert source links and exact destination/focus for loan, recurring, scheduled, budget, credit and legacy review actions.
- [ ] **I13.03** Verify global in-session privacy, amount masking, switching surfaces and no persistence of private visibility.
- [ ] **I13.04** Review false urgency/due classifications, keep/reject semantics, source provenance and no automatic finance mutation from advisory review.
- [ ] **I13.05** Normalize dense action-button styles, long lists and actionable error/empty states with focus/keyboard/reduced motion.

### I14. Reports, budgets and rules / Αναφορές — 0/6

**Priority:** P1 · **Owner:** `ReportsPage, report selectors, budget and rule editors` · **Dependencies:** #647 A-01/02/03/04 complete

- [ ] **I14.01** Guard account/report as-of period boundaries, current vs historical upcoming obligations, and percentages el-GR without runtime transposition.
- [ ] **I14.02** Render-check nested single-credit-summary full-width card vs global operations grid; examine Reports screenshot with empty-looking credit-analysis panel before declaring bug.
- [ ] **I14.03** Clarify positive-only account distribution vs whole-account net worth, aggregate vs selected-card denominator and budget source provenance.
- [ ] **I14.04** Audit category/counterparty entry wrapping, stable category colors/icons, legend/ticks across empty/large/negative/zero-value datasets.
- [ ] **I14.05** Recheck budget create/edit/delete/rule priority/rollover, canceled/pending receipts, conflict, shortcuts, keyboard and deep links.
- [ ] **I14.06** Review 375×4259 mobile long scroll, section anchor visibility, sticky controls, dark theme and horizontal overflow with stress fixtures.

### I15. Settings — General, Profile and Readability — 0/5

**Priority:** P1 · **Owner:** `SettingsPage tabs general/profile, AccountSecuritySettings` · **Dependencies:** release #645 auth errors separate

- [ ] **I15.01** Audit General vs Profile information hierarchy to remove redundant platform metadata without hiding support/diagnostics.
- [ ] **I15.02** Review settings tabs as tabs (selection/arrow navigation/activation/focus) on 320/375/768/desktop including deep-linked active tab.
- [ ] **I15.03** Validate readability/theme preference persistence, large text, reduced motion, focus contrast and browser/native accessibility.
- [ ] **I15.04** Recheck profile email/owner session and security actions against actual supported backend calls; no fictitious device activity metadata.
- [ ] **I15.05** Verify messages/copy in Greek, timestamps, login/session failure instructions and no unsupported claims about encryption/recovery.

### I16. Settings — Accounts and Financial Providers — 0/6

**Priority:** P1 · **Owner:** `AccountManagementSettings, FinancialProviderManagementSettings` · **Dependencies:** #647 ST-03 complete

- [ ] **I16.01** Preserve fixed provider summary spacing/technical ID only in edit field; guard long Greek names and heading alignment.
- [ ] **I16.02** Verify account create/edit/default/reorder/deactivate/delete eligibility and exact dependency blockers without changing historical references.
- [ ] **I16.03** Check IBAN data provenance/secure store, missing account details, owner+AAL2 server validation, clipboard and masked display where contracted.
- [ ] **I16.04** Test bankmark/logo chooser upload/replacement/delete/partial success with rollback and no orphan secrets or storage assets.
- [ ] **I16.05** Cover account/provider modal focus, keyboard search, 320/375 mobile panels, long form errors and receipt-driven status.
- [ ] **I16.06** Keep one coherent account/provider component ownership model and avoid per-page duplicate dropdown/action styling.

### I17. Settings — Categories, Icons and Automation Rules — 0/6

**Priority:** P1 · **Owner:** `CategoryIconsWorkspace, taxonomy and BudgetRuleSettings` · **Dependencies:** live approved 20/6+71; no mass overwrite

- [ ] **I17.01** Inventory exact approved 20 expense +6 income/71 subcategories and aliases from current source; guard counts and no silent legacy rewrite.
- [ ] **I17.02** Review taxonomy editor density: progressive disclosure and grouped actions that preserve all existing subcategory controls and keyboard access.
- [ ] **I17.03** Compute actual icon-resolution coverage per pack and user preference; distinguish missing direct mapping from runtime missing icon before patch.
- [ ] **I17.04** Test approved taxonomy changes, category retirement/dependency blockers, history-safe references and protected finance revisions.
- [ ] **I17.05** Check rule priorities, edit/reorder/disable conflict, pending/rejected receipts and deep-link-to-editor from reports/command palette.
- [ ] **I17.06** Guard mobile/dark icon picker previews, input ARIA, Greek hierarchy and category labels with stress content.

### I18. Settings — Data, backup, restore and device security — 1/6

**Priority:** P0 · **Owner:** `Settings data/import, DesktopBackupPanel, DeviceAccessSettings` · **Dependencies:** #646 X-01/X-06/X-07 review; destructive restore approval

- [x] **I18.01** Make in-app FinanceData JSON backup coverage explicit: vault/card secrets, IBAN, provider logos/storage, local receipts and device/PIN are excluded where true.
- [ ] **I18.02** Design and verify independently restorable non-destructive PostgreSQL+Storage checkpoint procedure; do not run production restore or overwrite without explicit approval.
- [ ] **I18.03** Recheck backup freshness/status by revision and timestamp, invalid/corrupt archive, retention/history boundaries, device-specific desktop backup path.
- [ ] **I18.04** Test import preview/size validation, pre-import backup/confirmation, conflict and interrupted partial failure; no destructive migration or silent real-data replacement.
- [ ] **I18.05** Verify device session list, revocation denial paths, stale access, active owner+AAL2 authorization and red failure vs genuine green save receipt.
- [ ] **I18.06** Run desktop backup panel empty/restore/failure/retry/light/dark/mobile accessibility with no physical device gate.

### I19. Quick Entry, payments, local receipts and spending capture — 0/7

**Priority:** P0 · **Owner:** `QuickAdd, ContextualQuickAdd, ReceiptAwareQuickAdd, payment flows` · **Dependencies:** cross-store partial writes and domain posting

- [ ] **I19.01** Audit all create/edit transaction types and actual account/source-target-result editors via shared MoneyInput/Category/Date and keyboard/validation.
- [ ] **I19.02** Guarantee each payment posts exactly one canonical logical event and correct ledger legs across credit, loans, lending, recurring and savings.
- [ ] **I19.03** Verify receipts remain local/authorized, filename/image restrictions, OCR limitations, mapping, ambiguous matches, duplicate imports and no exfiltration.
- [ ] **I19.04** Test independent asset upload/metadata and finance revision partial-success states, cleanup, retry/idempotency and conflict feedback.
- [ ] **I19.05** Recheck Quick Entry discard/dirty close, confirmation, focused error, pending mutation disabled fields, undo and no false success.
- [ ] **I19.06** Guard legacy transaction reclassification/splits/Pay&Save/IRIS semantics and taxonomic owner-approved aliases without inference from note alone.
- [ ] **I19.07** Inspect responsive desktop/tablet/mobile dialogs, dark/light, offline, long labels, keyboard and text-size effects.

### I20. Shared dialogs, History, Command Palette and confirmations — 0/6

**Priority:** P1 · **Owner:** `DialogShell, ConfirmDialog, HistoryDialog, CommandPalette` · **Dependencies:** shared-system changes require sibling sweep

- [ ] **I20.01** Review DialogShell focus trap, dialog labels, Escape, nested confirm, inert background and focus restore under route/scroll changes.
- [ ] **I20.02** Audit shared confirmation danger/destructive/undo copy and cancel paths; do not confuse archive vs permanent writeoff/delete.
- [ ] **I20.03** Verify command palette search exact entity ranking and destination focus for transactions, persons, credit, recurring, budgets and schedules.
- [ ] **I20.04** Audit History time travel, undo/redo, conflict/restore/partial write, crossed branches and provenance without silently rewinding immutable ledger.
- [ ] **I20.05** Reproduce tooltips/popovers/overflow at topbar and bottom sheet, anchored flipping and reduced motion, with shared regression geometry.
- [ ] **I20.06** Exercise copied sensitive value, clipboard fallback, live status/error role, text truncation and mobile reduced-viewport dialogs.

### I21. Windows desktop-only shell, updates and app lock — 0/5

**Priority:** P1 · **Owner:** `Windows/Electron titlebar, loopback, app lock, updater, backup` · **Dependencies:** never require physical hardware as baseline

- [ ] **I21.01** Validate installed-user launch/first run/loopback without runtime configuration prompts or packaging secret credentials.
- [ ] **I21.02** Audit app-owned PIN lock/recovery/rate limit, owner+AAL2 session timing, lock-after-idle and foreground/background visibility.
- [ ] **I21.03** Recheck desktop titlebar, updates, tray/minimize/close navigation, zoom/keyboard/dark/light and error-recovery affordances.
- [ ] **I21.04** Verify desktop backup/restore native file semantics, safe file picker/permission denied, no partial restore and exact user-visible scope.
- [ ] **I21.05** Inspect automated Windows installer/lifecycle/rendered QA artifacts on final review head and preserve installer-size/security limits.

### I22. Finance/API/Supabase authorization and multi-store correctness — 0/7

**Priority:** P0 · **Owner:** `canonical domain, API, migrations, RLS, storage and vault` · **Dependencies:** reviewed migrations only; never direct prod DML

- [ ] **I22.01** Add read-only financial reconciliation fixtures for events/legs/account references, same-date running values, historical snapshots, refunds, savings and cash sign parity.
- [ ] **I22.02** Exercise owner UID+AAL2 and provenance failure paths on each finance/metadata/RPC/storage/vault endpoint; keep public client key separate from offline admin secrets.
- [ ] **I22.03** Review three app-lock SECURITY DEFINER RPC grants and private RLS performance WARNs with negative-path tests; do not widen policies to silence advisors.
- [ ] **I22.04** Review leaked-password protection security advice against supported Supabase auth settings and risk; apply config only through approved secure change.
- [ ] **I22.05** Guard revision conflicts, FIFO mutation acknowledgements, backup/history revision consistency and ancillary-vault/storage partial success without false-green save state.
- [ ] **I22.06** Test material financial definitions: booked vs due vs estimated, receivable vs cash, credit purchase vs payment and positive-only distribution vs net worth.
- [ ] **I22.07** Establish sensitive-data/redaction invariants for diagnostics, screenshots, browser console, Windows logs and app memory while testing recovery.

### I23. Cross-app rendered QA, accessibility, performance and regression tooling — 0/7

**Priority:** P1 · **Owner:** `scripts/run-rendered-qa, visual-evidence, defect intelligence` · **Dependencies:** on last coherent batch only

- [ ] **I23.01** Fix visual evidence capture stability: Transactions staggered enter/virtual rows, Dashboard deferred charts, fonts/images/layout ready before full-page screenshot.
- [ ] **I23.02** Build a durable interface-state coverage manifest covering 12 routes × breakpoints/themes plus 7 settings tabs, auth, modals, error/empty/loading/conflict/offline.
- [ ] **I23.03** Expand meaningful regression locks for focus, aria-live, keyboard, 200% zoom, responsive overflow, hover/focus/danger, reduced motion and long Greek labels.
- [ ] **I23.04** Add selective visual geometry/data provenance fixtures rather than screenshot-pixel overrides, and document confirmed defect classes in quality/defect-patterns.json.
- [ ] **I23.05** Retain exact-page source tests and narrow browser preflight for changes; run complete rendered + WebKit + Lighthouse + Windows matrix only on final coherent Ready heads.
- [ ] **I23.06** Audit bundle budgets, loading skeleton shift, large-data route responsiveness and accessibility contrasts without weakening thresholds.
- [ ] **I23.07** Ensure immutable artifact provenance (head SHA, QA fixture, date, viewport, theme, privacy state) and direct assistant inspection before accepting UI changes.

## Evidence and release acceptance — separate from code implementation counters
1. **Baseline/ownership:** read latest `AGENTS.md`, #266, task issue/branch plan, live open PRs, current develop and relevant changed files before each batch. Prefer the latest branch plan over summaries.
2. **Defect class and state model:** for each item record A/B/C/D/S classification, reproducible fixture, source ownership, sibling blast radius, related existing guard, intended acceptance and exceptions. If unsupported, mark **REJECTED/no patch**, revise denominator and rationale; do not distort implementation completion.
3. **Narrow preflight:** relevant Vitest/domain/source/TS/build, `npm run defects:preflight` if executable, exact failing breakpoint and representative sibling states. No budget, accessibility, bundle or test weakening.
4. **Rendered acceptance:** inspect generated Chromium and WebKit desktop/tablet/mobile evidence for modified state(s), Light/Dark and relevant empty/populated/large/error/conflict/keyboard/zoom/reduced-motion dimensions. Capture actual page after visual steady state; do not accept a screenshot showing not-yet-painted rows as a content defect or as a normal state.
5. **Financial/security acceptance:** test positive/negative owner+AAL2, finance event legs/revision/history, partial backend success, account/date/report semantics and backup exclusions whenever touched.
6. **Final gates:** run full required CI, CodeQL, rendered/browser/accessibility, Lighthouse, installer/Windows, DB/security/release gates at each final coherent review head; observe actual check conclusion and inspect artifacts. Optional final 216-image acceptance is only invoked after normal gates and focused surfaces pass.
7. **Integration:** merge to `develop` only with clean protected required gates and no unresolved review comments; update issue/PR/plan and audited final merge SHA. `main` is production-only through separately approved release PR and observed Vercel production smoke, not a side effect of this plan.
8. **Manual review definition:** direct assistant inspection of generated browser/CI screenshots/logs/artifacts. No physical Windows hardware requirement unless explicitly asked.
9. **Backup/security boundary:** obtain non-destructive independent recovery evidence; *do not* reset/restore the live production DB, delete files, import history, rotate secrets or modify Supabase policies without an explicitly reviewed and approved path.
10. **Progress template, required on all substantive updates:** `Implementations X/23 completed · Sub-implementations A/132 completed`, then independent **Validation/CI**, **Integration/merge**, **Production/release** sections. Keep #647 and #648 counters separate; do not call this audit plan completed remediation.

## Audit closeout and immediate next safe action
- This branch intentionally stores a **plan and evidence matrix only**; no product source code changed, no Android/production/DB mutation.
- **First:** complete and directly inspect PR #647's last 24 route screenshots and exact-head diff, verify all required checks `SUCCESS` and protected-merge conditions; reconcile only accepted delta into develop. This gate is owned by #646 and is not counted as I01 or a new #649 fix.
- **Second:** rebase/reconcile #648 onto new develop and complete Dashboard cash-sign subitem without touching separate Android work; its own progress remains 1/2 and 2/3 until implemented.
- **Third:** start the highest-priority unblocked P0 issue from this map with one coherent owned batch. If recovery capability needs external destructive approval, do not block safe read-only/a11y/layout investigations; document that exact blocker.

## First implementation checkpoint — 2026-10-29 (#649 I18.01)
- Gate 0: #647 PR merged to `develop@f10b963f650a5b9c185512986d62d572c7ef4420` after exact [CI #40921547456](https://github.com/MariosGiannakaras/MyFinHub/actions/runs/40921547456) SUCCESS and direct 24-route screenshot inspection. This accepted earlier work remains excluded from the new 132.
- Previous finance UX #648 reconciled onto current develop, **2/2 implementations · 3/3 sub-implementations code complete**, [draft PR #651](https://github.com/MariosGiannakaras/MyFinHub/pull/651) at `deca7e588e5467abc5b4910f0f760fc890cc5649`. Draft CI pending at initial checkpoint; no merge.
- **I18.01 complete as code** on `fix/652-financedata-backup-scope-copy@c8b64ccc292a3550c4a8b648c6c80d773a5e3fbf` in [draft PR #653](https://github.com/MariosGiannakaras/MyFinHub/pull/653): corrected Settings Data backup/import/JSON copy explicitly excludes Card Vault/IBAN/Storage/local receipts/PIN and distinguishes the finance JSON from full PostgreSQL+Storage restoration. Added focused source guard. No backend/data mutation. **Implementation counters: 0/23 · 1/132, I18 = 1/6.** Validation/CI and integration are separate and pending.
- I18.02 independent full DB+Storage restore test still **not proven**, and is not implicitly authorized by UI copy work. No production DB restore, destructive migration or release.
- **Next safe action:** inspect draft CI/CodeQL for #651 and #653, correct any failures in bounded batches, use one final Ready QA matrix per coherent head, inspect real browser screens. Do not merge pending/failed checks. When both independently pass, merge to develop in safe order, reconcile this docs PR #650 with the updated develop head, and continue the highest-priority P0 subitem.
