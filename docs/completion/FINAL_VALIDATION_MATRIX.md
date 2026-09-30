# MyFinHub final validation matrix

Status: pre-final validation preparation  
Tracker: #476  
Working validation branch: `audit/476-final-validation`  
Product integration branch: `feat/476-completion-audit-hardening`

This matrix maps every currently **proof-pending** audit/final-validation item to the concrete repository gate that must prove it before merge.

Important coordination rules:

- The owner reports the remaining logo binaries have been uploaded manually.
- Do **not** inspect or mutate Supabase/DB until the owner explicitly requests the final DB review.
- Another chat is currently making a small repository change set. Do not review, absorb or overwrite those changes until the owner says that work is finished.
- This validation branch is isolated so QA-harness corrections can continue without touching the in-flight product branch.
- A source change alone does not close a proof-pending item.

## Current counts

- Deep-audit findings: **53**
- Deep-audit implementation/disposition: **53/53**
- Proof-pending deep-audit findings: **37**
- Final-validation findings: **20**
- Proof-pending final-validation findings: **20**
- Total proof-pending items: **57**

## Evidence matrix

| Pending IDs | Evidence / gate | Acceptance proof |
| --- | --- | --- |
| DA-02 | `brand-visual-qa.mjs`, Settings account/provider evidence, final screenshots | Provider marks are visually correct, no fabricated brand fallback, visual provider picker is contained/readable. DB binary verification is deferred until explicitly requested. |
| DA-03, DA-13, DA-17 | `icon-packs-qa.mjs`, `category-icon-adoption-qa.mjs`, `theme-system-qa.mjs`, Settings/icons final evidence | Switching library updates visible taxonomy immediately, per-library choice is restored, colors persist/render app-wide, 320–375px rows do not overflow. |
| DA-05, DA-18, DA-31, DA-38, FV-01, FV-15 | `frontend-qa.mjs`, `completion-functional-crud-qa.mjs`, card-vault/store unit tests | Card profile edit is distinct from secure details; Save→Reveal round trip works; network/design edits do not silently mutate each other; no duplicate/incorrect card state. |
| DA-07, DA-26 | `receipt-local-ocr-qa.mjs`, production build | Worker/WASM/Greek+English trained data are actually reachable; capture→OCR→review→Quick Entry works; mobile OCR action stays inside footer without covering primary actions. |
| DA-08, DA-09 | `completion-functional-crud-qa.mjs`, `frontend-qa.mjs`, `completion-geometry-qa.mjs` | Lending mobile history is bounded and expandable; Savings/Loans/Lending browser CRUD round trips update visible state with no clipping/occlusion. |
| DA-11, DA-15, DA-16, DA-20, DA-25, DA-35, DA-41, DA-42, DA-45, DA-46, DA-47, DA-52, DA-53, FV-05, FV-07, FV-08 | `completion-geometry-qa.mjs`, `frontend-qa.mjs`, final screenshots | 48 route/viewport combinations remain horizontally clean; final reachable actions clear persistent chrome; Dashboard tablet/desktop geometry is bounded; six-cell nav labels do not collide; desktop pagination leakage and small card copy targets are absent. |
| DA-36, DA-39, FV-09, FV-10, FV-12, FV-19 | `completion-dialog-geometry-qa.mjs`, `ui-ux-hardening-qa.mjs` | Real modal/sheet surfaces remain within 375×812 and 320×700 viewports, footer actions remain reachable, controls have accessible names, Quick Entry uses canonical mobile trigger. |
| DA-21 | `payment-flow-normalization-qa.mjs`, credit rendered flows | Same-provider repayment accounts work for Settings-created account IDs via canonical provider matching, not string-prefix assumptions. |
| DA-23 | migration-ledger source/unit tests only until DB review is explicitly re-enabled | Repository ledger is internally reproducible and includes the known applied migration sources. Reconcile against any later DB work only after owner says the other workstream is finished. |
| DA-27 | credit statements/rendered QA + source coverage | Purchase/payment ledgers render bounded 25-row windows, expand explicitly, and reset correctly on card/sort changes. |
| DA-32 | `completion-functional-crud-qa.mjs`, `recurring-cadence-qa.mjs`, obligation lifecycle QA | Recurring create/edit/pause/reactivate round trip succeeds while preserving lifecycle/history semantics. |
| DA-33 | planning lifecycle/rendered QA | Existing pending scheduled item can be edited/saved; current liquidity does not change before completion. |
| DA-37, FV-13, FV-14, FV-16, FV-17 | Transactions functional/rendered QA, `transactions-scanability-qa.mjs`, UI completion/hardening QA | Modern event edit works through real search/pagination path, no duplicate event appears, sort direction is monotonic and delete→undo→redo targets the actual fixture. |
| DA-43, DA-44, FV-03, FV-06 | `final-screenshots-qa.mjs` + manual inspection | Final capture starts reliably, waits beyond route/dialog motion, produces exactly **63** persistent PNGs, and evidence is judged only after transition settle. |
| DA-50, DA-51, FV-04 | root TypeScript/hygiene/unit/build + API TypeScript | SVG asset declarations compile in Node/test graph, card-network helper exports satisfy unused-export gate, consolidated category visual resolver passes hygiene. |
| FV-02 | Performance smoke / Lighthouse | Mobile Dashboard performance meets repository threshold without weakening budgets or Lighthouse criteria. |
| FV-11, FV-18 | source-contract tests | Dialog accessibility contract matches the repaired inspector; six-cell Quick Entry/nav source contracts reject the retired floating FAB. |
| FV-20 | `frontend-qa.mjs`, `owned-controls-qa.mjs`, `receipt-local-ocr-qa.mjs` | All downstream mobile harnesses navigate by stable accessible names/canonical Quick Entry trigger rather than retired visible labels/classes. |

## Theme and final evidence

The persistent final archive remains exactly **63 screenshots**:

- 12 routed pages × desktop/tablet/mobile = 36
- 6 extra Settings tabs × desktop/tablet/mobile = 18
- 3 auth states × desktop/tablet/mobile = 9

Light/dark proof is separate and additive. `theme-system-qa.mjs` covers:

- all 12 routes in Light and Dark on desktop;
- all 12 routes in Light and Dark on mobile;
- Dashboard, Transactions, Credit, Reports and Settings in Light and Dark on tablet;
- focused Settings selection/focus, Quick Entry modal and grayscale semantic evidence.

## Final sequence

1. Continue source/harness preparation only on `audit/476-final-validation`.
2. Wait for the owner to say the other chat's repository changes are complete.
3. Review that change set before integrating anything.
4. Rebase/reconcile validation fixes onto the actual final product head.
5. Run source/type/unit/build/API validation.
6. Run the full rendered suite.
7. Generate the 63 final screenshots.
8. Manually inspect every final screenshot plus focused changed-surface/theme evidence.
9. Fix any real defect; rerun only affected local/rendered validation as needed.
10. Run the exact-final-head CI / CodeQL / Cross-engine / Performance / Windows wave.
11. Merge to `develop` only when every required gate and manual visual review is green.
12. No `main` promotion/release in this batch.
