# Post-v1.4 desktop visual audit and remediation plan

Umbrella issue: #519 — Post-v1.4 UI/UX regressions and functionality reachability.

### Active acceptance checkpoint — 2026-10-09

**Implementations 13/15 completed · Sub-implementations 92/108 completed** (validated acceptance, not merely implementation). The thirteen complete buckets are Dashboard, Cards, Credit, Loans, Lending, Recurring, recurring/service branding, Planning, Attention, Reports, Transactions, Savings and Settings. Their 92 accepted DV checkboxes below were reconciled against #547 (integrated as `f5ff2095`), the focused Dashboard #528 fix (`6fd8cf5`) and Settings #546 (`f412624`), each with exact-head required gates and rendered evidence inspection. Original page-section “not started” descriptions and the dated audit change log are historical planning provenance, superseded by this checkpoint for acceptance status.

**Active workstream:** `fix/519-frontend-backend-reconciliation` on post-Settings `develop`. DV-FB01–DV-FB10 (10 items) remain **unaccepted** while the source-to-persistence reconciliation and its evidence run; DV-M01–DV-M06 (6 items) are blocked until DV-FB acceptance. Denominators remain frozen at 15/108. Cross-stack findings below are not counted as completed merely because an individual narrow fix is implemented.

**Current FB findings and ordered work:** namespace drift in recurring `logoAssetKey` document validation (FB08); exact-mutation durable save receipt and failure propagation in `SequentialQueue` / `useFinance` (FB04/07); recurring-service logo upload → durable Save → reference-aware release/purge ordering plus conflict rollback (FB04/07); domain capability/reachability and persistence traceability updates (FB01–03, FB05–06, FB08–09); real-stack/security/error/runtime and rendered evidence (FB10). Preserve existing optimistic fire-and-forget callers, FIFO revisions/history, owner/AAL2/RLS and Supabase Free-plan limits. Keep Android repository unchanged.


**FB checkpoint — continued implementation and evidence (unaccepted):** The recurring service-asset namespace, revisioned mutation receipts and post-commit reference-aware cleanup now passed isolated real-stack create/replace/remove/reload/conflict proof; the new forward-only Storage object SELECT policy is owner+AAL2, not an anonymous grant. This is a validation boundary success, not the final FB gate. Settings Account Management editor now uses the same exact-mutation durability receipt **before** its separately persisted IBAN update; partial IBAN failure produces a distinct warning. New synthetic negative QA verifies a rejected finance write leaves IBAN untouched and the editor open. Planning/Attention/Cards/Credit optimistic mutation notices now say *saving* rather than claiming server success. Read-only capability and inverse API-source inventory is recorded in `docs/completion/FULL_SYSTEM_TRACEABILITY_MATRIX.md`, sections 8–9.

**DV-FB04/06/07/08 card-vault two-store correction — IMPLEMENTED, ACCEPTANCE PENDING:** Cards and Credit now durably stage a new non-secret card profile **before** any card-vault upload, await the encrypted vault write and then await the final FinanceData profile receipt. The secure details dialog distinguishes rejected profile staging, failed vault write after staging and successful vault write with failed final profile update; it never claims overall success in a partial state. Card permanent-delete now writes an opaque `pendingCardSecretDeletes` ID marker atomically with the card-profile removal through `useFinance.updateDurably`, retains the neutral credit-history tombstone, and performs ciphertext/CVV cleanup only **after** the save receipt. Markers survive reload for bounded once-per-session retry; a failed cleanup is shown as a partial success and the marker is retained. New forward-only migration `20261010013500_atomic_card_vault_cleanup.sql` supplies `rheomiq_delete_committed_card_secret`: owner+AAL2 `SECURITY INVOKER`, canonical finance row `FOR UPDATE` lock, cleanup-marker and active relational card checks, encrypted vault deletion **in the same PostgreSQL transaction**. No PAN/expiry/CVV enters FinanceData, backup or logs. `requireCommittedDeletion:true` is an additive opt-in body field; legacy DELETE syntax remains accepted. **Not yet accepted:** exact-head isolated real-stack create/remove/reload + protected concurrent undo/redo (current run pending), live-browser partial failure screenshots, CodeQL, migration recovery, Windows/cross-engine/performance review and source→API compatibility across web, desktop and Android API consumers.

**Rollout/compatibility constraint:** The new browser/Windows cleanup request requires the corresponding backend handler and forward-only RPC migration to be deployed before updated clients can complete guarded DELETE. The Windows desktop proxy forwards the opt-in field to the canonical production origin; older production API deployments will reject it, retaining the pending marker until upgrade/retry rather than discarding secrets. Existing Android APIs remain compatible on the legacy DELETE payload, but an older Android FinanceData writer may not preserve the newly additive `pendingCardSecretDeletes` field. This potential cross-client compatibility impact must be assessed/documented at the FB09/release boundary by the separate Android owner; **do not modify Android code here**. Do not promote or merge without the full protected rollout/test evidence.

**DV-FB05/07 continued cutoff and post-commit recovery checkpoint — IMPLEMENTED, ACCEPTANCE PENDING (2026-10-10):** Realized current-month Dashboard, Reports, Savings, category budgets and Attention now use the same active `asOf` cutoff for dated financial events, preserving full completed historical months. Lending outstanding/history, Reports receivables and net-worth linked receivable deltas exclude not-yet-effective lending/repayment events. Loans, linked recurring long-term installments, Quick Entry, Command Palette, Reports loan burden, Attention and Forecast now exclude future-dated loan payments from current remaining installments and debt. Legacy `loan.paidCount`/`state.loanExtra` and workbook receivable baselines remain authoritative rather than destructively reconstructed. New narrow unit/source tests and synthetic rendered negative fixtures cover current vs future payments and budgets. Card-vault post-commit cleanup now deduplicates automatic/manual retries and surfaces an actionable shared persistence warning when the protected vault cleanup fails; it retains the opaque pending marker until the vault and local storage plus final FinanceData receipt succeed. **Review acceptance still blocked** on exact-head CI/CodeQL/Supabase and direct desktop/wide/tablet/mobile Light/Dark/error screenshot inspection, remaining FB02/03 inverse reachability, FB06 security/negative branches, FB08/09 cross-client and rollout compatibility. Separate Android repo untouched. **Counters remain 13/15 implementations and 92/108 sub-implementations; DV-FB01–FB10 and DV-M01–M06 unchecked.**

**Remaining independent FB tasks:** inverse reachability and hidden/dead-affordance scan (FB02/03), date/statement/recurring/forecast parity (FB05), comprehensive negative owner/AAL2 + vault/RLS path audit (FB06), schema/API/migration compatibility (FB08), web/Windows exact-head validation (FB09), rendered failure/success inspection and classified gap closure (FB10). Real-stack negative unauthenticated/pre-AAL2 service-asset requests have been added and require exact-head acceptance. Normal mutable controls remain optimistic with central save-state/conflict/error notices unless they require a durable external cleanup receipt. The final DV-M batch stays blocked.



**Implementations 13/15 completed · Sub-implementations 92/108 completed**

## Purpose

This is the repository-owned remediation plan produced by the completed post-v1.4.0 page-by-page visual UI/UX audit.

The audit/planning intake is complete. This document is the authorized implementation scope and acceptance contract for the remediation work once it is integrated into the current `develop` baseline. Its findings define what must be corrected; they do not authorize unrelated redesign or scope expansion.

The previous #503 remediation remains historical evidence for the defects it owned. This plan records the accepted residuals, regressions, composition problems and owner-directed corrections against the current post-v1.4 product.

## Current audit scope

- The **page-specific visual findings** in this audit are desktop-focused.
- Standard desktop and **wide-desktop** composition are in scope.
- Tablet/mobile redesign is not an audit target. However, any implementation that changes a shared primitive, token, layout owner, theme rule, motion contract or other cross-breakpoint owner must preserve and validate affected tablet/mobile consumers so desktop remediation cannot create a regression elsewhere.
- Light and Dark themes are both relevant where desktop evidence exists; shared-owner changes must preserve both themes wherever the owner is consumed.
- Preserve finance semantics, security, accessibility, current functionality and the canonical information architecture.
- Owner concept/reference images are direction evidence, not literal contracts.
- Cards additionally follow `docs/CARDS_PROTOTYPE_CONTRACT.md`.
- Do not modify Android.

## Integrated baseline protection before remediation

The future remediation implementation **must start from the then-current `develop` branch, never from this documentation branch as a code baseline**. This plan branch predates later accepted implementation work and exists only to carry the audit/remediation specification.

As of the current checkpoint, `develop` includes the owner-authorized Quick Entry reconciliation from #521/#522, the app-wide shared-control branding correction from #523/#524, and the shared-first execution/design standard from #525/#527, with current integration head `63c954cc24076742a7beb9980a3f01bd5c2510db`. Those accepted results are protected baselines for this remediation plan:

- Do not reimplement, restyle, revert, or replace the accepted Quick Entry visual/interaction contract merely to satisfy a broader page finding.
- Never copy pre-#522 versions of Quick Entry/shared style files from this documentation branch or another stale branch over current `develop`.
- The #522-owned files include `src/components/QuickAdd.tsx`, `src/components/ReceiptAwareQuickAdd.tsx`, `src/styles/quick-entry-desktop-composition.css`, `src/styles/quick-entry-body-split.css`, `src/styles/mobile-finance-presentations.css`, `src/styles/receipt-inbox.css`, the focused Quick Entry QA script and its source contracts.
- Shared-owner changes are still allowed when a remediation item genuinely requires them, but they must be reconciled **on top of** the #522 result rather than replacing it. This specifically applies to theme/control tokens, `Button`/`IconButton`, `AppTextInput`/`AppInputShell`, owned input/popover styling, Dialog/modal foundations, mobile coordination and motion/reduced-motion owners.
- Any remediation batch that touches one of those shared owners or a CSS layer capable of affecting Quick Entry must run `tests/quick-entry-reference-source.test.ts` and `scripts/quick-entry-reference-qa.mjs` in addition to the batch-specific checks, then directly inspect fresh Light/Dark desktop/tablet/mobile Quick Entry evidence before the batch can be accepted.
- The accepted #522 reference contract is **Quick Entry-specific plus its genuinely shared primitive behavior**. It did not make every app surface visually identical to Quick Entry. Auth/Login, for example, reuses shared primitives but retains auth-specific layout/presentation; do not assume otherwise when planning or validating shared-control changes.

This protection is a reconciliation invariant, not a new remediation sub-implementation, so the plan counters are unchanged.

### Shared-control branding and shared-first rule integrated

#523 / PR #524 is integrated into `develop` at `ff96db426ce2d1b8e094883d0078613350f57080`, and #525 / PR #527 is integrated at `63c954cc24076742a7beb9980a3f01bd5c2510db`. The shared-control branding and shared-first execution/design rules are therefore part of the remediation baseline, not pending prerequisites.

The following baseline is protected:

- Default `AppTextInput`, `AppInputShell`, `AppSelectInput`, `AppDateInput`, `CategorySelectInput` and `MoneyInput` presentation is shared branding, not page-local styling.
- Login/MFA may retain auth-specific layout and copy, but must not reintroduce a separate default input-box geometry or theme contract.
- Quick Entry may retain floating-label/layout behavior, but its underlying input boxes must continue to inherit the shared control tokens/geometry.
- Before adding or restyling a same-role UI element, inspect the shared primitive/token/variant owner. If one reusable owner can express the result, fix or extend that owner instead of adding page-local duplicate CSS/markup/state logic.
- A recurring contextual difference should become an explicit shared variant/density/tone/state contract. Page-local default styling is a last-resort exception, not the normal approach.
- The owner-approved visual language established through the Quick Entry/reference and #524 shared-control work is the application-wide standard for shared controls/surfaces. Layout/composition may differ by page; default same-role visual/state contracts should not drift.
- If two accepted product/domain/accessibility/security/visual contracts are genuinely incompatible and resolving them requires a product or visual trade-off, stop before creating a divergent exception and ask the owner which contract should win. Technical conflicts that preserve all accepted contracts should be reconciled without owner interruption.
- Any remediation batch touching shared control/theme/input CSS must run the #523 source contract plus the existing #522 Quick Entry rendered/source regressions and inspect representative Login/MFA + Quick Entry + Settings/editor evidence.
- Shared-owner remediation changes require bounded sibling-consumer inspection and the relevant rendered/theme/accessibility regression evidence, not only the originating page screenshot.

This reconciliation protection and shared-first rule do not change the remediation counters.

### Desktop viewport acceptance for future remediation

At minimum, changed pages must later be inspected at:
- 1440 × 1000 or equivalent standard desktop;
- 1920 × 1080 wide desktop;
- 2560 × 1440 large desktop where layout expansion materially changes composition.

Wide-desktop validation is about composition, hierarchy and use of available space, not simply absence of horizontal overflow.

### Implementation sequencing and shared-owner batching

- The numbered page/functional sections are **acceptance buckets**, not instructions to create one page-local implementation or one PR per section. Numbering records audit organization; implementation order may be adjusted for dependencies and shared ownership while preserving every item’s acceptance contract.
- Before the first product mutation, perform a bounded read-only dependency/shared-owner sweep across the open `DV-*` items and current live branches/PRs. Map repeated findings to their likely primitive/token/layout/domain owners so the same root cause is not fixed repeatedly. This preparation is not a new sub-implementation and does not change counters.
- If several `DV-*` findings share one owning primitive/token/selector/domain rule, implement the correction once at that shared owner and validate representative sibling consumers. Each affected `DV-*` item is marked complete only when its own acceptance evidence is satisfied.
- Reusable contextual differences become shared variants. A local override is permitted only for a genuinely unique requirement and must record why a shared variant would be incorrect.
- Use coherent implementation batches and narrow preflight checks during churn. Run the full required CI/security/rendered/cross-engine/Windows/performance matrix on the final coherent review head, with an intermediate full gate only at a material risk boundary.
- `DV-RB01`–`DV-RB07` is such a risk boundary if implementation introduces or changes migration/storage/security contracts; validate that boundary before unrelated visual work proceeds on top of it.
- Before page remediation becomes deep, perform a lightweight **read-only** capability/reachability reconnaissance using the domains listed in `DV-FB01` so obvious persistence, reachability or semantic dependencies are known early. This does **not** complete `DV-FB01`; the full `DV-FB01`–`DV-FB10` reconciliation remains the penultimate implementation gate.
- The final motion batch `DV-M01`–`DV-M06` remains blocked until page remediation and the full frontend/backend reconciliation gate are complete.
- There are **no unresolved owner-decision gates** at plan-finalization time. `DV-SV02` and `DV-ST01` are both resolved by durable owner decisions dated 2026-10-08 in #266. Any newly discovered genuine conflict between accepted contracts that requires a product/visual trade-off must still be escalated before a divergent exception is introduced.

## Evidence currently reviewed

The persisted `visual-qa/final` set below is **historical audit/comparison evidence, not current implementation acceptance evidence**. Its manifest records app version `v1.3.0`, capture `2026-10-06_183318__9068f100`, source `9068f1005f6cc432fe62773b5436aa6a61193d7f` on `fix/503-ui-ux-owner-intent-remediation`. It was valid input for identifying the findings in this plan, but it must not be used to claim that a remediation item passes on a later implementation head.

Every user-visible remediation batch must generate fresh rendered evidence from its exact implementation/review head and directly inspect the affected states before acceptance.

Persisted Final Visual desktop comparison captures:
- `visual-qa/final/dashboard/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/dashboard/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/cards/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/cards/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/credit/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/credit/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/loans/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/loans/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/lending/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/lending/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/recurring/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/recurring/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/planning/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/planning/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/attention/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/attention/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/reports/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/reports/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/transactions/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/transactions/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/savings/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/savings/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`
- `visual-qa/final/settings/v1.3.0__2026-10-06_183318__page-light__desktop-1440x1000.png`
- `visual-qa/final/settings/v1.3.0__2026-10-06_183318__page-dark__desktop-1440x1000.png`

Additional authority:
- owner instruction that Dashboard charts/graphs must remain;
- owner-confirmed Dashboard wide-screen responsiveness defect;
- issue #519;
- `docs/UX_STANDARDS.md`;
- `docs/UI_UX_SYSTEM_AUDIT.md`;
- `docs/ACTUAL_VS_CONCEPT_RECONCILIATION.md`;
- `docs/CARDS_PROTOTYPE_CONTRACT.md`.
- `docs/canonical-credit-card-stack-integration.md`.
- Historical PRs #155, #263, #323 and #327 and issues #322/#326 for Credit multi-card/stack intent.
- Historical PR #321 / issue #320 for the owner-approved Loans desktop target and segmented progress treatment.
- Historical PRs #325/#328 and issue #324 for the owner-approved Lending master/detail desktop target.
- Historical PRs #330/#331 and issue #329 for the owner-approved Recurring desktop target.
- Provider-branding/storage work from #479/#482 (integrated through the canonical provider-management reconciliation) as the security/validation precedent for owner-managed image uploads. Recurring/service logos are a separate asset domain and must not be modeled as financial providers.
- Historical PRs #335/#336 and issue #332 for the owner-approved Planning desktop target; retain the stronger operational scheduled/account-level forecast model while reconciling the lost aggregate liquidity graph.
- Historical PRs #338/#339 and issue #337 for the owner-approved Attention desktop target; preserve its four-priority grouping and action coverage while correcting residual density/affordance semantics.
- Historical Reports analytics work from #159 plus the owner-approved composite long-form target in #341/#342 and issue #340. Preserve the expanded analytical coverage from #342 while restoring the stronger executive `financial picture` hierarchy demonstrated by the earlier verified Reports implementation.
- Historical PRs #308/#310 and issue #305 for the owner-approved Transactions desktop target. Preserve the approved ledger/detail model, 14-row density and canonical edit/delete/split/legacy semantics while correcting residual interaction and wide-desktop issues.
- Historical PR #314 and issue #313 for the owner-approved Savings desktop target. Preserve the action-first three-flow model, real cumulative trend, monthly savings target and personal-goal persistence while clarifying selected-period/current-state semantics.
- Historical Settings redesign sequence #344/#347/#354 plus provider/account management work including #482. Preserve the tabbed Settings information architecture and real management capabilities; correct residual preference/reachability/QA ambiguities rather than redesigning approved tabs.
- Historical PR #186 / issue #185 for route-shaped skeleton fidelity, loading-shift/CLS validation and reduced-motion behavior.
- Current owner-supplied `myfinhub_credit_card_stack_production_final.html`, SHA-256 `4d281887a4083d36c6b454fa2438b792e3c545248991a22c6bdfdefa736f9b87`; use it as the current animation/card-stack direction, with the pagination-dot scrolling defect explicitly excluded from the target behavior.

---

## 1. Dashboard

Status: visual findings recorded; implementation not started.

### Owner constraints

- **Do not remove the Dashboard graphs/charts.** Their information and analytical role must remain.
- The Dashboard must compose correctly on large desktop displays; this is not optional even if 1440px evidence appears contained.
- Preserve the semantic primary-account order: **Μετρητά → Μισθοδοσίας → Αποταμιευτικός**.
- The owner-confirmed items below are **guaranteed corrections, not an exhaustive acceptance of the rest of the account-card composition**. Keep the broader visual-audit findings/candidates in scope until they are visually verified during implementation; do not infer that unmentioned parts are approved or rejected solely from this feedback.
- Guaranteed account-area corrections: spacing/wide-desktop responsiveness and lateral positioning, removal of the unwanted decorative logo wrapper/halo (“κύκλος”), correct provider-logo rendering, and correct reporting-month data/chart behavior.
- Changing the reporting month must update the account-card period-dependent values and graph; the selected month is not allowed to change only the page-level monthly analytics while primary account cards stay anchored to today.
- Preserve existing finance semantics and historical data.

### Planned corrections

- [x] **DV-D01 — Wide-desktop composition/translation does not scale correctly.** Owner-confirmed. The account/content area can read as pinned too far left instead of moving/rebalancing with the available desktop canvas. Capture exact geometry at 1440, 1920 and 2560, including left/right gutters, content origin relative to the sidebar, section width and card centering/distribution. Correct the responsive lateral positioning and width allocation so content moves naturally with the shell rather than remaining left-anchored, merely stretching, or leaving asymmetric dead canvas. Charts and primary account cards must retain useful proportions.
- [x] **DV-D02 — Preserve and correctly render the Dashboard charts in both themes.** In the latest Dark desktop evidence, the `Έσοδα & Έξοδα` bars and the expense-category donut are not visibly rendered while their labels/values remain. Determine whether this is a render/theme/evidence defect and fix the cause. **Removing the visualizations is explicitly disallowed.**
- [x] **DV-D03 — Remove the false second-header effect from the reporting-period wrapper.** The month/navigation row receives full surface chrome while most of the horizontal band is empty. The period control should remain, but only the meaningful control area should read as interactive/header chrome.
- [x] **DV-D04 — Reduce excessive surface fragmentation outside the accepted primary-account cards.** The lower Dashboard still contains many similarly weighted bordered surfaces across secondary accounts, middle panels, analytics and KPI tiles. Re-establish macro hierarchy where evidence supports it, but **do not use this item to redesign the accepted primary-account card concept**.
- [x] **DV-D05 — Remove the unwanted logo wrapper/halo and make provider logos render correctly inside primary account cards.** The current card wraps the identity mark in `.approved-account-icon`, including account-tone backgrounds/borders, while `BankBrandMark` may itself render Storage-backed artwork. Owner evidence shows the resulting decorative “circle”/halo/container and logo presentation are not correct. Remove the redundant decorative treatment around real provider artwork and size/fit the actual logo cleanly (`object-fit:contain`, preserved aspect ratio, no clipping/stretching/baked CSS glow). Keep a purposeful neutral fallback container only for semantic icons/cash or genuinely missing artwork. Inspect the actual provider asset alpha/background before adding filters/shadows.
- [x] **DV-D06 — Raise secondary financial text to a readable desktop scale.** Table headers, account metadata, legends, KPI captions and supporting labels remain too small relative to available desktop space. Preserve density without returning to 7–9px-style operational text.
- [x] **DV-D07 — Rework the bottom KPI strip hierarchy.** Six equal small cards compress icon, label, value and delta into a narrow band. Preserve the metrics, but reduce competition and improve scanability/readability.
- [x] **DV-D08 — Reduce utility-control competition in the top chrome.** Search, undo, redo, history, refresh and logout currently present as a visually uniform row of square outlined controls. Preserve functionality while differentiating primary/global utilities from low-frequency actions.
- [x] **DV-D09 — Correct account-area spacing, gutters and overflow.** Primary and secondary account regions need consistent card-to-card gaps, internal padding, logo/name breathing room and balanced outer gutters across 1440/1920/2560. Verify that the first card is not visually glued to the left edge/content origin and that the last card has equivalent breathing room. Prevent truncation/crowding caused by width allocation while keeping all existing actions reachable.
- [x] **DV-D10 — Make primary account balances, deltas and account-history graphs obey the selected reporting month.** Source inspection confirms the defect: page-level flow/categories use `month`, but primary account state is still derived from `selectAccountBalances(data, asOf)`, `balanceMonth = asOf.slice(0,7)`, history ending at `asOf`, and `AccountBalanceChart currentMonth={balanceMonth}`. Therefore changing the month can leave account values and the account graph unchanged. Derive a reporting-period end date from the selected `month` (use `asOf` only for the current month; historical months use their actual month end), scope balance/history/change/comparison inputs to that period, and ensure month navigation visibly changes both numbers and graph whenever historical data differs. Do not fabricate movement for months with no activity.
- [x] **DV-D11 — Re-validate primary-account card hierarchy after the guaranteed fixes, rather than declaring the card composition complete up front.** Earlier audit evidence identified possible hierarchy issues around balance prominence, usable graph area, guide-line noise and the relationship between identity/IBAN/chart. After spacing, logo and month-scoping are corrected, visually reassess those items at 1440/1920/2560 and change only defects still demonstrated by evidence; preserve the current finance semantics and three-account structure.
- [x] **DV-D12 — Re-validate primary-account action hierarchy after layout correction.** Earlier audit evidence noted that two similarly weighted actions per card can compete with the financial content. Do not remove actions by assumption, but inspect the corrected desktop renders and, if they still dominate, reduce visual competition through hierarchy/styling while retaining both capabilities and accessibility.


### Dashboard implementation acceptance

- All charts remain present and readable.
- Light/Dark show the same analytical content.
- 1440, 1920 and 2560 desktop compositions are intentional, balanced and overflow-free.
- No large-screen state becomes a stretched version of the 1440 layout or leaves avoidable dead canvas.
- Primary-account semantic order and existing account capabilities remain unchanged. Visual composition/action hierarchy may still be refined only where the post-fix desktop evidence confirms a defect; owner-guaranteed corrections do not imply blanket acceptance or rejection of other audit findings.
- Real provider logos render without the unwanted decorative wrapper/halo, without clipping/stretching, and with clean fallback behavior when no artwork exists.
- Switching reporting month changes the primary-account period-end balance/delta/history graph consistently with that month; returning to the current month restores `asOf`-scoped values.
- Dense data remains readable without inflating the page into oversized cards.

---

## 2. Cards

Status: visual findings recorded; implementation not started.

### Contract constraints

- Keep the bank-column interaction model and the card object as the primary visual domain object.
- Preserve current archive/restore behavior and current bright-card contrast fixes.
- Do **not** restore destructive hard-delete semantics from the prototype.
- PAN/expiry/CVV remain inside the current owner+AAL2 encrypted server-vault boundary.
- Do not replace the v15 card workspace with an unrelated Cards UI pattern.

### Planned corrections

- [x] **DV-C01 — Bank-column strip is visually clipped at standard desktop width.** At 1440px the right-most provider column is cut by the viewport, which reads as accidental clipping rather than deliberate horizontal navigation. Preserve the horizontal bank-column contract, but make overflow/navigation visually intentional and fully usable.
- [x] **DV-C02 — Empty provider columns dominate the workspace.** The current page derives columns from the broader provider registry, producing many large empty bank columns for one active card. Reconcile the visible column set with actual card-bank/user-card semantics while preserving the bank-column model.
- [x] **DV-C03 — The `Τράπεζες 8` KPI is visually prominent but semantically misleading.** It reads as eight card banks owned by the user while the page shows one active card and multiple empty provider columns. The metric must represent the Cards domain, not registry size.
- [x] **DV-C04 — Add-bank vs add-card action hierarchy is inverted.** `Προσθήκη τράπεζας` is the dominant page CTA, while adding a card is represented by a small unlabeled `+` inside each bank column. Preserve both capabilities but make the card-creation path at least as discoverable as bank administration.
- [x] **DV-C05 — Four top-level card toolbar controls overpower the physical-card object.** Reveal, edit, secure-details and archive appear as a compact editor toolbar on the artwork. Preserve required capabilities, but restore the card itself as the visual focus and reduce equal-weight utility chrome.
- [x] **DV-C06 — Card-native microcopy is too small.** `VALID THRU`, `CVV`, secondary identity text and related secure-detail affordances are difficult to scan at desktop size. Improve legibility without enlarging or redesigning the whole payment-card geometry.
- [x] **DV-C07 — Surface nesting is excessive in the card workspace.** The page combines a large outer bank strip, individual bank-column shells, nested empty-state shells and the physical-card surface/shadow. Reduce redundant container treatment while preserving bank grouping and the specialized card artwork.
- [x] **DV-C08 — Recent-transactions rows are over-stretched on desktop.** Transaction identity, category and amount sit very far apart across the full workspace, creating long scan distances that will worsen on wide monitors. Preserve the section but use a more controlled dense-data measure/alignment on desktop.
- [x] **DV-C09 — Dark-theme low-emphasis text is too faint in the bank workspace.** Provider headings, empty-card counts and empty-state copy recede excessively against the dark surface. Raise semantic contrast without turning every secondary label into primary text.

### Cards implementation acceptance

- Horizontal bank navigation remains part of the Cards design but never looks accidentally clipped.
- Empty providers do not dominate the page or masquerade as owned card banks.
- Adding a card is obvious without removing custom-bank management.
- The physical payment card remains the dominant object; utilities are secondary.
- Card labels and bank-column metadata are readable in Light and Dark.
- Recent transactions remain dense and scannable at 1440 and wide-desktop widths.
- v15 interaction/visual invariants and current security/archive differences remain intact.

---

## 3. Credit

Status: visual/history/interaction findings recorded; implementation not started.

### Owner and historical interaction contract

The Credit card stack is not a generic carousel and must not be redesigned as one. The current owner-supplied reference is the same named standalone component historically adopted by the repository. It defines the card-stack visual/interaction direction while the host Credit page remains responsible for finance UI around it.

Repository history resolves the intended navigation model:

- PR #155 restored multiple independent active credit-card identities.
- PR #263 adopted `myfinhub_credit_card_stack_production_final.html` as the Credit stack visual/interaction source of truth and explicitly preserved stable-ID order, swipe/restack, pointer tilt, archive slider, pagination dots, keyboard navigation and reduced-motion behavior.
- PR #323 temporarily added a desktop host `Οριζόντια / Στοίβα` switcher plus previous/next navigation.
- PR #327, after owner feedback, removed that competing host navigation and restored the canonical animated drag/restack interaction as the **sole rendered card-switching model**.
- Current owner instruction reconfirms that the older animation is the correct direction and must receive special emphasis.
- The reference's pagination-dot scrolling behavior is **not** accepted as correct and must not be preserved merely for fidelity.

### Canonical motion behavior to preserve

Future remediation must start by preserving/revalidating the existing canonical choreography rather than inventing a new animation:

1. Up to four visible stack layers use the established depth treatment: the front card at full scale, followed by progressively lower/scaled/desaturated cards.
2. Pointer/touch drag is vertical. During drag, the top card follows the gesture while the second and third layers advance toward the front continuously; this follower motion is part of the interaction, not optional polish.
3. A committed swipe uses the historical threshold/velocity behavior rather than requiring an exaggerated full-card throw.
4. Restack is a two-stage motion: the front card first travels approximately ±58px with slight rotation/lift, then recedes behind the deck while the following cards advance. The temporary back-layer ghost prevents a visual pop while the DOM/order is rotated.
5. The historical transform transition is about 480ms with the existing `cubic-bezier(.18,.82,.18,1)` character; the order changes at the end of the motion, not at gesture start.
6. Non-touch pointers retain the subtle pointer-follow 3D tilt, while touch drag remains direct.
7. `prefers-reduced-motion` continues to disable non-essential motion without breaking card selection.
8. The active-card change exposed to the Credit host must occur coherently with the completed restack so debt, limit, purchases, repayments and statements do not visually jump to another card mid-animation.
9. Archive/delete-confirm motion remains the canonical slide-confirm + collapse/flash/shred presentation, but the product action stays the current non-destructive Archive lifecycle unless the separate settled archived hard-delete flow applies.
10. Pagination dots remain visually subordinate to the cards. They may track/scroll to the active position, but they must not become a second competing primary navigation model.
11. **Single-card mode is not a stack.** When exactly one active credit card exists, do not render or simulate stack depth, swipe/restack, ghost-layer, follower-card or deck-cycling motion. The card stays visually singular and stable; the only card-position animation is the subtle non-touch pointer-follow tilt (plus independent card-local actions such as reveal/archive feedback).

### Planned corrections

- [x] **DV-CR01 — Protect the canonical drag/restack animation as the sole Credit card-switching interaction.** Do not replace it with a static carousel, horizontal deck, previous/next buttons or a visible Horizontal/Stack mode switcher. The old canonical stack motion and card geometry are the target.
- [x] **DV-CR02 — Restore multi-card creation reachability from the populated Credit state.** The current `CardCreateDialog` entry point is visible only when there is no active card, so a normal user with one active credit card cannot create the second card needed for the stack interaction. Adding another independent credit card must remain reachable without archiving the current one.
- [x] **DV-CR03 — Add deterministic multi-card animation evidence.** The current Final Visual Credit fixture contains one active card, so it cannot prove layer depth, drag follower motion, restack, ghost continuity, card-order rotation or dot synchronization. Future acceptance needs a dedicated deterministic Credit fixture with at least four active cards and captured/interactively inspected pre-drag, mid-drag, restack and settled states.
- [x] **DV-CR04 — Fix pagination-dot scrolling/overflow while preserving their visual role.** The owner-supplied reference renders all dots in one non-wrapping flex row and gives them no scrolling/navigation behavior. Keep the compact inactive dots + elongated active marker, but ensure larger card sets stay within the component, the active marker remains visible as the deck cycles, and dot movement never competes with the drag/restack interaction.
- [x] **DV-CR05 — Make the drag interaction discoverable without reviving redundant host navigation.** With one card the current page shows only one small blue pill; with multiple cards, the layered deck/dots/cursor/appropriate supporting affordance must make it evident that the stack can be dragged. Do not solve discoverability by restoring the rejected previous/next or mode-switch controls.
- [x] **DV-CR06 — Remove/reconcile dormant alternate deck state.** `CreditCardPage` still carries `CardDeckMode`, previous/next selection code and rendered host-control markup that CSS hides with `.credit-card-view-controls{display:none}`. The future implementation should have one coherent navigation model rather than invisible competing product state.
- [x] **DV-CR07 — Rebalance provider mark, nickname and card-type hierarchy.** In current rendered evidence the Piraeus provider mark dominates the card face. Preserve dynamic provider assets and the canonical card surface, but restore the compact card-identity hierarchy seen in the canonical reference; do not hard-code a Piraeus-only artwork workaround.
- [x] **DV-CR08 — Rework top-level Credit action hierarchy when the add-card path is restored.** The current header already presents Archive, Edit card, Secure details, Repayment and New purchase as five large actions. Adding the missing create-card action must not produce six equally prominent CTAs. Preserve every capability while separating transactional primary actions from card-management actions.
- [x] **DV-CR09 — Flatten redundant host surfaces around the canonical card.** The canonical payment card should remain the focal physical object. The current outer Credit stage plus independently bordered card-stage and stats surfaces create unnecessary panel-on-panel framing. Simplify the host composition without changing canonical card geometry, motion, vault controls or finance semantics.
- [x] **DV-CR10 — Raise surrounding Credit data readability without changing canonical card typography.** Purchase/repayment table headers, secondary descriptions and statement metadata are visually small in the 1440 desktop capture. Improve the host-page dense-data scale and scanability while leaving the owner-approved card-face typography/geometry untouched.
- [x] **DV-CR11 — Disable stack choreography when only one active credit card exists.** A one-card state must render as one card, not as a simulated deck: no layered back-card offsets, vertical drag-to-cycle, restack transition, ghost layer or stack pagination motion. Preserve only the subtle desktop pointer-follow tilt as the card-position interaction; card-local reveal/copy/archive feedback remains independent.
- [x] **DV-CR12 — Restore card-local editing parity with debit/prepaid cards for the active credit card.** The underlying Credit page already has `CardCreateDialog` profile editing (`Επεξεργασία κάρτας`) and `CardDetailsDialog` vault editing (`Ασφαλή στοιχεία`) at page-header level, so this is not a missing persistence/vault capability. The parity gap is inside the canonical credit-card object: `CanonicalCreditCardStack` currently exposes only reveal/copy/archive controls, while `InteractivePaymentCard` also exposes direct profile edit and secure-details edit. Add discoverable edit affordances for the **active/top credit card** that open the same canonical dialogs for nickname/provider/design/network and PAN/expiry/CVV respectively. Do not attach active controls to background stack layers, do not create a second vault/edit implementation, and do not let these controls interfere with pointer tilt, vertical drag/restack, copy/reveal or archive gestures. Reconcile placement with DV-CR08 so the solution does not simply duplicate the same actions in both an overloaded page header and an overloaded card toolbar.

### Credit animation implementation acceptance

- Acceptance covers both a **single-card fixture** and a deterministic **four-or-more-card fixture**.
- With exactly one active credit card, the card has no stack depth/restack/swipe/ghost/follower animation; non-touch pointer-follow tilt remains active.
- Vertical pointer drag visibly moves the front card and progressively advances follower layers before release.
- Both upward and downward committed drags cycle the deck and produce the correct next active card.
- Cancelled/sub-threshold drag returns to the original settled stack without order mutation.
- Restack has no one-frame disappearance, layer pop, clipping, duplicated interactive card, stale ghost or abrupt finance-panel switch.
- Pointer-follow tilt is present on non-touch pointers and does not fight drag or archive mode.
- The active selected card, active dot and finance summary/history resolve to the same card after the animation settles.
- Pagination remains contained and the active dot remains visible for long card sets; the known reference dot-scroll defect is not reproduced.
- Keyboard Arrow Up/Down continues to cycle the focused stack; Escape continues to cancel armed archive confirmation.
- Reduced-motion mode remains fully functional with the same resulting card order/state.
- Host layout at 1440, 1920 and 2560 leaves enough overflow-safe breathing room for transforms/shadows and does not crop the moving card or back layers.
- The active/top credit card provides direct, discoverable profile editing and secure PAN/expiry/CVV editing using the same canonical dialogs/vault path as debit/prepaid cards; background stack cards expose no active edit controls until they become top/active.
- Editing a card preserves its stable card ID, statements, purchases, repayments, stack order/selection semantics and encrypted vault boundary; changing presentation/profile data must not rewrite financial history.
- No horizontal/stack switcher or previous/next host navigation is reintroduced unless the owner explicitly reverses the #327 decision.

---

## 4. Loans / Installments

Status: visual/source findings recorded; implementation not started.

### Historical/owner constraints

The current Loans desktop composition is **not** a failed redesign to replace wholesale. PR #321 implemented and verified the owner-approved desktop target and the current #519 audit explicitly notes that Loans became more readable after the wide-layout remediation.

Future corrections must therefore preserve:
- the spacious desktop obligation-row composition rather than re-compressing it into dense legacy cards;
- the segmented installment-progress treatment;
- the owner-approved continuous blue → violet → green gradient under neutral unpaid segments, revealed progressively by real completion;
- the distinction between active obligations and completed history;
- current payment/edit/self-loan/forgiveness semantics.

### Planned corrections

- [x] **DV-L01 — Control wide-desktop scan distance without re-compressing the approved layout.** At 1440px the active obligation cards already span almost the full content width, with identity/balance at the top and metadata/actions distributed across a long horizontal measure. The desktop CSS uses a full-width `minmax(0,1fr) auto` row with flexible metadata cells and no inner max measure, so 1920/2560 will increase eye travel further. Keep the full, spacious card shell but constrain/rebalance the inner information measure so identity, progress, stats and actions remain a coherent reading unit on large monitors.
- [x] **DV-L02 — Raise secondary loan metadata readability, especially in Dark.** Provider/type text, installment-stat labels, section helper copy and toolbar counts are visually very small relative to the large card surfaces; Dark theme also pushes several of these labels too far into low-emphasis contrast. Increase readable dense-data scale/contrast while preserving the approved hierarchy and card dimensions.
- [x] **DV-L03 — Fix false progress semantics for loans with more than 60 installments while preserving the approved gradient.** The current renderer caps visual segments with `Math.min(loan.installments,60)` but marks a segment paid using `index < paid`. For a loan with more than 60 installments, reaching 60 paid installments can therefore make all 60 visible segments look complete even while real installments remain. Keep the owner-approved gradient/reveal concept, but map capped visual buckets proportionally to true `paid / total` progress (or otherwise ensure the visual can never show 100% before the obligation is actually complete); ARIA/text totals remain authoritative.
- [x] **DV-L04 — Make an empty Completed section proportionate to its value.** When there are zero completed obligations, the page still reserves a full bordered disclosure row with explanatory copy and a zero count. Preserve the completed-history entry point, but make the zero-history state visually lighter/shorter so it does not compete with active obligations.
- [x] **DV-L05 — Reduce duplicate explanatory surface weight while preserving the accounting warning.** The page header already explains that payments occur only when the user records them, and the full-width bottom information panel repeats the closely related rule that progress reflects only recorded payments. Keep the semantic warning available and explicit, but avoid giving repeated guidance the same visual weight as active financial content.

### Loans implementation acceptance

- The owner-approved spacious desktop composition remains recognizable; no return to compressed legacy loan cards.
- 1440, 1920 and 2560 desktop widths remain readable without excessive horizontal eye travel.
- Loan identity, outstanding balance and payment CTA stay the strongest information/action hierarchy.
- The segmented progress bar retains the approved blue → violet → green reveal treatment.
- Visual progress is mathematically truthful for 1–60 installments **and** for obligations with more than 60 installments; it never appears fully paid while installments remain.
- Light/Dark expose the same hierarchy, with readable secondary metadata.
- Completed history remains discoverable but a zero-history state does not dominate the page.
- Existing loan accounting, payment, edit, self-loan and forgiveness behavior remains unchanged.

---

## 5. Lending / Receivables

Status: visual/source findings recorded; implementation not started.

### Historical/owner constraints

The current Lending desktop master/detail model is an approved improvement, not a layout to replace. PRs #325/#328 implemented and verified the owner-approved desktop target, and issue #519 explicitly records that the master/detail composition is stronger than the older single-summary-card layout.

Future corrections must preserve:
- the left-side people master list and selected-person detail model;
- selected-person metrics and filtered movement history;
- the privacy toggle and privacy-first default;
- canonical lending/repayment event semantics and Quick Add integration;
- the existing mobile surface, which is outside this desktop audit.

### Planned corrections

- [x] **DV-LE01 — Stabilize the master/detail proportions on wide desktop.** The approved 1440 layout uses `grid-template-columns:minmax(320px,.72fr) minmax(0,1.48fr)`, so both the people master column and detail area continue expanding on 1920/2560. Preserve the master/detail relationship, but cap/rebalance the inner content widths so the people list does not become unnecessarily wide and the selected-person metrics/history do not develop excessive horizontal scan distance.
- [x] **DV-LE02 — Reduce dead visual volume in low-person-count states without breaking the aligned master/detail composition.** The people panel has a fixed desktop `min-height:438px`; with the current one-person fixture, most of the left column is an empty white/dark surface. Keep vertical alignment with the detail stack, but make sparse states feel intentional rather than unfinished—for example through more adaptive internal spacing/content treatment rather than simply collapsing the approved structure.
- [x] **DV-LE03 — Make privacy masking visually coherent with the promise of “Απόκρυψη στοιχείων”.** In the privacy-hidden desktop evidence, names and monetary values are masked but the generated avatar initials remain fully visible. For recognizable contacts, initials can still expose identity. Preserve the privacy-first behavior, but ensure identity decoration and sensitive detail presentation are consistently masked/neutralized when privacy is off, without destroying list usability.
- [x] **DV-LE04 — Stop using destructive/error red as the primary visual language for ordinary “Του δίνω” lending actions.** The normal outward lending quick action and history badge currently use `--error` / `--error-bg`, which visually reads like validation failure or destructive action even though creating a lending movement is routine domain activity. Preserve directional distinction from repayments, but use transaction-direction semantics rather than danger semantics; keep true warning/destructive color for forgiveness/deletion/error states.
- [x] **DV-LE05 — Raise dense history and helper-text readability, especially in Dark.** The history heading/helper, table headers, people-status copy, metric labels and quick-action helper text are small relative to the available desktop area, and several low-emphasis Dark labels approach the minimum useful contrast. Improve dense-data typography/contrast while preserving the approved compact master/detail hierarchy.

### Lending implementation acceptance

- The approved people-list → selected-person detail → selected-person history flow remains intact.
- 1440, 1920 and 2560 desktop layouts retain intentional master/detail proportions without an oversized people rail or over-stretched history table.
- Sparse one-person and richer multi-person fixtures both look deliberate; the master panel does not read as a large empty card.
- Privacy-hidden and privacy-visible states are both directly inspected in Light and Dark.
- Privacy-hidden state does not expose person identity through unmasked avatar initials or other decorative identity cues.
- Ordinary lending/repayment direction remains easy to distinguish without styling normal lending as an error/destructive action.
- History columns remain dense but readable; selected-person identity, current receivable and primary actions retain strongest hierarchy.
- Canonical lending, repayment, account, history and Quick Add behavior remains unchanged.

---
## 6. Recurring / Subscriptions

Status: visual/source findings recorded; implementation not started.

### Historical/owner constraints

The current Recurring desktop composition is an approved target, not a page to redesign from scratch. PRs #330/#331 implemented and verified the current hierarchy: concise heading, two summary cards, category-grouped active recurring obligations, linked long-term loan obligations in the same operational workspace, and compact inactive history.

Future corrections must preserve:
- the two-summary-card overview;
- category-grouped active recurring obligations;
- linked long-term loans inside the same recurring-obligations workspace while preserving the canonical loan payment path;
- payment/edit/pause/stop/reactivate semantics;
- actual recurrence intervals and account/category metadata;
- the compact inactive-history concept.

### Planned corrections

- [x] **DV-RC01 — Keep the approved structure but control wide-desktop measure.** The summary cards, active workspace and linked-loan rows all expand to the full available content width. At 1920/2560 the two summaries become very wide and the fixed-percentage operational columns increase scan distance. Preserve the full-width page composition, but constrain/rebalance the inner information measure so the summaries and recurring rows still read as coherent units rather than stretched desktop bands.
- [x] **DV-RC02 — Normalize summary-value hierarchy across native text and `AnimatedAmount`.** In current 1440 evidence the next-payment date is rendered as a strong large summary value while the monthly-equivalent amount appears materially smaller, despite both occupying equivalent summary cards and the desktop CSS intending the same 27px value treatment. Ensure animated monetary values inherit the summary-card value typography so the two cards have intentional, equivalent metric hierarchy.
- [x] **DV-RC03 — Clarify row action hierarchy without removing lifecycle controls.** Each recurring row exposes Payment plus Edit, Pause and Stop in one right-aligned cluster, while linked-loan rows expose Payment plus a very low-emphasis `Προβολή`. Preserve all actions, but make Payment the unmistakable primary operational action and lifecycle/navigation controls secondary and visually consistent across recurring and linked-loan rows.
- [x] **DV-RC04 — Reduce repeated cadence metadata and improve dense-data readability.** The recurring name column shows cadence, and the next-payment column repeats cadence again alongside typical day / last payment / renewal information. At the same time these supporting lines are very small, especially in Dark. Keep all useful schedule facts, but remove avoidable repetition and improve secondary typography/contrast so the row is easier to scan.
- [x] **DV-RC05 — Make the zero inactive-history state lighter.** When there are no paused/stopped items, `Παγωμένα & ανενεργά` still occupies a full bordered disclosure surface with helper copy and a zero badge. Preserve the history entry point and its collapsed behavior, but reduce the zero-state visual weight so active obligations remain dominant.

### Recurring implementation acceptance

- The #331 approved page hierarchy remains recognizable.
- 1440, 1920 and 2560 desktop layouts preserve readable summary and table proportions without excessive horizontal eye travel.
- Monthly-equivalent amount and next-payment date use equivalent intentional summary-value hierarchy.
- Payment remains the strongest per-row action; edit/pause/stop/navigation remain accessible but secondary.
- Category grouping and linked-loan grouping remain visually distinct without becoming separate competing workspaces.
- Recurrence cadence, next date, account, amount and lifecycle state remain easy to scan in Light and Dark.
- Zero inactive history is discoverable but visually subordinate.
- Existing recurring calculations, real recurrence intervals, linked-loan payment behavior and lifecycle semantics remain unchanged.

---
## 6A. Recurring/service branding — custom logos

Status: owner-requested functional enhancement recorded; implementation not started.

### Owner requirement

When creating or editing a recurring item/subscription, the owner must be able to upload a logo (for example Netflix), later replace it, or remove it. The chosen logo follows that recurring item and is rendered wherever that specific item is shown and a brand mark is useful.

This is **not** a financial-provider feature. Netflix/Spotify/utilities/etc. must not be inserted into the bank/financial-provider registry merely to obtain artwork. The implementation should reuse the proven image-upload security/storage mechanics from the provider-branding system while keeping a separate recurring/service-brand asset domain.

### Planned implementation

- [x] **DV-RB01 — Add an optional stable logo reference to the canonical RecurringItem contract and relational persistence.** Extend the recurring-item model/schema/RPC round-trip with an optional recurring/service logo asset reference. Persist only metadata/reference in FinanceData/relational state—never base64/binary image payloads inside financial state. Preserve revision/conflict/history behavior and backward compatibility for existing recurring items with no logo.
- [x] **DV-RB02 — Add a Storage-first recurring/service logo upload path using the existing security precedent.** Reuse the provider-branding upload constraints and validation mechanics: authenticated owner + AAL2 writes, bounded size, PNG/JPEG/WebP/SVG support, MIME + file-signature validation, unsafe active SVG rejection and no service-role credential in browser/Windows clients. Use a separate recurring/service asset namespace/contract rather than overloading `financial-provider-assets` semantics.
- [x] **DV-RB03 — Add logo management directly to New/Edit Recurring.** The existing recurring editor gains a clear optional `Λογότυπο` section with current preview and `Ανέβασμα`, `Αλλαγή` and `Αφαίρεση` actions. Upload may be selected while creating a new recurring item and must survive save; edit can replace/remove it later. Cancel must not leave the item pointing at a partially uploaded/invalid asset. No logo remains a valid state.
- [x] **DV-RB04 — Introduce one shared recurring/service brand-mark renderer with graceful fallback.** Render uploaded artwork with controlled square/rounded container, `object-fit:contain`, transparent-background support and theme-safe surrounding surface. If no logo exists, the asset is unavailable, or loading fails, fall back to the current canonical `FinanceIcon`/category icon rather than showing a broken image. Do not force light/dark logo variants unless later evidence demonstrates they are needed.
- [x] **DV-RB05 — Propagate the logo anywhere the identifiable recurring item is rendered.** Before implementation, inventory all call sites that render a specific recurring item by identity. Use the same brand-mark component in at least the active Recurring table/list, paused/inactive history and recurring payment/action flows, plus any Planning, Attention, Reports, Dashboard or other surface that renders that exact recurring item rather than only an aggregate category/total. Aggregate metrics that do not identify one service should remain icon/text based. Changing the logo must update every such surface consistently.
- [x] **DV-RB06 — Preserve lifecycle/history semantics while changing branding.** Pause, stop/reactivate and historical recurring records retain the recurring item's logo reference. Replacing/removing a logo changes presentation metadata only and must not rewrite payment/financial history. Asset cleanup must be reference-aware so replacing an image never deletes an object still referenced elsewhere; unavailable/orphaned assets degrade safely to the fallback icon.
- [x] **DV-RB07 — Validate create/change/remove and cross-surface rendering end-to-end.** Add source/domain/API tests plus rendered Light/Dark evidence for: existing item without logo, new item with uploaded logo, edit/replace logo, remove logo, reload/persistence, paused/inactive item, payment flow and every inventoried cross-page identity surface. Verify invalid/oversized/spoofed image rejection, unsafe SVG rejection, broken-asset fallback, owner/AAL2 enforcement and no finance revision/history regression.

### Recurring/service logo acceptance

- A new recurring item can be created with or without a custom logo.
- An existing recurring item can add, replace and remove its logo without changing financial semantics.
- A Netflix-style logo remains visually recognizable without being stretched/cropped and works in Light/Dark surrounding surfaces.
- The same saved logo follows the recurring item everywhere that item is explicitly identified.
- No-logo and failed-image states use the existing category/FinanceIcon fallback cleanly.
- Logos are stored as secured Storage-backed assets/references, not embedded binary strings in FinanceData.
- Financial-provider registry semantics remain limited to banks/fintech/wallet/payment providers; service brands are not fake providers.
- Existing recurring records require no migration-time owner action and continue rendering normally.

---
## 7. Planning / Forecast

Status: visual/source/history findings recorded; implementation not started.

### Historical/owner constraints

PR #336 implemented and verified the owner-approved Planning desktop target. Its operational model is materially stronger than the older page: scheduled lifecycle filters/history, account-level 30/60/90-day projections and canonical account routes must remain.

Issue #519 also records a specific hierarchy regression: the older aggregate forecast graph gave a clearer macro liquidity story. The current source still contains the previous Recharts aggregate portfolio forecast, powered by the same canonical `cashFlowForecast` data, but desktop CSS hides that legacy forecast panel in favor of the approved account-card view.

Future remediation therefore uses a **hybrid** model rather than reverting either version:
- keep the current scheduled-movements workspace and account-level forecast;
- restore one truthful aggregate portfolio trend as the primary macro visualization;
- retain the 30/60/90-day portfolio KPIs;
- keep deterministic forecast assumptions and existing scheduled lifecycle semantics;
- de-emphasize accounts whose projected path is flat/no-change instead of giving every account equal visual priority.

### Planned corrections

- [x] **DV-P01 — Restore an aggregate liquidity trend above the account-level forecast.** The current top `Πρόβλεψη συνολικής ρευστότητας` surface shows only three future point estimates (30/60/90 days), so the user cannot see the path between them or when known movements produce step changes. Reintroduce one aggregate portfolio trend using the existing canonical `cashFlowForecast` points/portfolio series, while keeping the current 30/60/90 KPIs and scheduled/account-level detail. Do not resurrect the entire legacy forecast page.
- [x] **DV-P02 — De-emphasize flat/no-change accounts and prioritize material/risky trajectories.** The current chart view renders every forecast account as an equal-weight card, including many perfectly flat accounts, producing 10+ similarly prominent tiles. Preserve access to every account, but let changing, low-threshold or negative-risk accounts carry stronger visual weight while stable accounts become quieter/denser. Do not hide financial accounts or alter forecast values.
- [x] **DV-P03 — Replace decorative index-based sparkline tones with meaningful visual semantics.** Account-card sparkline colors currently rotate by `index % 4` (blue/green/orange/violet), unrelated to account meaning or forecast risk. Flat/stable, changing-positive, low-balance and negative trajectories should not be visually encoded by arbitrary list position. Keep bank/provider branding separate from forecast-state semantics.
- [x] **DV-P04 — Remove the false navigation affordance from forecast account cards.** Every account forecast card renders a right-facing chevron, but the card is a non-interactive `article` with no click/navigation behavior. If an already accepted/reachable account-forecast detail action exists in the canonical product flow, connect the affordance to that accessible action. Otherwise remove/restate the chevron as non-interactive decoration. **Do not invent a new navigation destination solely to justify the existing chevron.**
- [x] **DV-P05 — Make `Αναλυτική πρόβλεψη` produce immediate, visible feedback.** The top forecast button toggles `detailsOpen`, but the revealed `planning-approved-details` block is rendered only after the full scheduled/account sections and bottom note. On a long desktop page the user can click the top control and see no nearby visual change. Keep the analytical assumptions/details, but connect the control to an immediately perceivable expansion/navigation/focus result; the restored aggregate graph should remain distinct from textual assumptions.
- [x] **DV-P06 — Preserve the approved four-column rhythm at standard desktop and prevent uncontrolled auto-fit expansion on large monitors.** The account forecast grid uses `repeat(auto-fit,minmax(190px,1fr))`; at 1440 it gives the approved four-column rhythm, but at 1920/2560 it can proliferate into many narrow equal-weight columns and further weaken hierarchy. Keep the target-like rhythm and account readability with bounded columns/inner measure, while improving the very small horizon labels/values and Dark secondary contrast.

### Planning implementation acceptance

- The current scheduled-movement lifecycle/filter/history workspace remains intact.
- One aggregate portfolio forecast trend clearly communicates the macro 30–90 day liquidity path using canonical forecast data.
- The 30/60/90 portfolio KPIs remain visible and agree numerically with the aggregate chart.
- Account-level forecast remains available in chart/card and table form; no account is silently omitted.
- Flat/no-change accounts are visually quieter than accounts with material movement, low-balance dates or negative projections.
- Forecast colors communicate state/risk intentionally and are not assigned by list index.
- Account-card chevrons/actions have truthful interaction semantics.
- `Αναλυτική πρόβλεψη` gives immediate visible feedback and does not appear to do nothing because content opened far below the viewport.
- 1440 retains the approved four-column account rhythm; 1920/2560 remain balanced rather than adding uncontrolled columns.
- Light/Dark retain readable horizon labels, amounts, statuses and chart/grid lines.
- `cashFlowForecast`, scheduled create/complete/skip/cancel semantics, audit history and finance/accounting behavior remain unchanged.

---
## 8. Attention / Review

Status: visual/source/history findings recorded; implementation not started.

### Historical/owner constraints

PR #339 implemented and verified the owner-approved desktop Attention target. The current four-way structure—Επείγοντα, Σύντομα, Εκκρεμότητες, Ενημερώσεις—plus direct per-item actions is materially stronger than the older generic attention list and must remain.

Future remediation must preserve:
- canonical `visibleAttentionItems` prioritization and action routing;
- snooze/dismiss decision semantics;
- privacy handling for amounts and sensitive identities;
- the four priority groups and summary counts;
- direct actionable paths into recurring, loans, credit, lending, budgets, forecast and transaction review.

### Planned corrections

- [x] **DV-A01 — Remove the false `Προβολή όλων` affordance when the whole group is already visible.** `ApprovedGroup` renders `Προβολή όλων` for every non-empty group, but groups with 4 or fewer items already render the complete set. In those cases the control only scrolls the already-visible rows into view and does not reveal anything. Show an expand/collapse control only when rows are actually truncated; otherwise omit it or use a truthful non-navigation count/label.
- [x] **DV-A02 — Fix the misleading all-clear message when non-urgent work still exists.** The bottom state uses only `counts.danger` to choose between `Η λίστα είναι ενημερωμένη` and `Όλα υπό έλεγχο!`. A page with zero danger but active warnings/pending items can therefore declare `Όλα υπό έλεγχο!` while still asking the user to act on several items above. Derive the message from total actionable state: reserve true all-clear language for zero active actionable items, and use a neutral `no urgent items` state when warnings/pending work remains.
- [x] **DV-A03 — Reduce vertical page inflation while preserving the four priority groups.** The 1440 desktop render is much longer than the viewport because every group receives a full header, table header, rows/empty row and large outer surface, followed by shortcuts, all-clear/tip and confirmation history. Preserve priority grouping and full action coverage, but tighten repeated chrome and use compact/collapsible treatment for low/zero-priority groups so urgent/actionable content stays closer to the top.
- [x] **DV-A04 — Make zero-count groups proportionate to their value.** `Ενημερώσεις (0)` still renders a complete group shell, column header row and empty-state row. Keep the category discoverable, but collapse a zero group to a compact summary/empty state rather than reserving table-level visual weight.
- [x] **DV-A05 — Rebalance per-row action hierarchy and dense text readability.** Each row can contain one bright primary action plus snooze and dismiss icon buttons while type, reason, context, amount and date are rendered at dense-data sizes. Preserve all actions, but make the domain action primary and snooze/dismiss visibly secondary without the right edge becoming a control cluster; raise reason/context/date readability, especially in Dark, without turning the rows into oversized cards.
- [x] **DV-A06 — Bound the table measure on 1920/2560 rather than stretching percentage columns indefinitely.** The approved row grid is defined with percentage/fractional columns and no inner maximum measure, so description/context/date/action scan distances increase as the shell grows. Preserve the desktop table model, but cap/rebalance the inner row measure and outer gutters so the content remains one coherent reading unit on wide monitors.

### Attention implementation acceptance

- The four priority groups and canonical item ordering remain intact.
- `Προβολή όλων` appears only when there are hidden rows and correctly expands/collapses them.
- True `Όλα υπό έλεγχο` language appears only when there is no active actionable item; zero-danger with warnings/pending uses accurate wording.
- Zero-count groups remain discoverable but do not render an unnecessary full table shell.
- Urgent and soon items remain visually dominant over informational/empty content.
- Per-row domain action remains immediately discoverable; snooze/dismiss remain available but secondary.
- Light/Dark dense row text remains readable.
- 1440/1920/2560 preserve controlled row measure/gutters and do not turn each attention row into a very long left-to-right scan.
- Existing attention generation, privacy, snooze/dismiss, confirmation-history and navigation semantics remain unchanged.

---
## 9. Reports / Analytics

Status: visual/source/history findings recorded; implementation not started.

### Historical/owner constraints

Reports is intentionally analytics-rich. PRs #341/#342 combined two owner-approved long-form references into one page and explicitly preserved executive KPIs, budget progress, six-month flow, category analysis, obligations, credit analysis, top counterparties/income, month comparison, account history and savings sources. That analytical coverage must remain.

Issue #519 identifies the regression correctly: the current page has stronger coverage than v1.3, but weaker executive hierarchy and substantially more vertical weight. The earlier verified Reports implementation from #159 had a stronger `financial picture` opening: one dominant net-flow hero, savings rate and month-over-month comparisons before deeper analytics.

Future remediation therefore follows a **hierarchy reconciliation**, not an analytics rollback:
- keep all current truthful analyses and drill-down capability;
- restore one clear first-screen financial picture;
- progressively subordinate management/detail sections;
- keep selected-period semantics canonical across every report;
- do not invent export/PDF/CSV controls without a real export implementation.

### Planned corrections

- [x] **DV-RP01 — Restore a strong top-level `financial picture` hierarchy instead of five equal KPI cards.** The current first analytical row gives income, expense, net flow, budget and savings almost identical visual weight. Reintroduce the stronger executive composition proven in the earlier Reports implementation: net operating flow as the dominant result, savings rate as the secondary outcome, and concise month-over-month deltas alongside them. Keep the current KPI values/analytics, but place supporting indicators beneath or around the primary financial story rather than treating all five as equivalent tiles.
- [x] **DV-RP02 — Make the no-budget state compact and action-oriented.** With no active budgets, the current `Προϋπολογισμοί · εικόνα περιόδου` area reserves a large full-width management surface for two lines of empty-state copy plus a collapsed management disclosure. Preserve direct budget creation/management, but collapse the zero state to a concise summary + clear setup action/disclosure so it does not push the actual financial analytics far below the fold.
- [x] **DV-RP03 — Reduce long-page repetition without removing analytical coverage.** The page currently sequences KPI strip, budget workspace, three large analytics panels, four support panels, three lower panels, account-history/savings panels and a footnote. Keep every unique analysis from #342, but group related metrics into clearer macro sections and use progressive disclosure/compact secondary presentation where appropriate so the page does not read as a continuous wall of equal-weight panels.
- [x] **DV-RP04 — Make privacy-hidden account history proportionate to the hidden state.** `Εξέλιξη βασικών λογαριασμών` reserves a large chart-sized panel even when balances are hidden and only a small `Πάτησε Εμφάνιση` placeholder is visible. Keep privacy-first behavior and the explicit reveal control, but collapse or purposefully compose the hidden state so it does not create a large empty rectangle. Revealing balances must restore the full chart without layout instability.
- [x] **DV-RP05 — Bound wide-desktop analytical measure and preserve deliberate column rhythm.** Current grids use full available width with three analytics columns, four support columns and fractional lower/account layouts. At 1920/2560 these can become overly wide, increasing chart/table scan distance and weakening hierarchy. Keep the desktop multi-column density, but apply bounded inner measure/gutters and deliberate column counts so charts and dense lists do not simply stretch with the canvas.
- [x] **DV-RP06 — Remove redundant period presentation while keeping one unambiguous selected month.** Reports already sits under the global reporting-period control; the page then repeats the same month in the eyebrow and a separate `Περίοδος` chip. Combined with the known full-width period-wrapper issue, this creates repeated chrome before any analytics. Keep the selected month unmistakable and accessible, but avoid three visually competing period indicators. The reporting-period control remains the canonical month-navigation mechanism.
- [x] **DV-RP07 — Raise dense analytical text/contrast without inflating the panels.** Category percentages, chart axes, panel helper text, recent-activity metadata, counterparties, obligation details, comparison cells and savings-source labels are visually small at 1440 and several Dark-theme secondary labels recede too far. Raise the dense-data typography/contrast to the shared readable scale while preserving compact analytical density and chart legibility.

### Reports implementation acceptance

- All unique analytics currently present in #342 remain available; no coverage is removed merely to shorten the page.
- The first viewport communicates the period's net financial outcome, savings result and primary comparison context before management/detail surfaces.
- Zero-budget state is compact and still provides a truthful path to budget management.
- Privacy-hidden account history does not reserve a large empty chart shell; revealed state restores the full canonical chart.
- The global reporting-period control is the navigation authority and Reports does not repeat the selected month through unnecessary competing chrome.
- 1440, 1920 and 2560 layouts preserve intentional gutters/column widths and readable charts rather than simply expanding panel widths.
- Light/Dark preserve readable chart axes, legends, metadata and dense lists.
- All report values remain derived from canonical finance selectors for the selected month; transfers, credit repayments and other neutral flows are not reclassified or double-counted.
- Existing budget CRUD/rules, privacy behavior, credit drill-down, account-history data and accessibility text alternatives remain functional.
- No unsupported export/print/download feature is introduced as visual decoration.

---
## 10. Transactions

Status: visual/source/history findings recorded; implementation not started.

### Historical/owner constraints

PR #310 implemented and verified the owner-approved Transactions desktop target. Its current structure is strong and should remain: four monthly summary metrics, one compact filter strip, dense ledger, selected-transaction detail rail, pagination and canonical legacy/event edit/delete behavior.

Future remediation must preserve:
- canonical monthly transaction scoping and reporting-period behavior;
- ledger-first desktop workflow and selected-row detail rail;
- split transaction disclosure;
- imported legacy override/tombstone semantics;
- per-row edit/delete behavior and Undo-compatible event deletion;
- category icons and canonical account/date balances;
- the current mobile surface, which is outside this desktop audit.

### Planned corrections

- [x] **DV-TX01 — Bound the ledger/detail workspace on wide desktop instead of letting the ledger stretch indefinitely.** At 1440 the approved ledger + ~310px detail rail is balanced. At `min-width:1400px` the detail rail is merely widened to 330–360px while the ledger consumes all remaining space, so 1920/2560 create very long category→description→account→date→amount scan distances. Preserve the ledger/detail architecture and 14-row density, but cap/rebalance the inner workspace measure/gutters so columns remain a coherent reading unit.
- [x] **DV-TX02 — Remove the shared false second-header/period-band effect from Transactions.** The current desktop render shows the same full-width mostly empty period wrapper already identified on Dashboard/Reports before the page heading. Keep the global month navigation and selected-period semantics, but style only the meaningful period controls rather than reserving a large blank surface band above the Transactions content.
- [x] **DV-TX03 — Make the row-selection affordance truthful.** Desktop rows are single-selected to drive the detail panel via `type="radio"`, but both the header marker and row radios are visually styled as square checkboxes. This implies multi-select/bulk actions that do not exist. Present the control as a radio/current-row selector, or remove the redundant first column and use row-selection styling/focus alone; do not suggest unsupported batch selection.
- [x] **DV-TX04 — Restore visible desktop transaction comments/secondary note content.** `noteParts()` separates the first line as title and remaining lines as comment, but the desktop ledger/detail path renders comments only in `sr-only` spans; the detail panel repeats only the title under `Περιγραφή`. The mobile surface does show the comment. Preserve accessible text, but expose meaningful comments visibly in the desktop detail panel (and optionally restrained ledger secondary text where density permits) so information entered by the owner is not visually lost.
- [x] **DV-TX05 — Make pagination window around the active page instead of hard-coding pages 1–5.** `visiblePages` is currently `Array.from({length:Math.min(pageCount,5)},(_,index)=>index+1)`. With more than five pages, Next can move to page 6+, but the numeric pager still displays only 1–5 and no active page number. Use a bounded moving window/ellipsis that always includes the current page while preserving previous/next and page-size controls.
- [x] **DV-TX06 — Treat transaction-count month-over-month change as neutral information, not automatically good/bad.** The `Συναλλαγές μήνα` summary colors any lower/equal count as positive and any higher count as negative. More or fewer transactions is not intrinsically financially positive/negative. Keep the comparison number/direction but use neutral/informational tone unless a domain rule gives the count an actual risk meaning.
- [x] **DV-TX07 — Raise dense filter/table metadata readability without losing the approved compact ledger.** Filter selects/date inputs, table headers, secondary account/category text and footer controls are visually small at 1440 and several Dark-theme labels are low-emphasis. Bring them to the shared dense-data/label readability floor while retaining the approved 14-row desktop density and avoiding larger row heights unless required for accessibility.

### Transactions implementation acceptance

- The #310 ledger/detail workflow and transaction engine semantics remain recognizable and unchanged.
- 1440 retains the approved compact 14-row ledger; 1920/2560 use controlled inner measure/gutters rather than excessively long columns.
- Global month navigation remains canonical and no large empty period band precedes the page.
- Single-row selection no longer visually implies unsupported multi-select/bulk selection.
- Multi-line transaction comments are visible in desktop details and remain accessible to assistive technology.
- Pagination always exposes the active page, including page 6+ datasets, while Previous/Next and page-size controls remain correct.
- Transaction-count deltas are neutral unless a real domain semantic justifies positive/negative tone.
- Light/Dark filters, headers, account/category metadata and footer controls remain readable at the approved density.
- Imported legacy edit/tombstone, event edit/delete, split disclosure, row-date balance, filtering and sort semantics remain unchanged.

---
## 11. Savings

Status: visual/source/history findings recorded; implementation not started.

### Historical/owner constraints

PR #314 implemented and verified the owner-approved Savings desktop target. The current action-first structure is materially stronger than the older savings surface and must remain: Pay & Save, manual transfer and complex saving as three canonical sources; real monthly trend; editable savings-rate target; savings sources/recent activity; and persistent personal goals.

Future remediation must preserve:
- all three canonical savings entry flows and no-double-count accounting semantics;
- the real cumulative savings trend rather than reverting to a decorative donut-only hero;
- editable monthly savings-rate target;
- personal goal create/edit/delete persistence;
- the explicit rule that personal goals compare against the shared positive savings balance and do not reserve separate funds;
- current mobile behavior, which is outside this desktop audit.

### Planned corrections

- [x] **DV-SV01 — Make selected-period wording truthful.** The page receives a selectable reporting `month`, but the main monthly card is hard-coded as `Αυτός ο μήνας`. When browsing a historical month, that copy is false. Use the selected month label (or `Αυτός ο μήνας` only when it is genuinely the current reporting month) consistently across the monthly amount, trend and target presentation.
- [x] **DV-SV02 — Make the Savings surface a temporally consistent selected-month snapshot.** Owner decision 2026-10-08: when a reporting month is selected, source/destination balances, personal-goal progress, monthly flow, breakdown and relevant trend context must all describe that selected month/period end. Historical-month browsing must not mix historical activity with today's balances/progress. Derive the applicable period-end date from the selected month, using current `asOf` only when the selected period is the current period and that is semantically equivalent. Add regression coverage proving historical months render historical balances/progress when data differs.
- [x] **DV-SV03 — Replace the fake-looking personal-goal placeholder row with a true compact empty state.** When no personal goal exists, the goals table renders `Δεν έχεις προσωπικό στόχο` as if it were a normal goal row and still displays the entire shared savings balance under `Αποταμιευμένα`. That can imply an unnamed goal owns those funds. Preserve the `Νέος στόχος` action, but render a concise empty state that explains the shared balance model without populating goal columns as though a goal existed.
- [x] **DV-SV04 — Make shared-pool goal semantics visually unmistakable.** Every personal goal currently shows progress against the same total positive savings balance. This is canonical and explicitly documented, but multiple personal progress bars can visually imply that the same funds are allocated independently to every goal. Keep the current accounting model, but strengthen the visual/copy distinction between `shared savings balance` and `goal target`; do not fabricate per-goal allocations.
- [x] **DV-SV05 — Bound the three-column hero and goals measure on 1920/2560.** At 1440 the month summary, trend chart and insight/source rail form a balanced approved composition. On wider desktops, the full-width hero and five-column goals table can stretch excessively. Preserve the three-part dashboard and goal table, but cap/rebalance inner widths/gutters so the chart, route cards and goal columns remain readable rather than simply expanding with the canvas.
- [x] **DV-SV06 — Remove internal product jargon from user-facing savings guidance and raise secondary readability.** The section subtitle currently tells the user that the three options use the same `canonical savings flow`, which is implementation terminology rather than product language. Replace it with plain-language semantics about being counted once toward savings. At the same time, raise small helper/legend/goal metadata contrast—especially in Dark—without inflating the approved compact composition.

### Savings implementation acceptance

- The three savings entry modes and canonical no-double-count semantics remain unchanged.
- Selected historical months never display misleading `Αυτός ο μήνας` copy.
- Monthly analytics and current account/goal state are either temporally aligned or explicitly distinguished in the UI; no silent mixed-frame presentation remains.
- No-goal state is a true empty state and does not look like an unnamed funded goal.
- Personal goal progress continues to use the shared savings balance model, but the UI cannot reasonably be read as separate money allocation per goal.
- 1440 retains the approved three-part hero; 1920/2560 retain intentional chart/summary/goals proportions.
- User-facing savings copy avoids internal `canonical` jargon and Light/Dark secondary text remains readable.
- Savings target changes, personal goal CRUD, Pay & Save/manual/cash-offset entry flows and historical finance semantics remain intact.

---
## 12. Settings

Status: visual/source/history findings recorded; implementation not started.

### Historical/owner constraints

Settings is structurally sound. The approved redesign sequence established a truthful tabbed information architecture: General, User & Access, Accounts, Categories, Icons, Rules and Data. Provider/account management, taxonomy retirement, icon assignment, transaction rules, backup/import and account security are real capabilities and must remain.

Future remediation must preserve:
- the current tab grouping and owner-approved General/Data visual language;
- provider/account management as distinct domain management rather than Cards-only configuration;
- secure backup/import confirmation and automatic-backup semantics;
- taxonomy identity/history preservation;
- real web/Windows capability differences rather than fabricated controls;
- owner-only/AAL2 boundaries where applicable.

### Planned corrections

- [x] **DV-ST01 — Retire the dead app motion preference and keep full motion as the product default.** Owner decision 2026-10-08: MyFinHub has **no user-facing or persisted motion setting**. Remove the dead `FinanceSettings.motion` product field/setting UI/normalization paths where safely possible, or migrate compatibility reads so they no longer behave as an active preference. The application uses the full approved motion language by default. Preserve `prefers-reduced-motion` as a mandatory OS-level accessibility override for non-essential spatial/staggered animation; it is not an app preference and must not be bypassed. Validate that no stale saved value can silently alter runtime motion before DV-M begins.
- [x] **DV-ST02 — Make Settings sub-tabs addressable/recoverable instead of purely ephemeral local state.** `activeTab` is local component state initialized to `general`; refresh/navigation cannot preserve or deep-link directly to Accounts, Categories, Icons, Rules or Data. Add a truthful route/query/hash contract (or another canonical addressable mechanism) so cross-page actions/help can land on the relevant Settings section and reload/back/forward behavior does not always reset to General. Preserve keyboard/tablist accessibility.
- [x] **DV-ST03 — Bound General and management-tab measure on 1920/2560.** The General tab uses two equal flexible columns plus a full-width shortcuts panel, and denser management workspaces use broad multi-column grids. At very wide desktop widths these surfaces can become unnecessarily long horizontally. Preserve the approved tab layouts, but apply deliberate inner max measure/gutters and column bounds so controls/readability do not simply stretch with the shell.
- [x] **DV-ST04 — Separate product-default visual QA from developer/support diagnostics evidence.** Current Final Visual Settings evidence is produced with `SupportDiagnosticsPanel` visible because the QA runtime enables development/support diagnostics. That creates an extra half-width panel and empty right-side canvas that normal production users may never see. Keep diagnostics available for dev/support builds, but ensure the normal Settings visual baseline is captured with diagnostics disabled, with a separate targeted diagnostic-state fixture when that panel itself needs QA.
- [x] **DV-ST05 — Add deterministic desktop visual coverage for every Settings tab before calling Settings visually closed.** The current Final Visual route proves only the default General tab. Future remediation/acceptance must directly render and inspect User & Access, Accounts/provider management, Categories, Icons, Rules and Data in Light/Dark desktop, including representative populated and destructive/confirmation states. Fix only defects demonstrated by those captures; do not re-audit approved tabs by assumption or invent unsupported controls.

### Settings implementation acceptance

- Settings retains the approved seven-tab information architecture and existing management capabilities.
- Motion has one explicit product contract: there is no user-facing or persisted app motion preference. Any legacy `FinanceSettings.motion` compatibility read must be inert and must not alter runtime behavior. `prefers-reduced-motion` remains the authoritative accessibility override for non-essential motion.
- Direct links/navigation can open the intended Settings tab and browser reload/back/forward do not ambiguously reset the user's destination.
- 1440/1920/2560 maintain controlled form/panel measure without oversized horizontal dead space.
- Product-default Settings visual QA excludes dev-only diagnostics; diagnostics have their own explicit fixture/state.
- Every Settings tab has directly inspected Light/Dark desktop evidence before closure.
- Backup/import, security, provider/account management, taxonomy, icon assignment and rules semantics remain unchanged unless the later DV-FB reconciliation finds a concrete contract defect.

---
## Penultimate implementation — Frontend/backend functionality and contract reconciliation

Status: **active, unaccepted** after page-specific remediation; FB validation gate under implementation. The DV-M pass remains blocked.

### Purpose

Before motion polish, perform a zero-assumption cross-stack audit of the current MyFinHub product so animation is not layered on top of missing, unreachable, local-only, ambiguous or incorrectly persisted functionality.

This is broader than visual QA. For every owned finance domain and user-facing action, trace the complete path:

`visible frontend affordance → frontend handler/state → domain transformation → API/server validation → Supabase/RPC/storage persistence → revision/history/audit behavior → reload/new session → rendered result`.

The inverse must also be checked: backend/domain capabilities that exist but have no reachable, truthful frontend path must be identified. Hidden CSS controls, dormant state, obsolete alternate modes and dead handlers count as ambiguity until deliberately removed or made reachable.

Scope includes MyFinHub web, backend/API, Supabase integration/migrations and Windows/desktop behavior. **Do not modify the separate Android repository.** If a backend/API correction has Android compatibility implications, document the contract impact for the Android owner/workstream without editing Android code.

### Planned reconciliation

- [ ] **DV-FB01 — Build a domain-by-domain capability/reachability matrix from live source, not assumptions.** Cover accounts, transactions, savings/goals, debit/prepaid cards, credit cards/statements/vault, loans/installments, lending/receivables, recurring/subscriptions, scheduled/planning, Attention/review, reports/budgets/rules, settings/provider/account management, backups/history/undo-redo and asset uploads. For each capability record create/read/edit/archive/delete/restore/pay/complete/skip/cancel/snooze/dismiss/reveal/copy or other applicable actions, the actual frontend entry point, handler/domain owner, persistence owner and reload result.
- [ ] **DV-FB02 — Find backend/domain capabilities that are implemented but unreachable or materially undiscoverable in the frontend.** Search exported handlers, dialogs, domain operations, API endpoints/RPCs and persisted fields against actual rendered routes/actions. Classify each gap as intentional internal capability, intentionally deferred capability, or missing user reachability. The already-confirmed Credit second-card creation gap is the model example; do not stop after known findings.
- [ ] **DV-FB03 — Find frontend controls/state that imply functionality the backend/domain contract does not actually provide.** Audit buttons, toggles, chevrons, menus, hidden-by-CSS controls, local-only state, optimistic UI, disabled branches and alternate modes for cases where an affordance does nothing meaningful, mutates only transient state, is never persisted, or promises semantics not supported server-side. Remove dead ambiguity or connect it to the canonical contract; do not merely unhide dormant controls.
- [ ] **DV-FB04 — Verify full persistence round-trip for every mutable domain.** For representative create/edit/lifecycle actions, prove the value survives save, revisioned write, reload, sign-out/sign-in/new session and relevant derived views. Confirm optional/new fields are not silently dropped by TypeScript serialization, API parsers, Supabase RPC/schema, migration/default logic or older seed/override merge paths. Any future recurring-logo reference must pass this same round-trip gate.
- [ ] **DV-FB05 — Reconcile frontend-derived semantics with persisted/backend semantics.** Check reporting-period/as-of scoping, balances, statement assignment, recurring lifecycle, loan progress, lending balances, budgets, forecasts, category rules and attention generation for cases where frontend selectors use a different date/state interpretation than persisted or backend-owned semantics. The Dashboard selected-month account bug is the model example. One concept must have one authoritative meaning across layers.
- [ ] **DV-FB06 — Audit security/authorization parity for sensitive and mutating operations.** Every sensitive frontend action must map to the required owner authorization, mandatory TOTP/AAL2, RLS and server validation. Re-check card-vault reveal/update/delete, provider/service asset uploads, account/provider administration, backups/history, destructive or permanent-delete paths and any new API surface. No browser/Windows code may gain privileged service-role behavior or bypass revision/security boundaries.
- [ ] **DV-FB07 — Audit error, conflict, loading and recovery contracts end-to-end.** For API/RPC failures, revision conflicts, history-generation conflicts, MFA requirements, invalid input, missing vault data, unavailable assets and network failures, verify the frontend distinguishes actionable states instead of swallowing errors, leaving stale optimistic UI, or reporting success before persistence. Retry/reload guidance must match what the backend actually guarantees.
- [ ] **DV-FB08 — Reconcile schema/type/API/migration contracts and remove ambiguous drift.** Compare canonical TypeScript domain types, frontend write payloads, server parsers, RPC/table definitions, migrations, enum/nullability/default rules and compatibility shims. Flag fields that exist in only one layer, obsolete legacy aliases that can now be removed safely, and duplicated representations whose precedence is unclear. Preserve non-destructive history and migration compatibility; do not perform destructive reset/re-import.
- [ ] **DV-FB09 — Verify web/Windows behavior and API compatibility at the repository boundary.** Confirm Windows/desktop reaches the same canonical persistence/security semantics as web for affected capabilities and that repository-owned API changes do not create silent client divergence. Use automated Windows/browser gates and artifact inspection; no physical-device/manual-hardware requirement. If an API change affects the separate Android app, record the compatibility impact without modifying Android.
- [ ] **DV-FB10 — Close the reconciliation gate before starting motion work.** Every discovered gap must be either fixed and validated, explicitly documented as intentional/deferred with no misleading UI, or added to the active remediation plan with owner-approved blocking status. Run the narrowest domain tests first, then the repository-required API/database/security/rendered/Windows gates justified by the changed surface. The final motion batch may start only when no known unclassified frontend/backend reachability, persistence or contract ambiguity remains.

### Reconciliation acceptance

- Every user-visible mutable capability has a traced and tested persistence path to the canonical backend/store and back to the UI after reload.
- No backend/domain capability intended for owner use is silently unreachable from the normal product flow.
- No visible or focusable frontend control promises behavior that is dead, CSS-hidden elsewhere, local-only, or unsupported by the backend contract.
- Date/reporting-period, lifecycle and finance semantics agree across selectors, domain logic, persistence and rendered summaries.
- Security-sensitive operations preserve owner authorization, AAL2, RLS, revision/conflict and vault boundaries.
- Error/success states reflect actual persistence outcomes rather than optimistic assumptions.
- Type/schema/API/migration fields round-trip without silent loss or conflicting precedence.
- Web and Windows use compatible canonical semantics; Android impact is documented only when relevant and the Android repository remains untouched.
- All confirmed reconciliation gaps have durable tests/tracking before the motion pass begins.

---
## Final implementation — Cross-page motion and content entrance pass

Status: explicitly planned as the **last remediation implementation batch**, after page-specific corrections **and after the frontend/backend reconciliation gate** are complete; implementation not started.

### Purpose

After the page-by-page remediation is finished, perform one app-wide motion review. The goal is not decorative animation. Motion must communicate hierarchy, loading completion and state change, consistent with `docs/UX_STANDARDS.md`: motion is purposeful and `prefers-reduced-motion` disables non-essential animation.

PR #186 already established route-shaped skeletons, loading-shift QA and CLS <= 0.10 expectations. This final pass must **build on that system rather than replace the skeletons**. The missing layer is the transition from a valid skeleton/loading state into populated lists, grids, cards and other content.

### Planned motion implementation

- [ ] **DV-M01 — Inventory every audited page for meaningful motion opportunities.** Review route entry, skeleton → content, populated lists/tables/grids, expanding disclosures, filter/sort changes, inserted/removed items, summary changes and existing specialized interactions. Add motion only where it clarifies hierarchy/state; explicitly leave static elements static when animation adds no information.
- [ ] **DV-M02 — Add a shared content-entrance primitive for lists, tables, grids and card collections.** After real data replaces the skeleton, rows/cards should enter with a restrained opacity + small-position transition and short bounded stagger rather than appearing all at once. Reuse one shared motion contract instead of page-specific keyframes. The first visible items may stagger; large collections must cap the stagger so a 20–100-row list never waits for a long animation chain.
- [ ] **DV-M03 — Make skeleton → populated-content handoff feel continuous without fake loading.** Do not add artificial delays. Content begins as soon as data is ready, with skeleton removal and content entrance coordinated so there is no flash, double-render animation, layout jump or skeleton/content overlap. Preserve the existing route-shaped skeleton fidelity and CLS <= 0.10 loading-shift contract from #186.
- [ ] **DV-M04 — Add restrained state-change motion where it improves comprehension.** New/removed list rows, expanded history groups, filter/sort result changes and similar structural updates may use short enter/exit/reposition transitions so the user can track what changed. Do not animate finance semantics in a way that implies false intermediate values, delays actions, blocks input, or causes table/grid geometry to wobble.
- [ ] **DV-M05 — Preserve reduced-motion and performance invariants.** The product uses full approved motion by default and has no app-level motion preference. Respect the OS `prefers-reduced-motion` signal as the mandatory accessibility override: reduced motion should remove non-essential translation/stagger and use instant or minimal non-spatial feedback as appropriate. Avoid expensive blur/layout animations, animate compositor-friendly properties where possible, and prevent simultaneous animation of very large off-screen collections.
- [ ] **DV-M06 — Visually validate motion, not only source-test it.** Add deterministic rendered evidence for representative list-heavy and card/grid-heavy pages in Light/Dark desktop, including skeleton state, first populated frame, mid-entrance and settled state. Directly inspect for jank, flashing, clipping, delayed interactivity, focus movement, duplicate animation after sorting/filtering and correct reduced-motion behavior.

### Cross-page motion acceptance

- Existing skeletons remain; content entrance complements them rather than replacing them.
- Populated lists/grids/cards do not abruptly pop into existence when a restrained entrance can improve continuity.
- Animation duration/stagger remains short and bounded regardless of collection size.
- No artificial loading delay is introduced.
- Interactions are usable immediately when data is ready.
- Sorting/filtering/mutations do not replay an excessive whole-page entrance animation.
- Focus, keyboard navigation and screen-reader semantics are unaffected.
- Reduced-motion mode remains complete and functional with non-essential movement removed.
- Loading-shift/CLS requirements from #186 are not weakened.
- Page-specific canonical motion contracts, especially the Credit card stack, remain authoritative and are not overwritten by the generic entrance system.

---
## Rolling audit/change log

### 2026-10-07
- Created rolling desktop visual remediation plan under issue #519.
- Added Dashboard findings DV-D01 through DV-D10.
- Recorded explicit owner constraints: keep Dashboard graphs and fix large-screen desktop responsiveness.
- Refined Dashboard account scope from owner screenshot/feedback: spacing/wide-screen lateral positioning, removal of the unwanted logo wrapper/halo, correct provider-logo rendering and selected-month account data/chart behavior are guaranteed corrections, but they are not an exhaustive acceptance of the remaining visual composition. Restored explicit follow-up validation for account hierarchy/actions after those guaranteed fixes. Source inspection confirmed the month bug is caused by account balances/history remaining anchored to `asOf`/`balanceMonth` while page analytics use the selected `month`.
- Added Cards findings DV-C01 through DV-C09.
- Added Credit findings DV-CR01 through DV-CR10 after reviewing current Light/Dark desktop evidence, the current component/source, PRs #155/#263/#323/#327, issues #322/#326 and the owner-supplied canonical stack HTML.
- Added DV-CR11 from owner direction: a single active credit card must not animate as a stack; only the non-touch pointer-follow tilt remains as card-position motion.
- Added DV-CR12 from owner feedback: Credit must expose card-local profile and secure-detail editing parity with debit/prepaid cards. Source inspection confirmed the dialogs/vault paths already exist at page level; the missing parity is that `CanonicalCreditCardStack` exposes reveal/archive but not direct edit/secure-detail controls on the active card.
- Recorded the Credit animation as an explicit interaction contract: native vertical drag/restack remains the sole rendered card-switching model; the supplied reference's dot-scrolling defect is excluded from fidelity requirements.
- Added Loans findings DV-L01 through DV-L05 after reviewing current Light/Dark desktop evidence, current source/CSS and the verified owner-approved #321 desktop target. The plan explicitly preserves the spacious layout and segmented gradient progress treatment rather than re-compressing the page.
- Added Lending findings DV-LE01 through DV-LE05 after reviewing current Light/Dark desktop evidence, source/CSS and the verified owner-approved #325/#328 master/detail target. The plan preserves the master/detail model while addressing wide-screen proportions, sparse-state dead volume, privacy-mask coherence, normal-action color semantics and dense-data readability.
- Added Recurring findings DV-RC01 through DV-RC05 after reviewing current Light/Dark desktop evidence, source/CSS and the verified owner-approved #330/#331 target. The approved grouped obligations + linked-loan structure remains authoritative.
- Added owner-requested recurring/service branding batch DV-RB01 through DV-RB07: optional upload/change/remove logo during recurring create/edit, secure Storage-first persistence, shared fallback renderer and consistent logo propagation to every surface that renders the specific recurring item. The plan explicitly keeps service brands separate from the financial-provider registry while reusing its upload-security precedent.
- Added Planning findings DV-P01 through DV-P06 after reviewing current Light/Dark desktop evidence, the #335/#336 approved target, current `PlanningApprovedDesktop`, and the still-present legacy aggregate Recharts forecast. The planned direction is hybrid: preserve current operational/account detail and restore one canonical aggregate liquidity trend.
- Added Attention findings DV-A01 through DV-A06 after reviewing current Light/Dark desktop evidence, source/CSS and the verified #338/#339 target. The four-priority/action model remains authoritative; fixes focus on truthful expand/all-clear affordances, zero-group weight, density/action hierarchy and wide-screen measure.
- Added Reports findings DV-RP01 through DV-RP07 after reviewing current Light/Dark desktop evidence, current source/CSS, the earlier verified #159 executive Reports hierarchy and the owner-approved #341/#342 long-form composite. The plan preserves all current analytics while restoring a stronger first-screen financial picture, compacting empty management states and bounding long/wide analytical composition.
- Added Transactions findings DV-TX01 through DV-TX07 after reviewing current Light/Dark desktop evidence, source/CSS and the verified #308/#310 target. The ledger/detail model remains authoritative; fixes focus on wide-screen measure, period chrome, truthful single-selection affordance, visible comments, page-6+ pagination, neutral count semantics and dense-data readability.
- Added Savings findings DV-SV01 through DV-SV06 after reviewing current Light/Dark desktop evidence, source and the verified #314 target. The action-first/trend/goals model remains authoritative; fixes focus on truthful selected-month wording, temporal-frame clarity, no-goal/shared-pool semantics, wide-screen measure and user-facing copy/readability.
- Added Settings findings DV-ST01 through DV-ST05 after reviewing current Light/Dark default-tab evidence, current source/CSS and the #344/#347/#354 redesign history. The approved tab architecture remains authoritative; fixes focus on the forced/dead motion preference, addressable tab state, wide-screen measure and trustworthy product-vs-diagnostics visual coverage.
- Added penultimate cross-stack reconciliation DV-FB01 through DV-FB10. Before animation work, every owned domain must be checked end-to-end for missing/unreachable backend capability, unsupported/dead frontend affordances, persistence round-trip loss, semantic drift, security/error-contract mismatches and web/Windows/API compatibility. Motion is blocked until discovered gaps are fixed or deliberately classified/tracked.
- Added final cross-page motion implementation DV-M01 through DV-M06. It runs only after page-specific remediation **and the DV-FB reconciliation gate** and extends—not replaces—the route-shaped skeleton/loading-shift system from #186 with restrained list/grid/card content-entrance and state-change motion.
- No application implementation performed.

## Progress model

The 15 implementation buckets are the accepted page/functional acceptance groups defined above. They do not require 15 isolated page-local code paths: shared-owner corrections may satisfy findings across multiple buckets when the root cause is genuinely shared. The recurring/service branding capability remains one functional implementation bucket because it spans persistence, secured asset storage and multiple UI surfaces. The frontend/backend functionality-and-contract reconciliation is the penultimate cross-stack bucket. The explicit final cross-page motion pass is the last bucket and cannot start until reconciliation is closed. Each `DV-*` checkbox is one planned sub-implementation.

Current counters therefore remain:

**Implementations 13/15 completed · Sub-implementations 92/108 completed**

The audit/planning intake is complete, so the denominators are **frozen at 15/108**. They change only if the owner explicitly adds/removes scope or implementation uncovers mandatory follow-up that must be tracked to satisfy an existing acceptance contract. Completion counters advance only when accepted checklist items are fully implemented and validated.
