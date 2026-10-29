# MyFinHub — consolidated original + v2.1 + independent audit (2026-10-29)

> Audit register and evidence acceptance, not a blanket permission to patch. Covers v1.7.0 owner desktop screenshots, current develop and draft PR #647, current migrations/read-only Supabase metadata, issue #266 and prior read-only domain review #616/#617. Android separate. This register is **not** a rendered QA PASS.

## Evidence boundaries
- 20 owner screenshots from 2026-10-28, 19 unique: desktop/web, Light, compact density. They cannot prove current runtime state, causal CSS/computed style, dark/mobile/keyboard/accessibility or real database restore.
- Current integration develop at `18e925b3dfbc81ab82099f1351a2d25b19845a3d`; draft #647 had source fixes through `4cffa93f5876ae96a5ce7512cffdab23d0928f1c` at this audit checkpoint. Production main `78325762d564d0aa04cc576d04e1f22b5c8d2871` separately released.
- Existing UI remediations #503 and #630 completed historically, so these are current/new residual observations, not a restart of their completed checklists.
- Screenshot findings are candidate runtime evidence; code/DB checks below have separate scopes. Severity is **H/M/L**, not a claim about money loss.

## All 44 original audit IDs — reconciled disposition

| ID | Status | Severity | Grounded observation | Safe decision / acceptance |
|---|---|---|---|---|
| **G-01** | Επιβεβαιωμένο | M | Tooltip ιστορικού καλύπτει επάνω actions στα αρχικά screenshots | Μέτρηση bounding box και διορθωμένη θέση/flip σε top actions, focus/hover test |
| **G-02** | UX πρόταση | L | Ο Έλεγχος δεν εμφανίζει αριθμητικό badge στη sidebar | Να μη χρησιμοποιείται ανεξέλεγκτα ο πλήρης αριθμός για μόνιμο έντονο badge· απαιτείται owner visual choice |
| **G-03** | Μερικώς επιβεβαιωμένο | L | Αδέσποτη στίξη και ασυνέπεια shortcut περιόδου/notification | Inspect shared PeriodControl/AppShell πριν από αλλαγή, όχι επανεμφάνιση κρυμμένου εργαλείου αυθαίρετα |
| **G-04** | UX ασυνέπεια | L | Dashboard/Επισκόπηση και CSS route naming drift | Ενοποιημένη ορολογία χωρίς αλλαγή route identity |
| **D-01** | Επιβεβαιωμένο | H | Hide amounts προστατεύει λογαριασμούς, αλλά όχι ποσά σύνοψης/κατηγοριών/κινήσεων | Privacy-aware display όλων των ορατών EUR, charts χωρίς τιμές/tooltip όταν masked |
| **D-02** | Σωστή λειτουργία, UX πρόταση | L | Δεν έχει οριστεί αφορά πραγματικά ανύπαρκτο IBAN | Διατήρηση ακριβούς σημασιολογίας; προαιρετική βελτίωση disabled controls |
| **D-03** | Επιβεβαιωμένο σύμπτωμα / μη τεκμηριωμένη λύση | H | Lending movements ουδέτερα χωρίς ταμειακό − και same-day EOD repeated | Finance legs και deterministic per-event account balance, καμία ανακύκλωση receivable balance |
| **D-04** | Οπτικό χαμηλής προτεραιότητας | L | Πάγια επαναλαμβάνεται ως labels | Αποφυγή άσκοπης πληροφορίας στο Dashboard χωρίς αλλαγή grouping |
| **T-01** | Επιβεβαιωμένο, finance-sensitive | H | Transactions rowBalance=selectAccountBalances(data,row.date), δηλαδή τέλος ημέρας | Νέος canonical per-event selector με tests για same-day legs/transfers/legacy, όχι αυθαίρετη ταξινόμηση tx.id |
| **T-02** | Μερικώς επιβεβαιωμένο | M | Πολύ υψηλό ποσοστό μπορεί να είναι μαθηματικά αληθές αλλά μη ερμηνεύσιμο | Neutral basis-aware delta όταν διασχίζει μηδέν· όχι arbitrary percentage cap |
| **T-03** | Επιβεβαιωμένο | H | Theme important primary rule επικάλυπτε destructive variant | Shared destructive-specific override, διατήρηση solid confirm dialog και focus states |
| **T-04** | UX πρόταση | L | Επαναλήψεις δόσεων και τεχνική ορολογία | Label cleanup μόνο, όχι consolidation εγγραφών |
| **S-01** | Επιβεβαιωμένο geometry | M | Savings actions full width, κάτω ενότητες capped | Εναρμόνιση εσωτερικής στοίχισης χωρίς blanket global max-width |
| **S-02** | Επιβεβαιωμένο | M | 0€, 1€, 1€ επανάληψη σε tick labels λόγω rounding | Tick precision/spacing με αναλογικά συνεπή κλίμακα, όχι άσχετο max 100 |
| **S-03** | Επιβεβαιωμένο | H | Στήλη Κοινό υπόλοιπο εμφανίζει flow.saving σε μηνιαία γραμμή και savingsBalance σε στόχους | Διακριτή μηνιαία ροή και συνολικό αποθεματικό, χωρίς τροποποίηση ledger |
| **S-04** | UX πρόταση | L | Επαναλαμβανόμενη εξήγηση κοινής δεξαμενής στόχων | Συντομότερη εξήγηση χωρίς απόκρυψη σημαντικής non-reservation προειδοποίησης |
| **C-01** | Επιβεβαιωμένο geometry | M | Cards recent rows στενές μέσα σε πολύ πλατιά card | Align child width με header σε review viewport· preserve readable lines |
| **C-02** | Μερικώς, μη λογιστικό bug | M | Εμφανίζονται επαναλαμβανόμενες ίδιες δόσεις στο account feed | Η κάρτα debit είναι credential, όχι ξεχωριστό ledger· βελτίωση λογαριασμού/ημερομηνίας, όχι ψευδές card filtering |
| **CC-01** | Επιβεβαιωμένο οπτικό, ρίζα αβέβαιη | M | Σπασμένο ελληνικό rendering nickname πράσινης κάρτας | Computed font/glyph width/breakpoints· Inter already inherited, μη τυφλή font-family fix |
| **CC-02** | Βελτίωση προσβασιμότητας | M | Dots μη clickable στη stack, αλλά υπάρχει ήδη ArrowUp/ArrowDown keyboard nav | Προσθήκη click discoverability χωρίς αντικατάσταση drag και keyboard |
| **CC-03** | Μερικώς, UX localization | M | Statement/VALID THRU/ASC-DESC μη πλήρως ελληνικά, μακρά credit page | Financial statement=κατάσταση λογαριασμού, όχι δήλωση· tabs μόνο με product decision |
| **IL-01** | Επιβεβαιωμένο geometry | M | Loan panel full bleed με κεντραρισμένο μικρό content | Bounded alignment shared grid, ασφαλή actions |
| **IL-02** | UX πρόταση | L | Ημέρα 1/δόση και γλώσσα δανείου συγχέονται με ημερολογιακή ημερομηνία | Clarify payment date vs installment number; no due-date inference |
| **LD-01** | Επιβεβαιωμένο geometry + danger UX | M | Lending master/detail μεγάλες ασυνέπειες πλάτους | Shared master/detail alignment και destructive action contrast |
| **LD-02** | Απαιτεί επιβεβαίωση interaction | H | Διαγραφή απαίτησης/κειμένων πιθανώς παραπλανητική | Επαλήθευση confirm+archive/writeoff contract, μη διαγραφή immutable finance history |
| **R-01** | Επιβεβαιωμένο split semantics | H | Attention overdue vs Recurring next scheduled date; forecast skips old missed cycle | Shared overdue indicator + separate future due, forecast change μόνο με tests για double counting |
| **R-02** | UX πρόταση | L | Όλες οι πληρωμές primary CTA ανεξαρτήτως λήξης | Tone hierarchy by due state μόνο μετά από approval / tests |
| **P-01** | Επιβεβαιωμένο geometry | M | Inner scroll cropped Planning pending row | Review max-height and viewport, keyboard scroll, not hardcode eight rows |
| **P-02** | Επιβεβαιωμένο UI | M | Current portfolio sr-only, trend arrow shows both icon and signed negative | Visible current baseline και μη διπλό sign, maintain accessible label |
| **P-03** | Επιβεβαιωμένο geometry | L | Flat sparkline at y=27 implies bottom baseline | Constant series at middle y=16, no balance mutation |
| **E-01** | Μικτό / finance category risk | M | Uncategorized Κούρεμα notes on Άλλο and narrow internal panel | Note≠category; subcategory Άλλο classification requires owner meaning; align inner rows |
| **E-02** | Επιβεβαιωμένο | H | Attention own useState(false) vs app session privacyVisible | One app-scoped volatile privacy state, no persistence |
| **E-03** | Επιβεβαιωμένο semantic contradiction | M | Επείγοντα 25 και πράσινο success icon/Η λίστα είναι ενημερωμένη | Urgent heading and semantic icon when danger items exist |
| **A-01** | Επιβεβαιωμένο CSS | H | FinanceIcon shifts span:nth-of-type index so titles/categories concatenate | Explicit report-entry-copy class; no generic nth-of-type hack |
| **A-02** | Επιβεβαιωμένο labeling, not aggregate bug | M | Selected card 500 labeled συνολικό; portfolio 1000 is sum of active cards | Per-card label distinct from aggregate, preserve creditPortfolioSnapshot |
| **A-03** | Επιβεβαιωμένο period display | H | Current report upcoming uses selected month 01 not current asOf | Current uses asOf, historic retains month anchor; separately display overdue and future periods |
| **A-04** | Επιβεβαιωμένο presentation | L | Percent.toFixed uses English decimal point and palette by rank index | Locale el-GR, stabilize category identity colors if approved, no finance value change |
| **A-05** | UX copy | L | Canonical/technical source details in report descriptions | Translate to user terms without hiding actual vs expected provenance |
| **ST-01** | UX proposal | L | Settings General duplicate metadata/platform and decorative splash | Reduce redundancy only after reviewing product hierarchy |
| **ST-02** | Not security defect by screenshot | M | Several Chrome sessions visually identical | No session deletion: add last activity/device metadata if trustworthy, verify revocation and session owner |
| **ST-03** | Επιβεβαιωμένο CSS | M | Provider summary concatenation and stretched heading button | Inline-flex gap; internal IDs remain accessible in editor |
| **ST-04** | Επιβεβαιωμένο density | M | Many permanently open subcategory forms and controls | Disclosure + accessible grouped actions, preserve entire approved taxonomy |
| **ST-05** | Source-confirmed inference gap, runtime count unproven | M | 39 labels lack direct rule; 22 lack parent fallback with 20+6/71 taxonomy | Generate true mapping inventory from current labels, use approved pack & preferences, not stale examples |
| **ST-06** | Ανακριβής αρχική κατηγορία | L | Original said no import confirmation | Existing ConfirmDialog and pre-import backup; no blind rewrite |
## Independent findings beyond both supplied audits

| ID | Severity | Independent evidence | Safe disposition |
|---|---|---|---|
| X-01 Recovery freshness | **High operational** | Read-only live database on 2026-10-29: finance revision **494** vs latest in-app backup revision **485** (9-revision gap); 52 backup rows and 30 history points | Do not claim loss/corruption. Current independent full PostgreSQL **and Storage** restore-tested checkpoint not established; arrange authorized non-destructive evidence before high-risk release/import |
| X-02 RLS posture | Medium review | 16 public tables show RLS enabled. Two app-lock tables have RLS with no direct policies (INFO) | These may be intentionally inaccessible via direct table endpoints; test function-only access and authenticated negative paths; do not add broad policies blindly |
| X-03 SECURITY DEFINER RPCs | Medium review | Supabase warns 3 app-lock RPCs executable to authenticated users; current definitions check owner, AAL2 and for action/ticket active session; anon has no execute; pinned empty search_path | Treat as expected controlled privilege boundary until failure-path tests prove otherwise; no revoke/change solely to silence advisor |
| X-04 Password leak protection | Medium hardening | Supabase security advisor warns leaked-password protection disabled | Review owner/compatibility and enable through reviewed auth configuration only; keep mandatory TOTP |
| X-05 RLS perf initplan | Low | 2 performance WARNs on private pending card-secret cleanup table | Plan measured optimization migration if needed, never indiscriminately rewrite security policy |
| X-06 Backup scope/secret separation | High UX clarity | Prior #616 functional audit: FinanceData backup/history excludes vault secrets, IBAN/provider Storage, local PIN/device drafts by design | In-app backup text must not imply complete device/payment-card restore; document exact coverage and verify recovery |
| X-07 Cross-store partial success | High workflow | Card secrets/assets/IBAN independent of revisioned finance save; #616 highlights partial-success pathways | One save bar cannot prove ancillary Storage/vault success; scenario-level QA for ack/conflict/partial failure |
| X-08 Source vs production | High release boundary | Main production v1.7.0; develop v1.7.1 staging; draft #645 authentication patch release; #647 separate desktop UI draft | Do not merge #647 straight into main or assume deployed; release gated via develop→main |
| X-09 Full QA absent | High acceptance | Draft #647 head CI source validation & CodeQL passed at 4cffa93; Windows/rendered/Lighthouse/WebKit skipped due draft | Do not call screenshots from Oct28 current rendered acceptance. Run and inspect actual generated evidence at coherent review head |
| X-10 Historical taxonomy | Medium | #617 current production 20/6+71 approved and relational references previously checked at revision 485; later finance revision 494 | Do not reapply taxonomy or rewrite older ledger labels; new writes need authenticated owner+AAL2 session |
| X-11 Finance data semantics | High | Cash forecasts include planned/estimated future expenses but canonical ledger only posts real booked events; lending receivable ≠ account balance | Differentiate booked, due, hypothetical and paid throughout screens; no forecast-as-spend double posting |
| X-12 Account dashboards vs reports | Medium | Dashboard accounts can have negative balances; Reports distribution deliberately filters strictly positive balances and labels them positive | This is composition of positive cash, not global net worth; keep labels and data source transparent |
| X-13 Cosmetic source coupling | Medium | 80 ordered `root-compat.css` imports plus page CSS / runtime semantic theme; brittle nth-of-type selector proven | Fix shared/root owner, build a source test for repeated failure class; don't impose a universal arbitrary 1680px width |
| X-14 Unsupported promises | Medium | UI footer asserts data 'safe and encrypted'; security and operational recovery are different properties | Confirm what encryption-at-rest/vault/session claims actually cover, avoid broad guarantees from visual-only evidence |
| X-15 Taxonomy/icon packs | Medium | Direct 20/6/71 approved source; rule inference omits 22 names even after parent fallback; explicit icon user preferences may still cover them | Test runtime `resolvedCategoryIcon` per pack and existing preference, not 22 assumed broken screen glyphs |

## Functional and security audit — acceptance boundary
1. **Auth:** source `server/index.ts:requireFinanceSession` requires session, owner check and AAL2; `server/auth.ts` distinguishes cookie vs explicit bearer and `server/http.ts` restricts mutation Origin and JSON payload. This is a source-level positive control, NOT a complete adversarial runtime penetration test.
2. **Database:** checked live list of migrations through `20261024160000`, public RLS enabled. App-lock SECURITY DEFINER functions return public RPC responses with internal checks; an advisor is not an automatic proof of exploit.
3. **Finance:** previous #616/#617 read-only checks at revision 485 support 498 events/669 legs integrity and canonical reference parity at that revision; live 494 has since advanced. Never claim those historical counts freshly verified for revision 494 without a new dedicated bounded read-only domain query.
4. **Backups:** 52 backup records, max revision 485; history points 30. Neither is evidence that present PostgreSQL+Storage can be independently restored. Do not perform destructive restore to test.
5. **Cards:** credit purchase is spending, repayment not again; debit/prepaid cards are credentials whose transactions belong to linked account. Vault secrets excluded from ordinary finance history.
6. **Lending:** receivable is asset included in net worth, repayments decrease receivable; account cash legs must be labeled separately from receivable balance.
7. **Recurring:** `nextRecurringDate` supplies future schedule while `recurringDue` supplies overdue/current state; mixing their meaning causes R-01, but changing forecast to post old unpaid bills risks double count.
8. **User interaction:** shared save-progress is receipt-driven; conflicts and cross-store partial success must not show false green. UI audit must include loading/empty/error/conflict/long Greek text and focus states.
9. **Product:** 20/6 approved taxonomy and historical category aliases must remain; no mass category transformation based on transaction note text.
10. **Platform:** web/desktop required QA on rendered Chrome, WebKit, Windows, responsive and keyboard; no physical device testing by default.

## Action roadmap
- **Current draft #647 / issue #646:** I1+I2 nine presentational changes source-implemented provisionally. I3 focuses D-01, E-02, E-03 and R-01 *overdue visibility only*. All acceptance counters remain 0 until real browser rendered, unit and repo gates.
- **Finance-domain separate coherent batch:** T-01/D-03 per-event cash-leg balances; display accurate cash movement signs without touching historical finance records; prove id/date/order, multi-leg, transfer, owner revision parity.
- **Recurring/forecast domain batch:** define overdue-vs-next cycle, paid/unpaid and variable estimate treatment; run multi-month/annual, early payment, historical report and double-count regression fixtures before any cash-flow adjustment.
- **Design layout batch:** S-01/C-01/IL-01/LD-01/E-01 child panel alignment; verify 2543/2560px original viewports and representative desktop/tablet/mobile; preserve shared width role and accessible actions.
- **Taxonomy/icons and localization batch:** ST-04/05; exact 20/6/71 source mapping, category selector and icon packs, Greek typography, credit statement terminology; no false legacy restoration.
- **Operational release gate:** verify current full independently restorable backup and clear backup scope; inspect security advisors with negative-path tests and avoid ad hoc production mutation. Production promotion remains deliberate, separately validated.

## Acceptance evidence that is still missing
- No interactive authenticated production browser run from this audit.
- No direct new rendered QA screenshots for broadened #647 changes yet.
- No full independent backup restoration proof.
- No physical Windows machine requirement; required automated Windows installer/browser gates must run and their artifacts be inspected.
- No successful proof of an exploit; warnings recorded as reviews, not vulnerabilities.
