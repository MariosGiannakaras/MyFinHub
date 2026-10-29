# #649 — Phase 1/2 bulk, cross-application audit and triage

**Current phase:** 1/2 AUDIT; **fully accepted area closeouts 0/23**, with previous broad source inventory and selected direct screenshots. **Phase 2 code:** Implementations **0/23 completed · Sub-implementations 1/132 completed** (pre-existing #652 only, staged). No new product code or production mutation while this registry remains open.

## QA archive provenance (real head evidence, not exhaustive manually accepted UI)
Full CI #40921547456 SUCCESS (PR #647, before merge into develop), artifact 12920225365: **736 PNG in 45 categories; 49 suite JSON (712 registered suite captures) + full-page manifest (24 captures) = 50 JSON**. The 24 full-page captures reside in the same route-named category folders as suite captures, explaining why the category totals below equal 736. Current personal inspection: all 24 page captures as contact sheets, native Dashboard/Transactions/Reports, representative nondefault screens and WebKit Reports; other captures should be reviewed by unique state and risk before acceptance, not claimed individually inspected.

| QA folder | PNG | QA folder | PNG |
|---|---:|---|---:|
| `app-shell` | 128 | `theme` | 71 |
| `cross-page-motion` | 48 | `budgets` | 47 |
| `settings` | 46 | `functional-flows` | 24 |
| `credit` | 22 | `command-palette` | 20 |
| `transactions` | 19 | `planning` | 18 |
| `receipts` | 18 | `cards` | 17 |
| `core-flows` | 15 | `desktop-host` | 15 |
| `lending` | 14 | `dashboard` | 13 |
| `persistence` | 13 | `recurring` | 13 |
| `settings-provider-branding` | 13 | `settings-desktop-backup` | 12 |
| `branding` | 11 | `quick-entry` | 10 |
| `action-center` | 9 | `obligations` | 9 |
| `reports` | 9 | `icons` | 8 |
| `savings` | 8 | `loans` | 7 |
| `payments` | 7 | `recurring-branding` | 7 |
| `controls` | 6 | `large-data` | 6 |
| `ledger` | 6 | `recovery` | 6 |
| `runtime` | 6 | `taxonomy` | 6 |
| `accounts` | 5 | `categories` | 5 |
| `accessibility` | 4 | `auth-session` | 3 |
| `card-vault` | 3 | `desktop-titlebar` | 3 |
| `attention` | 2 | `not-found` | 2 |
| `validation-errors` | 2 | — | — |

## 23 area audit gates (only mark [x] after evidence + shared-owner + negative-state review)
- [ ] **I01 — Shared AppShell, navigation and routing**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I02 — Shared visual system, typography and semantic controls**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I03 — Login, TOTP, sessions and authentication recovery**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I04 — Dashboard / Επισκόπηση**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I05 — Transactions / Συναλλαγές**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I06 — Savings / Αποταμίευση**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I07 — Debit and prepaid Cards / Κάρτες**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I08 — Credit cards / Πιστωτική**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I09 — Loans and installments / Δόσεις & Δάνεια**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I10 — Lending and receivables / Δανεικά-Οφειλές**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I11 — Recurring subscriptions and obligations / Πάγια**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I12 — Planning and future cashflow / Προγραμματισμός**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I13 — Attention center / Έλεγχος**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I14 — Reports, budgets and rules / Αναφορές**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I15 — Settings — General, Profile and Readability**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I16 — Settings — Accounts and Financial Providers**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I17 — Settings — Categories, Icons and Automation Rules**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I18 — Settings — Data, backup, restore and device security**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I19 — Quick Entry, payments, local receipts and spending capture**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I20 — Shared dialogs, History, Command Palette and confirmations**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I21 — Windows desktop-only shell, updates and app lock**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I22 — Finance/API/Supabase authorization and multi-store correctness**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.
- [ ] **I23 — Cross-app rendered QA, accessibility, performance and regression tooling**: cross-check current source, all relevant suite screenshot states/metadata and finance/auth semantics against original #646, new #649 evidence and active branches; classify proven defect / reproduction-needed / UX decision / already-correct / safety gap; identify root owning layer, sibling consumers, priority, acceptance test and no-fix decision where applicable.

## Specific pending reproductions and release/safety invariants
1. **Transactions:** visual capture 2 painted rows versus 20 count; verify DOM rows, content-entrance animation and screenshot timing before claiming data loss.
2. **Reports:** apparently empty credit-analysis subpanel; inspect sample data, privacy, DOM and cross-engine layout rather than guessing.
3. **Ledger:** end-of-day row balance label is staged in #648; per-event running balance requires canonical legacy/snapshot/leg ordering proof, not a sort by timestamp or tx ID.
4. **Lending/recurring:** cash receivable sign versus operational flow, overdue missed cycle versus future next occurrence, no duplicate postings.
5. **Recovery:** distinguish local FinanceData JSON from full PostgreSQL+Storage restore and attest independent reversible recovery without touching production.
6. **Auth/security:** negative owner+AAL2, app PIN, RPC/RLS, vault/metadata partial success; warnings are leads, not proven vulnerabilities.
7. **UI system:** account/credit/savings card widths, Settings seven tabs, Greek dense text, theme/focus, all dialog states and actual 320/375/390/768/1440/2560 breakpoints; don't introduce arbitrary CSS rules from an old screenshot.

## Exit gate before Phase 2/2
- All 23 rows triaged/accepted, with exact evidence reference (source SHA, suite screen or test) and any unverifiable/owner-dependent case explicitly parked or rejected.
- One deduplicated, ordered patch list grouped by common owning primitives, finance/security boundaries and responsive blast radius, not one PR per screenshot.
- Update 23/132 planned denominators **once**, only if rigorous triage adds/removes supported work; preserve already completed 1/132 and separate #648 3/3.
- Prepare minimal large-batch integration and targeted-check strategy; do **one full required gate** at the final review head of each large coherent batch, with interim high-risk gates only where safe progress otherwise blocked.
- No production main merge or destructive DB/Storage restore, no Android changes. No full CI status can substitute for direct inspection of relevant generated artifacts.

**Exact next action:** continue bulk source/QA/domain triage across all 23 areas and record findings; preserve drafted #651/#653 without new small review cycles.