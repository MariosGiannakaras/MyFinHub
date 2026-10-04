# MyFinHub completion audit and implementation plan

Status: owner-expanded exhaustive full-system verification accepted; execution in progress  
Tracker: #476  
Target branch: `feat/476-completion-audit-hardening`  
Integration target: `develop`  
Release target: none — `main` remains release-only

## Current integration checkpoint — 2026-10-04

**Implementations 17/24 completed · Sub-implementations 164/197 completed**

This checkpoint supersedes older "#482 reconciliation pending" notes below for current execution state.

- Latest current checkpoint: Real Stack E2E #37 (`37206514550`) is green on exact implementation head `80a873d9dd66d841cc8b50e662a9e175090a61d9`; CI #3318 and CodeQL #3267 are green on the same head. Direct review of artifact `11304847206` closes the Cards real-stack lifecycle gap while Taxonomy and Icons retain their remaining manual/control-state obligations. The next zero-cost batch is now source-implemented for real provider creation, Storage upload/reuse/binding, hard-reload read-back and registration-failure cleanup on the disposable local stack; runtime credit remains pending. Current progress stays **Implementations 17/24 completed · Sub-implementations 164/197 completed**. PR #477 remains draft; expensive review-ready gates remain deferred.

- Owner decision 2026-10-04: **before #477 can be squash-merged**, complete a code-level UI reuse/consistency audit. Inventory the shared design-system primitives/tokens and identify orphaned or unused UI components/styles/variants, duplicated or parallel implementations of same-role controls, page-specific/inline styling that bypasses the shared system, and inconsistent variants that should share one semantic contract. Distinguish intentional contextual differences from accidental drift; consolidate at the shared layer where safe, remove dead/orphaned UI code where proven unused, and add narrow regression coverage for material consolidations. This audit is a prerequisite to the final visual pass, not a duplicate of it.
- Owner decision 2026-10-04: after #477 is squash-merged into `develop`, a dedicated **post-merge final visual release inspection on the exact canonical `develop` tree is mandatory before UI closeout**. This is a detailed element-level inspection, not a page-level glance. Regenerate and directly review desktop/tablet/mobile Light/Dark evidence for all primary routes and critical dialogs/states; inspect each distinct visible/interactive UI pattern for responsive containment, clipping/overlap, semantic palette and contrast, typography/spacing, focus/touch targets, 200%/Large-text/reduced-motion behavior and Windows-specific surfaces. **Deduplicate by shared implementation:** once a shared component/design-system primitive has been proven in its required representative states/contexts, do not re-review identical instances merely because they recur on another page; only re-review materially different variants, states or layout contexts. **Also audit reuse itself:** visually/sourcely equivalent controls that should share a primitive/token contract (for example same-role buttons, fields, selectors, cards, dialogs, badges, tabs and alerts) must not drift through page-specific parallel styling or inconsistent variants; consolidate them at the shared layer where safe before closeout. Fix any defect or unjustified divergence found, rerun only invalidated/affected evidence, then perform one bounded final visual sweep. A green pre-merge visual matrix does not waive this post-merge gate.
- #483 is integrated into `develop`; #477 is based on that baseline and is ready for review.
- The accepted #482 provider-management/API/Storage delta is source-integrated into #477. Exact-head rendered CI has passed Settings tabs and the provider-branding task flow, so provider reconciliation is completed for this batch.
- FV-35 is completed on `c852d3a…`: legacy transaction edit/delete/undo/redo passes on desktop and mobile using the real search/pagination behavior.
- FV-37/FV-38 remain completed with the unchanged bundle/CSS budgets.
- Final visual run #73 passed all 63 desktop/tablet/mobile captures and the resulting evidence was manually reviewed, including Dashboard, Credit, Settings/Providers, Lending and Transactions.
- FV-41/FV-42/FV-43 are completed on exact-head rendered CI. Their fixes were validation-harness/touch-target corrections and did not weaken product behavior.
- FV-44 is completed on `9b25fb1…`: extreme Recurring mobile progressive disclosure, full expansion, collapsed inactive history and overflow safety all pass.
- FV-45 exact-head rendered proof has passed: OCR persists raw `EUR`, while the owned currency select displays `EUR · Ευρώ`; stored semantics and visible presentation are validated separately. The expanded full-system audit below now governs closeout.
- FV-54 completed on `b602617…`: the local/Windows static host preloads `index.html` and `404.html` once at startup instead of performing `sendFile()` filesystem access per document request; exact-head CodeQL #3125 is green and the prior rate-limiting review threads are resolved. No dependency, API, finance, Supabase or Android behavior changed.
- Historical 2026-10-03 checkpoint counters: **Implementations 16/24 completed · Sub-implementations 152/195 completed**. Exact-head CI #3216 on `74bdc0c…` passed the complete primary-Chromium rendered coordinator, all source/API checks and npm audits; CodeQL #3169, Cross-engine #2342, Performance #2377, Windows Desktop #2775, Windows First Run #1326 and Windows Clean Launch #1327 are also green on the same source head. Direct review of the corrected focused 404 Light/Dark 200%-equivalent evidence closes the manual 404 cell and the broader readability/theme/reduced-motion cell. Final Visual #98 persisted 216 captures in screenshot-only commit `2f918176…` with manifest source `74bdc0c…`. PR #477 is returned to draft for the next implementation/proof batch so documentation/source churn does not retrigger every expensive gate.
- CI #3193 follow-up: all source/unit checks plus CodeQL, Cross-engine, Performance and Windows gates passed, while rendered CI stopped in the provider replacement flow after the newly added Save step entered an unstubbed QA provider-write path. The harness now owns a deterministic synthetic PATCH/upload/binding success backend and updates the shared QA provider snapshot before cross-surface refresh assertions. This is a QA-only source fix; counters remain unchanged until exact-head rendered proof passes.
- Exact-head validation follow-up on `b2c2b0bc…`: CI #3176 exposed FV-57, a real 144 px horizontal overflow on Savings at the 720×500 / Large-text 200%-equivalent profile. Windows Desktop #2736 is separately blocked by the upstream `http-cache-semantics` GHSA-2026 advisory in the `electron-builder` build-time chain; the other exact-head gates (CodeQL, Cross-engine, Performance, Windows First Run and Windows Clean Launch) passed. These two findings are tracked in 8.47 and do not change the denominator.
- Audit verification checkpoint 2026-10-02: 10 additional sub-implementations are directly closed by assistant review/evidence. Unsupported-future-schema handling remains open under the existing backwards-compatibility item; it does not expand the denominator.
- Repository-admin hardening remains tracked separately in #485 and does not change this batch denominator.
- No Android changes and no `main` release/promotion are part of this checkpoint.

## 1. Audit scope and evidence

This plan is based on the actual current product/repository state, not on the older redesign specification.

Visual evidence inspected so far. The older v1.3.0 archive is historical evidence only; it is **not** accepted as proof that the current feature branch is visually complete:

- the persistent v1.3.0 final archive: 63 PNGs covering 12 routed pages, 6 additional Settings states and 3 authentication states across desktop/tablet/mobile;
- the post-v1.3 app-wide design-system QA from #439 / CI artifact `11004599074`, containing 240 PNGs plus 29 QA manifests (269 artifacts total);
- full-page desktop/mobile captures for Dashboard, Transactions, Savings, Cards, Credit, Loans, Lending, Recurring, Planning, Attention, Reports and Settings;
- focused captures for account metadata, action center, AppShell, auth, branding, budgets, categories, command palette, owned controls, core flows, credit statements, icons, ledger semantics, obligations, payments, receipts/OCR, recovery states, taxonomy, theme/light/dark/tablet and transaction scanability.

Repository/source audit covered the routed pages, AppShell, Quick Entry/contextual payment flows, persistence/history, card vault, account metadata, device sessions and current regression suites.

Live Supabase audit covered:

- all public tables and columns;
- 29 pre-existing applied canonical migrations at audit time; two completion hardening migrations were subsequently applied;
- RLS policies and grants;
- owner/AAL2/device-session predicates;
- finance-state/history/card-vault/account-metadata functions;
- security and performance advisors;
- recent Auth/Postgres/Edge logs;
- installed extensions and the announced PostgreSQL 17.11 upgrade compatibility checks.

During the initial evidence-gathering phase no production state was changed. After the owner explicitly started implementation, the additive `manage_financial_provider_assets` migration was applied to production and post-verified; no finance rows were destructively modified.

## 2. System-level conclusions

### P0 — must be fixed before the application can be considered complete

1. **Device revocation is not enforced uniformly at the database boundary.**
   The canonical finance predicate `rheomiq_is_owner_aal2()` includes an active device-session check, but older sensitive surfaces still use owner + AAL2 only:
   - `rheomiq_card_secrets` SELECT/INSERT/UPDATE/DELETE;
   - `rheomiq_account_metadata` SELECT/INSERT/UPDATE;
   - the account-metadata upsert RPC;
   - `myfinhub_device_sessions` SELECT/UPDATE.
   The server API calls `ensureDeviceSessionAccess()`, so normal app traffic is protected, but a still-valid revoked AAL2 token should also fail at RLS/RPC level. Defense in depth is currently inconsistent.

2. **The Dashboard tablet layout is visibly broken.**
   Around the 834px tablet breakpoint the primary account surfaces expand into very tall, low-information panels. This occurs in both light/dark evidence and produces large blank/gradient areas. Tablet must use a bounded two-column or compact single-column account layout with fixed chart geometry.

3. **Mobile Lending history is a desktop table squeezed into a phone.**
   The right side of movement rows is clipped/obscured in current captures. The mobile contract must be a stacked semantic history presentation, not a horizontally truncated desktop table.

4. **Mobile Transactions bypass the existing page-size contract.**
   Desktop computes `pageRows` and pagination, while the mobile list renders `rows.map(...)` for the full filtered dataset. With realistic histories this creates extremely long pages, excess DOM, poor scanability and unnecessary work. Mobile must use bounded pagination / progressive loading and reset to page 1 whenever filters/search change.

### P1 — high-value cross-app completion work

5. **The global mobile Quick Entry FAB covers page actions.**
   The wide fixed `Γρήγορη κίνηση` control visibly overlaps loan-payment, recurring-payment, settings and transaction actions. Keep global Quick Entry, but reduce the mobile obstruction footprint and guarantee enough bottom clearance for the last interactive content.

6. **Cards mobile horizontal bank/card presentation lacks clear containment/affordance.**
   The next bank/card appears partially clipped. Use explicit snap sizing, scroll padding and an overflow affordance/position treatment so a partial item reads as deliberate carousel navigation instead of broken clipping.

7. **Several long mobile workspaces need stronger progressive disclosure, not more features.**
   Dashboard, Planning, Attention and Reports are functionally rich but very long. Keep their existing capabilities; tighten hierarchy and collapse secondary analytical/detail sections where that does not hide urgent actions.

8. **Settings mobile tabs need a clearer horizontal-scroll contract.**
   Preserve the existing tab set, but ensure selected tab scrolls into view and the strip exposes a visible edge/fade affordance rather than silently cutting labels.

### P2 — hardening / maintenance

9. **Supabase performance advisor warning.**
   `myfinhub_device_sessions_owner_insert` should wrap the JWT helper expression in a scalar subquery consistently, eliminating the current `auth_rls_initplan` warning.

10. **Leaked-password protection is disabled in Supabase Auth.**
    This is a project Auth setting rather than a repository/DDL change. It must be enabled if the current Supabase plan supports it. The application already uses mandatory TOTP/AAL2; leaked-password rejection is an additional credential-hardening control, not a replacement.

11. **PostgreSQL 17.11 upgrade readiness.**
    The live project is still PostgreSQL 17.6 and has `pgcrypto` installed. Current Supabase guidance says the 17.11 upgrade changes legacy pgcrypto PGP cipher behavior. MyFinHub's card vault uses application-side AES-GCM rather than pgcrypto PGP functions, and the audit found no `ltree`, `btree_gist` or custom-operator exposure. Before the infrastructure upgrade, retain a documented detection check; no finance-data rewrite is needed from current evidence.

12. **Unused-index notices are not an implementation blocker.**
    Four indexes are currently reported as unused. At this scale, do not remove them solely from advisor telemetry; keep until query evidence proves they are unnecessary.

## 2A. Expanded audit findings after owner review

The earlier completion assessment was reopened after owner-observed overlap/overflow and functional defects. The following are now explicit completion blockers.

1. **Provider branding registry and asset inventory were inconsistent.**
   Production contained owner-provided asset rows for Piraeus, Alpha, Revolut, Viva and Payzy while several corresponding `rheomiq_financial_providers` rows still advertised `generic`. The UI could also bypass that registry decision through identity-based local artwork fallback. This meant the database was not the actual branding source of truth.

   Implemented during the expanded audit:
   - production migration `20260930075049_align_financial_provider_brand_assets.sql` now points provider rows only to asset roles that actually exist and are active;
   - Piraeus, Alpha, Revolut, Viva and Payzy now use verified available logo assets as applicable;
   - missing National Bank, Eurobank and PayPal assets remain generic instead of being fabricated;
   - `BankBrandMark` now respects registry metadata before rendering local artwork;
   - Settings account creation now presents providers as a visual brand picker instead of a text-only select.

2. **Settings icon-family UX was not persistent or user-legible enough.**
   Previously the selected library was transient UI state and each category effectively retained only one active icon value. Switching families therefore did not provide the expected “show me this whole taxonomy in the selected family and remember my choices per library” behavior.

   Implemented during the expanded audit:
   - selected icon family is persisted in FinanceSettings;
   - the full category/subcategory preview changes immediately with the selected family;
   - each category/subcategory remembers a separate selected semantic icon for Lucide, Tabler, Phosphor, Heroicons and Bootstrap;
   - switching away and back restores that library's prior selection;
   - icon color can be automatic, one of the presets or a custom hex color;
   - colors persist per category/subcategory and render through shared `FinanceIcon` surfaces;
   - taxonomy rename/move/delete operations migrate or clean the pack-specific selections and colors;
   - server validation now bounds and validates the added settings;
   - rendered icon-pack QA now asserts live family switching, per-family restoration, color preview and mobile geometry.

3. **Card-details QA had a material functional gap.**
   Existing browser QA opened and closed the card editor but never performed a real Save → persistence → Reveal round trip. Unit tests mocked the persistence layer, so an operational vault failure could escape both kinds of coverage.

   Live-state evidence also shows seven card metadata records, five with `last4`, but currently zero rows in `rheomiq_card_secrets`. That is compatible with legacy metadata but proves that `last4` must not be treated as evidence that full PAN/expiry/CVV exists in the encrypted vault.

   Implemented during the expanded audit:
   - editor now explicitly distinguishes legacy `last4` metadata from a real vault record;
   - server-side missing/invalid encryption configuration maps to a distinct safe `CARD_VAULT_CONFIG_ERROR`;
   - client shows an actionable, non-secret error instead of a generic failure;
   - a real store round-trip test now covers encryption, write, reveal, partial update and delete;
   - rendered frontend QA now performs actual card-details Save and subsequent Reveal using the normal editor/client path with a deterministic QA vault boundary.

   Still required before completion:
   - verify the production server has valid card-vault encryption configuration through an authenticated runtime save attempt or equivalent owner-only operational evidence;
   - do not create fake production card secrets merely to prove the path.

4. **OCR exists in source, but source presence is not sufficient proof of working OCR.**
   The repository contains Tesseract.js 7, local Greek/English trained data, worker/WASM synchronization, local IndexedDB receipt drafts, deterministic parsing and an end-to-end browser QA script. The expanded audit therefore treats OCR as an **operational verification** item rather than a missing feature.

   Implemented during the expanded audit:
   - OCR now preflights `/ocr/asset-manifest.json` before starting the worker;
   - missing worker/WASM/language packaging produces explicit `OCR_ASSETS_UNAVAILABLE` user feedback;
   - end-to-end OCR QA now verifies the packaged manifest before synthetic receipt capture → OCR → reviewed Quick Entry handoff.

   Still required:
   - run this on the actual current branch build and inspect the resulting receipt/OCR screenshots manually.

5. **Generic horizontal-overflow checks were insufficient for overlap defects.**
   A page can have `scrollWidth === innerWidth` and still have a floating action button or fixed bottom navigation covering an actionable control. A new all-route geometry QA now checks desktop/tablet/mobile/narrow viewports, off-viewport interactive controls, and mobile fixed-chrome occlusion at top/middle/bottom scroll positions.

### Database coordination boundary

**2026-10-01 owner checkpoint:** logos, backend/database work and owner-side Settings work are complete. There is no remaining owner prerequisite for this completion batch. The owner subsequently explicitly requested implementation; the pending provider-management migration was therefore applied to production, post-verified, and the repository migration version was aligned to the live ledger. Further production-destructive testing remains prohibited.

## 2B. Live deep-audit findings tracker

The following findings were discovered after the expanded audit was reopened. They are tracked here even when the implementation fix has already landed, so the repository preserves the defect history and the validation obligation.

| ID | Area | Finding | Severity | Status / required proof |
| --- | --- | --- | --- | --- |
| DA-01 | Financial-provider assets / Supabase | Owner-side provider/logo, backend/database and Settings work is complete as of 2026-10-01. | Completed prerequisite | **Completed.** No owner action remains. The owner subsequently explicitly started implementation. The provider-management migration was applied and post-verified; further production-destructive testing remains prohibited, while privacy-safe read-only verification is allowed where needed for this audit. |
| DA-02 | Financial-provider branding | Provider registry metadata and UI fallback were previously inconsistent; some provider rows advertised generic assets while owner-provided logo metadata existed, and the UI could bypass registry intent with local identity fallback. | P1 | **Implemented, proof pending.** Registry alignment migration + registry-aware rendering + visual provider picker. Final rendered/provider QA still required. |
| DA-03 | Settings / icon libraries | Icon-family choice was transient and one icon value was effectively shared across libraries, so switching Lucide/Tabler/Phosphor/Heroicons/Bootstrap did not behave as a persistent per-library preference. | P1 | **Implemented, proof pending.** Persist selected family, separate per-pack selections, per-category/subcategory colors, taxonomy migration/cleanup, server validation, rendered family-memory QA. |
| DA-04 | Settings / legacy icon path | `CategoryIconsWorkspace` retained an older icon-only mode with local `useState` pack selection, which could diverge from the new persistent icon-family model if reused. | P2 consistency | **Implemented.** Legacy icon-only path now reads/writes the persisted active family. |
| DA-05 | Card vault | Existing rendered QA only opened/closed the card-details dialog and therefore could miss a broken Save path. | P0 functional | **Implemented, proof pending.** Added real UI Save → normalized PUT → Reveal round-trip QA plus encrypted store round-trip coverage. Production runtime encryption configuration still requires non-destructive operational verification. |
| DA-06 | Card vault async UI | A late `CARD_SECRET_NOT_FOUND` reveal response could update notice state after the card/dialog effect had already been cancelled. | P2 correctness | **Implemented.** Notice assignment now happens only after cancellation check; notice participates in dialog description. |
| DA-07 | OCR | OCR is present in source, but source existence did not prove packaged worker/WASM/language assets are available in the actual build. | P0 functional verification | **Implemented, proof pending.** Asset-manifest preflight + explicit `OCR_ASSETS_UNAVAILABLE` error + strengthened end-to-end OCR QA. Current-branch production build and screenshot inspection still required. |
| DA-08 | Mobile Lending | The desktop table clipping was replaced with semantic mobile cards, but the first pass still rendered the entire lending history on mobile. | P1 performance/UX | **Implemented, proof pending.** Mobile history is bounded to 20 rows with explicit progressive expansion. |
| DA-09 | Savings / Loans / Lending | Main rendered QA checked these pages visually but did not consistently prove UI create/edit/save persistence wiring. | P1 functional coverage | **Implemented, proof pending.** Added dedicated browser CRUD QA for Savings goal create/edit/delete + saving transaction, Loan create/edit, and Lending create. |
| DA-10 | Loans | Loan save could retain a stale/default account id that no longer exists in selectable accounts. | P1 functional | **Implemented.** Save now refuses an unavailable payment account and asks for a valid one. |
| DA-11 | Cross-app overlap/overflow | Document-level horizontal overflow checks cannot detect fixed FAB/bottom-nav controls covering actionable content. | P0 UX | **Implemented, proof pending.** Added all-route geometry audit across desktop/tablet/mobile/narrow widths and top/middle/bottom scroll positions, including off-viewport controls and fixed-mobile-chrome occlusion. |
| DA-12 | Card metadata vs vault | Production card metadata can contain `last4` even when no encrypted vault row exists; `last4` must not be treated as proof that PAN/expiry/CVV are stored. | P1 correctness | **Implemented.** Editor messaging distinguishes metadata-only state from a real vault secret. |

| DA-13 | App-wide category icon adoption | Dashboard recent movements and Planning scheduled items rendered semantic icons without passing current Settings, so selected family/color did not apply consistently across the app. | P1 consistency | **Implemented, proof pending.** Both surfaces now use the shared Settings-aware `FinanceIcon`. |
| DA-14 | Icon library truthfulness | Non-Lucide packs were presented as named libraries although the bundled offline subsets are currently small (Tabler ~14, Phosphor ~7, Heroicons ~5, Bootstrap ~5 distinct local glyphs). | P1 UX/truthfulness | **Implemented for current scope.** UI now labels them as local curated subsets and shows actual available option counts. Full upstream libraries are not claimed or silently fetched from CDN. |
| DA-15 | Settings mobile fixed chrome | The initial “sticky Save bar” overlap hypothesis was a false positive because `.settings-draft-actions` had no production component, but Settings is still a dense control surface where a global mobile FAB adds unnecessary fixed chrome. | P1 UX / audit correction | **Implemented, proof pending.** Dead sticky-action CSS was removed and the mobile Quick Entry FAB is intentionally not rendered on Settings. Geometry QA must verify 320/375px states. |
| DA-16 | Mobile session error banner | The fixed session-error banner used `bottom:22px` with a higher z-index than mobile navigation, so an auth/revocation error could cover bottom-nav actions. | P1 UX | **Implemented, proof pending.** On phone it is lifted above the bottom navigation + safe area. |
| DA-17 | Settings > Icons narrow phones | The category status pill could remain nowrap in a third grid column; long text such as “Heroicons · Προσαρμοσμένο · χρώμα” could push a 320–375px row beyond the viewport. | P1 responsive | **Implemented, proof pending.** At <=420px status moves to a second line and can wrap. |
| DA-18 | Card profile editing | Existing card “edit” affordance opened only PAN/expiry/CVV. There was no post-create UI to edit nickname, bank, network, design/form factor, and the pencil/title wording implied broader card editing than actually existed. | P0 functional/UX | **Implemented, proof pending.** Shared card dialog now has edit mode; Cards and Credit expose separate “Επεξεργασία κάρτας” and “Ασφαλή στοιχεία” paths. Profile edits preserve card id, vault metadata, credit history/settings and only update profile fields. Rendered QA now verifies profile save separately from vault Save→Reveal. |
| DA-19 | Dead CSS / stale interaction models | Legacy `.command-pill` and orphaned split-review stylesheet no longer had corresponding production markup but remained in eager CSS, obscuring fixed-control audits and consuming bundle budget. | P2 quality/performance | **Implemented.** Dead command-pill interaction/readability rules removed; orphaned split-review stylesheet removed from root imports. |

| DA-21 | Credit-card repayment account matching | Same-bank repayment eligibility used `account.id.startsWith(card.bankId)`. Accounts created in Settings use IDs like `account-piraeus-<uuid>` and can therefore be rejected even when their canonical `providerId` matches the card bank. | P0 functional | **Implemented, proof pending.** Credit page and Contextual Quick Add both use `accountMatchesFinancialProvider` with legacy inference fallback; source regression contract added. |
| DA-22 | Provider asset metadata | The live Payzy/Viva rows described historical 320×320 JPEGs whose hashes did not match the exact bundled PNGs actually used by the app. | P0 data-integrity | **Implemented and live.** Payzy is now repository-canonical PNG 127×54 / 1,582 bytes / SHA-256 `0a22f6d4…e74f1`; Viva is PNG 283×42 / 923 bytes / SHA-256 `c7aed852…aea8e`. Binary + hash + MIME + dimensions + source were changed atomically. Piraeus/Alpha/Revolut unresolved rows were not overwritten. |
| DA-23 | Database migration source of truth | Production contained live migrations that were ahead of the repository migration files, so the applied schema ledger was not fully reproducible from source. | P0 release integrity | **Implemented, proof pending.** Exact SQL is back-synced from `supabase_migrations.schema_migrations`; migration-ledger source test must include every live version before final validation. |
| DA-24 | Transactions / hidden compatibility DOM | Visible mobile pagination used `pageRows`, but the hidden semantic compatibility table still rendered every filtered `rows` item, so large datasets remained unbounded in DOM size. | P1 performance | **Implemented.** Hidden semantic table now uses the same bounded `pageRows` slice; source regression assertion added. |
| DA-25 | Settings / visual provider modal on phone | The branded 8-provider picker increased account-editor height, while the modal lacked a bounded scroll-body contract; Save/Cancel could move below a 375×812 viewport. | P0 responsive/functionality | **Implemented, proof pending.** Modal now has a viewport max-height with header/body/footer rows, only the body scrolls, and providers use two columns on normal phones (one below 340px). Dedicated 375×812 rendered geometry QA added. |
| DA-26 | OCR / mobile Quick Entry footer | The receipt launcher is portaled into the Quick Entry footer but its base CSS made it `position:fixed`. Desktop had a static override; mobile did not, so the OCR action could float over Cancel/Submit. | P0 overlap / functionality | **Implemented, proof pending.** On <=520px the receipt action is a static full-width first footer row. OCR rendered QA now asserts static positioning, footer containment, touch size and zero intersection with primary actions before opening the inbox. |
| DA-27 | Credit purchase/payment history | Both selected-card ledgers rendered the complete purchase/payment arrays. On mobile every event becomes a large semantic card, so history length and DOM cost could grow without bound. | P1 performance/UX | **Implemented, proof pending.** Each ledger renders 25 rows initially, expands explicitly in +25 chunks, and resets the visible window when card/sort changes. Mobile expansion action is full-width/touch-safe. |
| DA-28 | Card profile editor state | The edit dialog initialization effect depended on whole `initialCard` and `banks` object identities. A parent finance-data refresh while editing could rerun initialization and overwrite unsaved field changes. | P0 functional correctness | **Implemented.** Initialization is keyed to dialog-open/target identity rather than parent object identity; source regression contract added. |
| DA-29 | Supabase Auth / leaked-password advisor | Production security advisor reports leaked-password protection disabled. Supabase currently reserves this control for Pro+; the project is intentionally staying on Free. | P1 residual auth risk / plan constraint | **Accepted Free-tier limitation, not an unfinished implementation.** Do not upgrade solely to clear the advisor. Keep the single-owner model, mandatory TOTP/AAL2, active-device revocation and strong password policy. Re-evaluate only if Supabase makes the feature available on Free or the product plan changes. Official reference: https://supabase.com/docs/guides/auth/password-security |
| DA-30 | Account password change policy | With Free-tier leaked-password checking unavailable, MyFinHub's own password-change boundary accepted any distinct 8-character password. | P1 security hardening | **Implemented.** New password changes require 12+ characters with Unicode-aware lowercase, uppercase, numeric and symbol classes, enforced by one shared client/server validator. Existing login passwords are not invalidated. |
| DA-31 | Cards / metadata editing | The visible pencil/action labelled as card editing opened only PAN/expiry/CVV. Existing cards had no user path to edit nickname, bank, network, design/form factor after creation, so “edit card” was functionally incomplete and misleading. | P1 functional/UX | **Implemented, proof pending final rendered run.** Card profile editing is separate from encrypted PAN/expiry/CVV editing on Cards and Credit, preserves the existing card id/history/vault metadata, and dedicated browser round-trip coverage now verifies profile Save on both surfaces. |
| DA-32 | Recurring lifecycle QA | The cadence suite opened the recurring editor but did not prove create/edit/save or inactive-history lifecycle wiring. A broken Save/Reactivate path could therefore pass visual QA. | P1 functional coverage | **Implemented, proof pending final rendered run.** Completion CRUD QA now creates a recurring item, edits it, pauses it into retained history and reactivates it. Destructive deletion is intentionally not added because recurring history is lifecycle-preserving by product design. |
| DA-33 | Planning scheduled editing | Planning QA covered create/complete/skip/cancel but did not prove editing an existing pending scheduled item and saving it without affecting real balances. | P1 functional coverage | **Implemented, proof pending final rendered run.** Planning lifecycle QA now edits the created pending item, changes description/amount, verifies the old label disappears, and confirms current liquidity remains unchanged until completion. |
| DA-34 | Password change legacy compatibility | The Settings password form rejected any current password shorter than 8 characters before server verification. A valid legacy credential could therefore be impossible to rotate to the new stronger policy. | P1 functional/security UX | **Implemented.** Both client and server now require only a present, bounded current password so legacy credentials can be rotated; the new password still uses the canonical strong policy and the upstream auth service remains authoritative for current-password verification. |
| DA-35 | Dashboard tablet card geometry | Desktop fidelity forced an internal account-card grid with minimum columns of 168px + 132px while the 681–980px outer grid kept three cards side-by-side. Around 834px the card was narrower than its own internal minimum, causing the stretched/blank-gradient tablet presentation. | P0 responsive geometry | **Implemented, proof pending final rendered run.** Tablet now uses a 2-column primary grid, bounded internal minimums, min-width:0 and auto-height cards so large text can grow without clipping. |
| DA-36 | Mobile dialog geometry coverage | The dialog geometry suite checked horizontal containment but did not fail on vertical escape and covered only a small subset of real finance editors. A 320px phone could therefore have clipped actions even when document-level overflow was clean. | P1 responsive QA | **Implemented, proof pending final rendered run.** The suite now checks vertical containment for true modal/sheet surfaces at 375×812 and 320×700 and covers Quick Entry, card profile + secure details, Savings goal, Loans, Lending, Recurring, Planning, account editor and mobile navigation; inline icon selection remains horizontal-only because it is page content, not a modal. |
| DA-37 | Modern transaction edit QA | Legacy transaction override/tombstone flows had rendered save/delete coverage, but normal event editing used a different `editingEventId → Quick Entry` path without a dedicated save round-trip. | P1 functional coverage | **Implemented, proof pending final rendered run.** Completion CRUD QA now edits a real event from Transactions, changes amount/note, applies the edit and verifies the updated row appears without a new duplicate event path. |
| DA-38 | Card network vs visual design | Selecting a visual card design also called `setNetwork(item.network)`. Editing only a card color/design could therefore silently change the real Visa/Mastercard network, and a later network selection could leave conflicting preset metadata. | P1 functional correctness | **Implemented, proof pending final rendered run.** Network is now explicit card metadata: existing cards treat it as authoritative; new-card designs may suggest a default only until the user explicitly chooses a network. Visual design changes no longer overwrite an explicit network. |
| DA-39 | Card/bank modal field labels | The visible “Όνομα κάρτας” and “Όνομα τράπεζας” labels were sibling text rather than programmatically associated labels, and the text inputs had no accessible name. Keyboard use still worked, but screen readers could encounter unnamed fields. | P1 accessibility | **Implemented, proof pending final accessibility/rendered run.** Both text inputs now expose explicit Greek `aria-label` names; the CRUD harness also targets accessible names rather than relying on visual DOM proximity. |
| DA-40 | Cards KPI truthfulness | “Ενεργές κάρτες · στο ασφαλές card vault” incorrectly implied every card profile has an encrypted secret row. | P1 correctness | **Implemented.** KPI now describes card profiles independently from vault-secret presence. |

| DA-41 | Mobile More navigation | The `aria-modal` More menu backdrop sat at z-index 60 while persistent bottom navigation sat at 70, leaving background navigation above a modal layer. | P0 accessibility/UX | **Implemented, proof pending.** More backdrop moved above persistent bottom chrome and retains its own close control/focus trap. |
| DA-20 | Mobile modal viewport | Quick Entry and Receipt OCR inbox used `vh`, which can exceed the visible viewport under mobile browser chrome/virtual keyboard and hide sticky actions. | P0 UX | **Implemented, proof pending.** Mobile-sensitive modal bounds now use `dvh`; rendered keyboard/short-height QA still required. |

| DA-42 | Dashboard desktop attention shortcut | The attention shortcut used a fixed `right:307px` offset. After topbar controls evolved, the shortcut occupied the exact same 1440px rectangle as a topbar action (1115–1155 × 25–65). | P0 overlap/UX | **Implemented, proof pending.** Shortcut now stays in normal Dashboard period-row flow with no hard-coded topbar offset; geometry QA must prove zero intersection. |
| DA-43 | Card secure-details visual evidence | The existing card-details screenshots were captured immediately after focus/loading readiness while `DialogShell` was still inside its 180ms opacity entrance transition. That made the underlying card appear to bleed through and could produce a false visual defect diagnosis. | P1 QA evidence / visual hardening | **Implemented, proof pending.** Screenshot capture now waits 240ms for motion settle; the card-details surface is also explicitly opaque/isolated. Final evidence must be judged only from the settled screenshot. |

| DA-44 | Final screenshot evidence timing | Final page captures waited only 120ms after route readiness while AppShell route motion lasts 180ms; Settings tab captures waited only 80ms. Some evidence could therefore be captured mid-fade/transform and misdiagnosed as a product opacity/contrast defect. | P1 QA evidence | **Implemented, proof pending.** Route captures now wait 260ms, auth 220ms and Settings tab changes 180ms before capture; the 63-screenshot count is unchanged. |
| DA-45 | Quick Entry mobile dialog containment | Exact-head dialog geometry measured the 375px Quick Entry surface ~1.9px beyond the right viewport edge. The shared dialog used viewport-relative width while its fixed backdrop also owned horizontal padding, so the contract was not intrinsically containment-safe. | P0 responsive geometry | **Implemented, proof pending.** Mobile backdrops now own a 10px inline gutter and shared `quick-modal` surfaces use `width/max-width:100%` with border-box sizing inside that padded containing block. Root dialog containment remains a hard geometry assertion. |
| DA-46 | Transactions pagination / desktop leakage | The mobile transaction paginator sat outside the mobile-list wrapper and had no base `display:none`, so it remained rendered on desktop. Its icon-only arrows also had no pointer-user title. | P1 responsive/a11y | **Source-fixed, proof pending.** Base desktop styles now hide `.mobile-transaction-pagination`, the <=680px media query re-enables it explicitly, and both mobile arrow buttons expose title hints. |
| DA-47 | Cards mobile copy actions | The visible copy actions for PAN, expiry and CVV measured only ~23×26px at 375px, below the app-wide 40px touch-target contract even though their accessible names/titles were present. | P1 mobile accessibility | **Source-fixed, proof pending.** Mobile `.copy-mini` controls now expose a 40×40 interactive box while a 23×23 pseudo-surface preserves the compact card artwork; the existing touch-target gate remains unchanged. |
| DA-48 | Mobile More close target | The modal More menu close control was only ~34px rendered (32px content + border), below the app-wide phone touch-target contract. | P1 mobile accessibility | **Implemented.** Close control is now explicitly 40×40 minimum; modal z-index/focus semantics remain unchanged. |
| DA-49 | Login password reveal target | The password reveal control was 34×34 with no border expansion, making a primary authentication affordance undersized on touch devices. | P1 auth accessibility | **Implemented.** Password reveal is now 40×40 minimum with the same visual treatment and behavior. |
| DA-50 | Card-network SVG typing / bundler portability | Shared Visa/Mastercard artwork imported real local SVG files, but `tsconfig.node.json` did not load Vite asset module declarations, breaking hygiene/desktop TypeScript. The unit test also assumed Vite would emit filename URLs even though small SVGs may be inlined as `data:` URIs. | P0 release integrity | **Source-fixed, proof pending.** Node/test TS config now includes `src/vite-env.d.ts`; tests accept either local SVG URL or SVG data URI while separately verifying the checked-in canonical SVG colors/content. |
| DA-51 | Card-network helper export hygiene | `BrandedCardNetwork` and `CardNetworkBrand` were exported from `cardNetworks.ts` even though no external module consumed them, so the repository's strict unused-export gate rejected the otherwise-correct SVG portability fix. | P1 release hygiene | **Source-fixed, proof pending.** Both helper types are now module-private; runtime behavior and the consumed `cardNetworkBrand()` API are unchanged. |

| DA-52 | Mobile Quick Entry fixed overlay | Manual inspection of current 375px evidence showed the compact fixed Quick Entry button still covered ordinary page content during normal scrolling (including Lending history and Recurring/Transactions card content), even though max-scroll geometry proved final actions could eventually clear it. | P0 overlap/UX | **Source-fixed, proof pending.** Quick Entry is now a dedicated one-tap action inside the six-cell mobile bottom navigation, eliminating the floating overlay entirely while preserving Dashboard, Transactions, Savings, Cards and More navigation. Old FAB CSS/contracts were removed. |

| DA-53 | Mobile bottom-nav label readability | Fresh 375px evidence after DA-52 proved the non-overlapping six-cell nav, but the original long labels (`Dashboard`, `Συναλλαγές`, `Αποταμίευση`, `Περισσότερα`) visually collided across adjacent cells. Geometry containment alone did not catch the readability defect. | P0 navigation UX | **Source-fixed, proof pending.** Visible phone labels are now concise (`Αρχική`, `Κινήσεις`, `Στόχοι`, `Νέα`, `Κάρτες`, `Άλλα`) while full page names remain accessible through aria labels; compact font size is also raised slightly. |

| DA-54 | Cross-app / Dark theme | Dark mode had a semantic-coverage gap rather than a wholesale palette failure. Core text/status tokens were readable, but interactive borders were only ~1.38:1 against dark control backgrounds, `.eyebrow` retained a light-theme blue at ~2.5:1 on elevated dark surfaces, and multiple route-specific surfaces retained light-theme literals. | P1 accessibility / visual consistency | **Completed.** Semantic control borders and route surfaces now cover mobile More/Settings, Dashboard, Transactions, Quick Entry and Reports. Automated computed-style contrast/luminance checks pass; manual inspection confirms the remediated desktop/mobile dark surfaces, including a settled post-animation More sheet with clear opacity, boundaries and readable controls. |

### Dark-theme contrast analysis — DA-54

The owner-reported dark-theme issue is confirmed. The correct response is targeted semantic hardening, not simply making the entire palette darker.

- Existing dark body/text pairs are already strong: primary ink/canvas is ~16.1:1, secondary text/surface is ~9.2:1, muted/elevated is ~6.5:1 and muted-2/elevated is ~4.69:1.
- Existing semantic success/error/warning/info foregrounds are also readable on their paired dark backgrounds (roughly 6.4:1–8.9:1).
- The material failure was **component-boundary and selector coverage**: `--border-subtle` was only ~1.38:1 against `--control-bg`, so interactive controls could visually merge into surrounding surfaces; the hardcoded `#315fae` eyebrow was only ~2.5:1 on the elevated dark surface; and mobile More / Settings still contained light-biased literal backgrounds that could pair with dark-theme light foregrounds.
- Remediation introduces `--control-border` specifically for interactive control boundaries (`#8096b3` Light and `#5a7092` Dark, both >=3:1 against their control background) while retaining subtle decorative dividers. Known light-biased chrome is mapped through semantic theme roles rather than duplicated per-theme component CSS.
- Completion proof required both static contrast tests and **computed rendered styles** on real controls, plus rendered dark mobile More/Dashboard/Transactions/Quick Entry states and manual inspection of the existing desktop/tablet/mobile Light/Dark matrix. That proof is now complete: the settled More capture no longer shows transition-opacity bleed-through and the representative route surfaces are consistently dark/readable.
- Manual review of the first DA-54 exact-head artifact found residual high-impact light islands that numerical control checks did not cover: the approved Dashboard composition stayed white inside the dark shell, the desktop Transactions ledger retained light/gray rows and low-contrast text, Quick Entry retained a white footer, the mobile Transactions filter group remained visibly light, and the Reports period chip retained its explicit semi-white background. Dashboard/Transactions/Quick Entry now use a lazy dark workspace layer; the Reports chip is fixed route-locally so it stays code-split. Rendered QA explicitly measures these surfaces.

**Database coordination note — 2026-10-01:** the owner confirms logos, backend/database work and owner-side Settings work are complete. The later explicit instruction to start implementation authorized the pending additive provider-management migration, which is now applied and post-verified. No destructive production testing is permitted; privacy-safe read-only integrity/advisor checks may continue as verification evidence.

Tracking rule for this batch: every new material defect found during the remaining deep audit must be added to this table (or a page-specific section below) before the batch is considered complete. A defect is not “closed” merely because source code changed; rendered/runtime proof remains required where noted.

## 2C. Final-validation findings tracker

The first exact-head validation wave exposed three additional validation blockers. These are tracked separately from DA-01..DA-41 because two are QA-infrastructure defects rather than product defects.

| ID | Area | Finding | Classification | Status |
| --- | --- | --- | --- | --- |
| FV-01 | Cards rendered functional QA | The card profile QA treated `AppSelectInput` as a native `<select>`, so setting `.value='mastercard'` never invoked the owned combobox interaction. The resulting timeout did **not** prove the product save path was broken. | QA harness defect | **Source-fixed, proof pending.** QA now opens the combobox, selects the visible Mastercard option and then verifies the saved card renders Mastercard. |
| FV-02 | Mobile Dashboard performance | Mobile Dashboard scored 62 (<65). The first fix removed the shared Recharts chunk from the collapsed phone request path, but the rerun remained at 62. Lighthouse artifact comparison against the last green baseline then isolated ~550ms extra script evaluation: shared `FinanceIcon` resolution could repeatedly normalize the same taxonomy up to several times per icon render. | Product performance defect | **Second source fix applied, proof pending.** Collapsed phone Dashboard still defers Recharts; category identities are now memoized per immutable settings object and `FinanceIcon` resolves icon/source/color in one canonical taxonomy pass. Performance threshold remains 65. |
| FV-03 | Final screenshot capture | Final Visual QA failed before any screenshot because Chromium did not expose the fixed CDP port within the old blind 15s bootstrap. | QA infrastructure defect | **Source-fixed, proof pending.** Final screenshot harness now captures browser diagnostics, detects early exit/spawn failure, waits up to 20s and retries once on an isolated second port/profile. The 63-screenshot requirement is unchanged. |
| FV-04 | CI hygiene / category icon resolver | The corrected validation wave stopped in unused-export hygiene because the consolidated category-visual resolver left three obsolete public exports (`FinanceCategoryVisual`, `resolvedFinanceCategoryIcon`, `resolvedFinanceCategoryIconColor`) after consumers moved to `resolveFinanceCategoryVisual`. | Code hygiene defect | **Source-fixed, proof pending.** The internal result type is now private and the two obsolete wrappers are removed; the shared resolver remains the single public path used by `FinanceIcon`. |

| FV-05 | Completion geometry / Dashboard desktop | Corrected final-head CI proved a real exact-rectangle overlap between the fixed Dashboard attention shortcut and a topbar action at 1440px. | Product geometry defect | **Source-fixed, proof pending.** Removed the fixed pixel offset and returned the shortcut to normal period-row flow; the same geometry gate remains enabled. |

| FV-06 | Final visual evidence | Manual review of existing artifacts exposed that final screenshots could be captured during the 180ms route transition, producing faded evidence even when steady-state UI was correct. | QA evidence defect | **Source-fixed, proof pending.** Final capture waits now exceed the corresponding route/tab motion windows; screenshot quantity and viewport coverage remain unchanged. |

| FV-07 | Completion geometry stacking | After DA-42 removed the fixed shortcut overlay, the geometry harness still failed when normal scrolling moved the shortcut rectangle underneath the sticky topbar. Rectangle intersection alone could not distinguish “shortcut overlays control” from “content scrolls behind sticky chrome”. | QA harness defect | **Source-fixed, proof pending.** Desktop chrome collision detection now uses center-point hit-testing and fails only when the shortcut is actually the topmost interactive element over a topbar control; the overlap check remains active. |

| FV-08 | Completion geometry / mobile fixed chrome | The geometry harness treated any transient intersection between scrollable content and fixed bottom navigation as a defect, including Dashboard actions that had substantial remaining scroll and could be moved fully clear. | QA harness defect | **Source-fixed, proof pending.** Mobile bottom-chrome overlap remains a hard failure at the maximum reachable scroll position (and on non-scrollable pages), proving that final actions can actually clear the fixed navigation/FAB while allowing normal content to scroll behind persistent chrome en route. |

| FV-09 | Dialog geometry harness | After the full 48-combination page geometry sweep passed, the dialog inspector crashed on Quick Entry before making a geometry assertion. Its accessible-name helper manually constructed a CSS selector from control IDs and the CDP wrapper discarded the browser exception description. | QA harness defect | **Source-fixed, proof pending.** Inspector now uses native form-control `labels` associations and preserves browser exception descriptions/stacks for any future runtime failure; all geometry/accessibility assertions remain active. |
| FV-10 | Dialog geometry inspector syntax | Exact-head CI passed source/type/unit/build/hygiene and the full 48 page/viewport geometry matrix, then the dialog interaction inspector failed before its first assertion because its generated CDP function string contained malformed JavaScript. | QA harness defect | **Source-fixed, proof pending.** The inspector function is now a self-contained multiline function with native label association checks and unchanged horizontal/vertical/unnamed-control assertions. |
| FV-11 | Dialog geometry source contract | After FV-10 repaired the inspector, CI stopped in the source-contract test because the test still required the previous optional-chaining implementation string rather than the new equivalent native-label logic. | QA test-maintenance defect | **Source-fixed, proof pending.** The contract now asserts the new native label-count expression plus the accessible-name Boolean path; the accessibility requirement remains unchanged. |
| FV-12 | Dialog geometry timing / intentional horizontal scrollers | The first corrected dialog run measured Quick Entry during its 180ms entrance motion and also classified kind-selector buttons inside the deliberate horizontal scroller as rogue off-viewport controls. | QA harness precision defect + product verification | **Source-fixed, proof pending.** Dialog measurement now waits 220ms before geometry inspection and exempts only controls whose overflow is contained by a viewport-contained `overflow-x:auto/scroll` host. The modal root, footer, unnamed-control and vertical containment assertions are unchanged. |
| FV-13 | Transactions CRUD QA pagination | Functional QA tried to edit the 2026-08-02 modern event by scanning only the currently rendered first transaction page. With 14 rows/page and descending sort, the target event is legitimately outside page 1, so the harness reported no edit action even though the application exposes it when the row is visible. | QA harness selection defect | **Source-fixed, proof pending.** The browser flow now searches for `Freddo espresso`, edits the filtered event, then searches for the updated note and requires exactly one matching modern event with the new amount. |
| FV-14 | Transactions CRUD QA duplicate count | The modern-event edit round trip succeeded and rendered the updated note/amount, but the final assertion counted both the visible desktop row and the hidden mobile representation of the same event as two records. | QA harness presentation-count defect | **Source-fixed, proof pending.** Duplicate detection now counts only visible matching event rows in the active presentation and still requires exactly one result. |
| FV-15 | Card profile CRUD QA / owned combobox | Exact-head rendered QA reached card-profile editing but the harness called the generic native input setter for `AppSelectInput` network selection. The product correctly marks the explicit network as touched, but QA never selected Mastercard through the owned combobox, so the later design-change assertion timed out. | QA harness interaction defect | **Source-fixed, proof pending.** Completion CRUD QA now opens the owned combobox, selects the visible Mastercard option, waits for the selected trigger value/closed state, then changes visual design and verifies the card remains Mastercard. Product network/design separation logic is unchanged. |
| FV-16 | Transactions sort QA vs bounded pagination | The hardening suite required DESC page 1 to be the exact reverse of ASC page 1. Once Transactions correctly used bounded pagination, the two first-page slices represented opposite ends of the full dataset and were not reverses despite correct pre-slice sorting. | QA harness assertion defect | **Source-fixed, proof pending.** QA now verifies monotonic visible dates for ASC/DESC plus the corresponding `aria-sort` state and the known earliest fixture row, preserving a strict direction check without assuming all rows fit on one page. |

| FV-17 | UI/UX completion delete/undo fixture | Completion QA expected the `Freddo espresso` event to be present in the first rendered Transactions page before testing delete → undo → redo. Correct bounded pagination can legitimately place it outside page 1. | QA harness pagination-targeting defect | **Source-fixed, proof pending.** The harness now targets the fixture through the real Transactions search field, waits for the visible filtered row, then performs the same delete/undo/redo assertions. Product pagination and undo semantics are unchanged. |

| FV-18 | Mobile Quick Entry redesign integration | Moving Quick Entry from a floating FAB into bottom navigation correctly removed the product overlap, but the first source cleanup left two tests asserting the retired FAB contract and accidentally removed the closing brace of the surrounding mobile command-palette media block. | Source/test integration defect | **Source-fixed, proof pending.** The mobile media block is closed, completion/release contracts now require the six-cell nav action and explicitly reject the retired floating FAB. No quality or performance threshold was changed. |

| FV-19 | Dialog geometry / Quick Entry trigger | The all-route geometry matrix passed 48/48 after the nav redesign, but dialog geometry still tried to launch Quick Entry through the removed `.mobile-quick-action` class and failed before inspecting the modal. | QA harness selector defect | **Source-fixed, proof pending.** Dialog QA now opens the canonical `[data-global-quick-entry="mobile"]` navigation action and keeps all existing containment/accessibility assertions unchanged. |

| FV-20 | Downstream mobile QA navigation contracts | The DA-52/DA-53 navigation redesign left two downstream browser harnesses coupled to presentation details: OCR still had a second `.mobile-quick-action` lookup, and owned-controls QA targeted the old visible label `Αποταμίευση`. | QA harness compatibility defect | **Source-fixed, proof pending.** OCR now uses `[data-global-quick-entry="mobile"]`; owned-controls route selection uses full accessible page names/aria labels instead of compact visible labels. Product UI semantics are unchanged. |

| FV-21 | Core frontend mobile navigation selectors | The first final integrated CI run on head `b3f852c6…` passed hygiene, source/type/unit/build and API checks, then rendered frontend QA failed because the core harness still targeted compact-nav items by the retired visible labels `Συναλλαγές` / `Αποταμίευση`. A follow-up sweep also found one remaining Transactions visible-label selector in owned-controls QA. | QA harness compatibility defect | **Source-fixed, proof pending.** Core frontend and owned-controls QA now navigate primary mobile routes by stable accessible names/aria labels; compact phone copy remains `Κινήσεις` / `Στόχοι`. Product navigation code is unchanged. |

| FV-22 | Dialog geometry mobile More selector | The next final CI rerun passed source/type/unit/build and reached dialog geometry, where the harness still searched the bottom-nav button by retired visible text `Περισσότερα`; the current compact label is `Άλλα` while its stable accessible name is `Περισσότερες ενότητες`. | QA harness compatibility defect | **Source-fixed, proof pending.** Dialog geometry now opens More by its accessible name. A full rendered-script sweep found no other stale More-label selector. Product navigation code is unchanged. |

| FV-23 | Planning extreme-state list cardinality | Exact-head rendered QA passed all 48 route/viewport geometry checks, dialog geometry, functional CRUD, owned controls, desktop/mobile/extreme/readability/auth/runtime/report/brand/theme suites and the main Planning lifecycle flows, then failed because Planning QA still required ≥18 scheduled rows to render simultaneously. The product intentionally bounds the initial scheduled list to 12 with explicit progressive expansion. | QA harness pagination/progressive-disclosure defect | **Source-fixed, proof pending.** Planning QA now requires a bounded non-empty initial slice, a visible remaining-items expansion control, and a verified row-count increase after “Προβολή περισσότερων”. Product pagination/progressive-disclosure behavior is unchanged. |

| FV-24 | Settings provider-picker QA | The previous exact-head CI passed source/type/unit/build and all rendered suites through Planning/Budgets, then `settings-tabs-qa` timed out waiting for the removed `.account-management-provider-preview`. The current product intentionally uses the visual provider radio card itself as the selected preview, so the failure was a stale QA contract rather than a missing product state. | QA harness stale-selector defect | **Source-fixed, proof pending.** Settings QA now requires the selected Piraeus radio to remain `aria-checked`, active and branded with `BankBrandMark`, then captures the selected state. No provider-management product code or database work was changed. |

| FV-25 | Settings existing-account provider correction QA | After FV-24, exact-head CI reached the existing-account edit state and failed because the harness still asserted that edit mode must hide “Τράπεζα / πάροχος”. The product intentionally added provider correction for existing bank accounts in commit `941287f`, so the assertion contradicted the accepted implementation. | QA harness stale-product-contract defect | **Source-fixed, proof pending.** Settings QA now requires provider correction and IBAN editing together while still requiring the creation-only account-type selector to stay absent. No account/provider product implementation changed. |

| FV-26 | Desktop/Windows bundle budget | The second DA-54 dark-surface remediation was initially imported through eager `root-compat.css`, growing the main application CSS to 243.5 KiB raw against the unchanged 240.0 KiB budget. Windows Desktop and Clean Launch therefore failed correctly even though gzip remained within budget. | Product packaging / loading architecture defect | **Completed.** The dark workspace remediation loads through the existing lazy `WorkspaceStyleLayer`; exact-head source/build, Lighthouse, Windows package and clean-launch gates pass with the original 240 KiB raw CSS budget unchanged. |

| FV-27 | Dashboard deferred chart rendering | Exact-head rendered QA passed every earlier functional/theme suite and then final visual-evidence capture timed out waiting for the three deferred Dashboard Recharts SVGs. Artifact inspection confirmed the summary donut, cash-flow bars and category donut were actually blank. The lazy split introduced in #455 preserved performance but the extracted chart module replaced the previously working explicit `ResponsiveContainer` contract with chart-level `responsive` props that do not produce the required SVGs in the current runtime. | P0 visible Dashboard regression | **Completed.** Explicit `ResponsiveContainer` sizing remains inside the lazy chart chunk; exact-head full-page visual evidence passed 24/24 and the Dashboard hierarchy suite passed desktop and mobile states, proving deferred charts render without weakening the lazy/performance boundary. |

| FV-28 | Final Dashboard evidence desktop/mobile contract | After the FV-27 product fix, the exact-head desktop full-page artifact visibly contained all three restored Dashboard charts, but the final harness still timed out when it entered the mobile Dashboard because it required those desktop Recharts SVGs while mobile intentionally keeps heavy analytics collapsed until “Περισσότερη ανάλυση”. | QA harness progressive-disclosure mismatch | **Completed.** Exact-head full-page evidence passed 24/24 using distinct desktop deferred-chart and mobile collapsed-state contracts; screenshot coverage and performance thresholds remain unchanged. |

| FV-29 | Dashboard hierarchy compact-mobile analytics | After FV-28, full-page visual evidence passed 24/24 screenshots, then the hierarchy suite expanded mobile analytics at 375px and remained coupled to an exact Recharts count. The product's established compact contract hides the category donut below 381px, retains the category table and may keep the summary on its lightweight fallback while the on-demand chart chunk settles. | QA harness compact-layout mismatch | **Completed.** Exact-head hierarchy QA passed the semantic 375px expanded state: disclosure/analytics/KPIs open, summary visualization and cash-flow chart ready, compact category donut hidden and category table visible. |

| FV-30 | Dark mobile More evidence timing | Manual review of the latest theme artifact showed the More sheet apparently translucent enough for Dashboard text to bleed through. Source inspection showed the product uses a 160ms Framer Motion opacity/translate entrance, while theme QA captured immediately after the menu DOM node appeared. The computed style checks therefore measured the final CSS values but the screenshot could still represent the animated intermediate opacity. | QA evidence timing defect | **Completed.** Theme QA passes with the 220ms settle delay and manual review confirms the post-animation More sheet is opaque/readable; product colors, opacity tokens and interaction behavior were unchanged. |

| FV-31 | Mobile Dashboard on-demand cash-flow chart | Exact-head semantic hierarchy QA repeatedly proved that the 375px disclosure, analytics grid, KPI strip, summary visualization and category table reached their expanded states while the cash-flow Recharts surface remained absent. The decisive source audit found the actual sizing defect: `.approved-bar-wrap{height:153px}` lived only inside the desktop `@media(min-width:981px)` block, so mobile/tablet `ResponsiveContainer` mounted into a zero-height host. The earlier post-layout RAF/fallback hardening could not compensate for a host with no height. | P0 visible mobile analytics regression | **Completed.** DashboardCompletion supplies a 153px height/min-height through 980px; the exact-head hierarchy suite now passes the expanded 375px state with `flowReady=true`, while Lighthouse and the unchanged lazy/performance gates also pass. |

| FV-32 | Remaining functional round-trip coverage | The expanded audit required every major edit/save/delete/payment/settings flow to be exercised. Existing rendered suites already covered transaction edit/delete, Savings CRUD, Loans, Recurring, card profiles, credit/loan/recurring payments and Settings account metadata save/provider correction, but Lending repayment and Settings account deletion were only source/UI-present, not end-to-end browser round-trips. | QA coverage gap | **Completed; no new product scope.** Exact-head completion CRUD QA passes Lending 12/42 partial repayment with one semantic repayment row and remaining actionable receivable, plus Settings custom cash-account create → protected delete → success-feedback removal. Device revoke remains intentionally excluded from synthetic destructive QA because QA mocks device-list GET only; revoke POST is covered by API/security contracts. |

| FV-33 | Settings account-delete confirmation selector | The new FV-32 Settings delete round-trip created the temporary custom account and triggered its protected confirmation correctly, but the harness waited for `role="dialog"`. The canonical shared `ConfirmDialog` intentionally renders destructive confirmations as `role="alertdialog"`, so rendered validation timed out before the confirm action. | QA contract mismatch | **Completed; no product change.** Exact-head completion CRUD QA passes using the canonical destructive `alertdialog`; product delete semantics and accessibility role remain unchanged. |

| FV-34 | Category-icon adoption route readiness | After the rest of the rendered matrix passed, category-icon adoption kept targeting `Freddo espresso`, an event that is valid fixture data but is not guaranteed to be on Transactions page 1 with the 14-row pagination. The hidden semantic table mirrors `pageRows`, so waiting longer could never make that off-page row appear. | QA pagination/fixture mismatch | **Completed; no product change.** Exact-head rendered validation passed Transactions explicit expense/income icon preferences, Recurring persisted parent preference, Reports category visualization, Quick Entry preference propagation, narrow-mobile containment and the full icon-pack rendered suite. |

| FV-35 | Legacy transaction management pagination readiness | After FV-34 and the rest of the rendered suites passed, legacy transaction management timed out before its first action because it hard-coded the August `Supermarket` legacy row on Transactions page 1. The current 14-row pagination and newer August fixtures do not guarantee that old 2026-08-01 row is on the first page, so waiting cannot make the target appear. | QA pagination/fixture mismatch | **Source-fixed; exact-head proof pending, no product defect identified.** The harness now uses the real Transactions search field to filter to `Supermarket` on desktop and mobile before edit/delete/undo/redo proof, preserving the actual 14-row pagination and user-facing filtering behavior. |
| FV-36 | Provider-branding integration reconciliation | PR #482 is implementation-complete but remains a stacked draft branch with provider-management/API/Storage changes that overlap the completion branch. It must not be merged independently in its current stacked form. | Integration dependency | **Pending.** Reconcile the accepted #482 delta into #477 on top of current `develop`, preserve completion-audit fixes and #483 CI contracts, then close/supersede the stacked PR only after the reconciled branch validates. |
| FV-37 | Aggregate CSS budget after #483 baseline | Core CI on the synchronized completion branch built successfully but measured 507.3 KiB raw CSS against the new 500 KiB aggregate ceiling. The excess came from superseded card-renderer/create-dialog geometry still loaded beside the current component-owned and v15 card styles. | Redundant legacy CSS | **Completed.** Exact-head CI proves the reconciled tree stays below the unchanged 500 KiB raw / 100 KiB gzip aggregate budget after removing only superseded geometry/selectors. |
| FV-38 | Aggregate CSS budget after provider reconciliation | Provider reconciliation passes 761/761 unit/source tests, but its dedicated Settings stylesheet raises aggregate raw CSS to 506.8 KiB while gzip remains below budget. | Provider UI stylesheet duplication | **Completed.** Exact-head CI on `c95746b…` reports 499.7 KiB raw / 93.4 KiB gzip after reusing shared surfaces/controls and retaining only provider-specific layout/preview/picker rules. |

Validation rule: FV items close only after the next exact-head wave proves the corrected interaction/performance/bootstrap behavior. No quality threshold or screenshot-count requirement was relaxed.

## 3. Page-by-page audit and required changes

### AppShell / global navigation

What is correct:
- route-invariant sidebar/topbar;
- keyboard/search/history/refresh/logout controls;
- accessible mobile More dialog;
- single global Quick Entry entry point;
- light/dark design tokens and reduced-motion handling.

Required:
- shrink the mobile Quick Entry FAB to an icon-first compact control while retaining its accessible name/title;
- increase bottom interaction clearance so final buttons/cards can scroll fully above mobile navigation/FAB;
- keep the desktop/tablet shell unchanged;
- add regression assertions for no content-action occlusion at phone width.

### Dashboard

What is correct:
- real balances, privacy mode, attention shortcut, account quick actions;
- monthly movements, upcoming obligations, income/expense summary, category analytics, budgets and savings indicators;
- desktop composition is coherent.

Required:
- fix 681–980px primary-account layout and bound account chart/card height;
- remove tablet blank/oversized chart regions in light and dark themes;
- preserve two-column layout when width permits, otherwise use a deliberate compact one-column form;
- on mobile, keep accounts/actionable information first and make lower analytics more compact/progressively disclosed;
- verify privacy-hidden values in all new responsive states.

### Transactions

What is correct:
- search/type/account/category/date filters;
- semantic transaction kinds;
- desktop selection/detail panel;
- edit/delete with legacy override/tombstone semantics;
- sort direction and desktop page size.

Required:
- render only the current mobile page/progressive slice, never the entire filtered history;
- provide mobile next/previous or “load more” controls with result counts;
- reset pagination on every search/filter/date/sort change;
- preserve edit/delete and split-detail behavior;
- ensure sticky global controls do not cover row actions.

### Savings

What is correct:
- Pay & Save, transfer-to-savings and planned-saving intents;
- savings target and persisted goals;
- monthly reporting and history.

Required:
- fix narrow-phone copy truncation/overflow in action cards;
- preserve intent-first ordering;
- no new backend entity is required.

### Cards

What is correct:
- debit/prepaid/reference-card semantics are separate from credit lifecycle;
- bank grouping, archive/restore and shared card-details editor;
- PAN/expiry/CVV are outside FinanceData.

Required:
- improve mobile carousel snap sizing and edge affordance;
- prevent a partial next bank surface from looking like clipping;
- keep credential/reference cards free of transaction history.

### Credit

What is correct:
- only credit cards appear here;
- card stack, purchase/payment actions, statement boundaries, debt/limit/available-credit and archive flows exist;
- over-limit state and statement history are covered;
- vault UI does not persist secrets in FinanceData.

Required:
- no structural redesign;
- inherit global mobile-overlap fix;
- backend card-vault RLS must require active device session as well as owner+AAL2;
- preserve unrestricted PAN length policy (no fixed 16-digit or Luhn rule).

### Loans

What is correct:
- installments, loans and self-loan semantics;
- payment flows and remaining obligation calculations;
- sort/filter and edit lifecycle.

Required:
- eliminate FAB overlap over payment/edit controls;
- verify compact phone action row after global shell fix;
- no new persistence model required.

### Lending / receivables

What is correct:
- lend/repay flows, person aggregation, outstanding amount and full history;
- privacy state shares the global session setting.

Required:
- replace the phone history table with stacked history cards/rows exposing date, person, action, amount and current balance without horizontal clipping;
- preserve desktop table and filters;
- keep contextual lend/repay actions prominent.

### Recurring / subscriptions

What is correct:
- one canonical recurring domain;
- monthly/multi-month/annual/multi-year cadence;
- inactive/lifetime semantics and loan separation;
- contextual payment flow.

Required:
- inherit mobile overlay fix;
- keep active items/action buttons visible above bottom chrome;
- no parallel “subscription engine” or new table.

### Planning / scheduled cash flow

What is correct:
- scheduled one-offs, completion state, cash-flow forecast and account projections;
- forecast uses canonical finance semantics.

Required:
- improve mobile progressive disclosure for secondary projection/detail sections;
- keep pending and next-due information visible before analytics;
- no database normalization required.

### Attention / Review

What is correct:
- one consolidated attention/review surface;
- groups by urgency/status;
- review decisions, snooze/dismiss and legacy semantic confirmation.

Required:
- reduce mobile scroll burden with collapsible completed/low-priority groups while keeping urgent items expanded;
- preserve decision semantics and fingerprints.

### Reports / budgets / rules

What is correct:
- KPIs, category and flow analytics, budget CRUD, rule CRUD and obligations views;
- mobile uses card/text representations rather than relying solely on charts.

Required:
- keep primary KPIs and budget status above fold;
- collapse secondary long-form analytics on mobile where appropriate;
- no large visual restructure in this completion batch.

### Settings

What is correct:
- appearance/readability;
- profile/account security, MFA factors and device sessions;
- account metadata/IBANs;
- categories/icons/rules;
- backup/import/data controls;
- desktop/update/support tooling.

Required:
- improve phone tab-strip selected-state visibility/overflow affordance;
- ensure device revoke/revoke-others messaging clearly reflects active-device enforcement;
- leaked-password protection remains an external Supabase Auth configuration item.

### Authentication

What is correct:
- email/password sign-in;
- mandatory TOTP enrollment/challenge;
- owner gating and AAL2 enforcement;
- mobile login/MFA/enrollment states are coherent.

Required:
- no alternate auth providers;
- keep the current flow;
- enable leaked-password protection in Supabase project settings if available;
- retain active-device bootstrap only after AAL2.

### Quick Entry, payments, receipts, taxonomy and overlays

What is correct:
- contextual credit/loan/recurring/scheduled/savings/lending flows;
- receipt OCR is local/transient;
- command palette and dialogs have focused desktop/mobile coverage;
- category retirement and blocked states exist.

Required:
- inherit shell occlusion fixes;
- retain local OCR/privacy boundary;
- no server receipt-image store is to be added.

## 4. Backend/API/database implementation result

### 4.1 Active-device security boundary — implemented

Two additive production migrations are now applied and mirrored exactly in the repository migration ledger:

- `20260930062504_harden_active_device_sensitive_rls.sql`
  - keeps device-session INSERT as the bootstrap exception: owner + AAL2 + JWT session id + not revoked;
  - requires the current request session to be active for device-session SELECT/UPDATE;
  - changes `rheomiq_card_secrets` CRUD and `rheomiq_account_metadata` SELECT/INSERT/UPDATE to the canonical owner + AAL2 + active-device predicate;
  - changes `rheomiq_upsert_account_metadata` to the same canonical predicate;
  - changes authorization only and does not rewrite finance state, history, card ciphertext or account metadata values.

- `20260930062619_move_active_device_rls_helper_private.sql`
  - moves the RLS-only `SECURITY DEFINER` active-session helper into a non-exposed `private` schema;
  - keeps the public `rheomiq_is_owner_aal2()` helper as `SECURITY INVOKER`;
  - removes the exposed public active-session RPC;
  - keeps direct Data API/RPC access fail-closed after device revocation.

Live read-back verification confirmed the final policies/functions match the repository migrations.

### 4.2 RLS performance/security advisor cleanup — implemented

- the device-session INSERT JWT expression now uses the cached scalar-subquery form;
- the previous `auth_rls_initplan` performance warning is gone;
- the temporary exposed-security-definer advisor finding created by the first hardening step is also gone after moving the helper to `private`;
- the remaining four unused-index findings are informational and are intentionally not removed without query evidence.

### 4.3 API/client consistency — implemented

- finance, card-vault and account-metadata clients now route `AUTH_REQUIRED` / `DEVICE_ACCESS_REVOKED` through one auth-expiry event;
- revoked-device failures produce a re-login/MFA path rather than leaving finance-adjacent surfaces in a stale authenticated state;
- same-origin mutation checks, bearer/native boundaries and service-role secrecy remain unchanged.

### 4.4 Auth configuration — plan-limited

The live advisor still reports leaked-password protection as disabled. Supabase documentation states that leaked-password protection is available on **Pro Plan and above**, while this organization is currently on the **Free** plan. Therefore:

- no repository or database workaround is introduced;
- email/password + mandatory TOTP/AAL2 remains the current product authentication model;
- leaked-password protection should be enabled if/when the Supabase organization is upgraded to a plan that supports it.

### 4.5 PostgreSQL upgrade readiness

Before a future PostgreSQL 17.11 infrastructure upgrade:

- rerun the official Supabase detection queries;
- current audit result remains: `pgcrypto` installed, no `ltree`, no `btree_gist`, no custom operators detected;
- MyFinHub uses application-side AES-GCM rather than pgcrypto PGP functions for the card vault, so no finance/card-vault re-encryption task is currently indicated.

Reference:
- https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes

## 5. Implementation order

Execute as one coordinated batch; do not open a PR or trigger CI between small changes.

1. Commit this audit/plan.
2. Add regression/source tests describing the target contracts, but do not run CI.
3. Implement global mobile shell/FAB clearance.
4. Implement Dashboard tablet fix.
5. Implement Transactions mobile bounded rendering/pagination.
6. Implement Lending mobile history cards.
7. Implement Cards mobile carousel affordance.
8. Apply small Savings/Settings/mobile progressive-disclosure refinements.
9. Add the additive Supabase security/performance migration and matching source tests.
10. Update API error handling only where the migration exposes inconsistent revoked-device behavior.
11. Update tracker/checklist and changelog Unreleased only after all implementation work is coherent.
12. Synchronize with the then-current `develop` and resolve only real conflicts from #475/#472/#465 or subsequent work.
13. Run one local/narrow validation wave: typecheck, unit/source tests, production build, API typecheck and rendered QA for changed surfaces.
14. Inspect every newly generated changed-surface screenshot manually at desktop/tablet/mobile and both themes where applicable.
15. Fix all local/rendered defects.
16. Only after the implementation is complete, open the PR and run the full CI/CodeQL/Cross-engine/Performance/Windows validation wave once on the actual final head.
17. If the final head changes, rerun only the gates required by repository rules.
18. Merge to `develop` when final-head checks and manual visual review are green. Do not promote to `main`.

## 6. Completion criteria

The application is complete for this batch only when all are true:

- every routed page has a deliberate desktop/tablet/mobile layout;
- no mobile page action is clipped by content overflow or global chrome;
- Dashboard tablet account cards/charts are bounded and readable;
- mobile Transactions never renders an unbounded full history;
- Lending mobile history has no horizontal data loss;
- Cards carousel behavior is visibly intentional;
- all existing finance semantics and historical compatibility remain intact;
- revoked devices fail closed at API **and** PostgreSQL RLS/RPC boundaries for sensitive data;
- Supabase security advisor has no new application-caused security error;
- the known RLS init-plan warning is resolved;
- the final integrated validation is green on the exact final head;
- final changed-surface screenshots have been manually reviewed;
- no Android work, production release or destructive data operation is included.


## 7. Current expanded-audit checkpoint

The earlier “implementation complete” checkpoint is superseded. The branch remains **not merge-ready** until the expanded audit closes.

Completed or implemented in the reopened audit:
- active-device RLS/RPC hardening and revoked-session handling;
- previously identified responsive fixes;
- verified-provider branding alignment in live Supabase and corresponding UI source-of-truth changes;
- visual provider selection in Settings;
- persistent icon-family selection, separate per-library icon memory and per-category/subcategory colors;
- real card-vault store round-trip coverage plus UI Save → Reveal rendered coverage;
- explicit legacy-card/vault status in the card editor;
- OCR packaged-asset preflight and stronger end-to-end QA;
- all-route geometry/overflow/mobile-occlusion audit added to the final rendered suite.

Still required before merge:
1. prove FV-45 in exact-head rendered CI;
2. require the exact-final-head CI, CodeQL, Cross-engine, Performance and Windows gates to be green;
3. squash-merge the completed work to `develop`.

No `main` promotion/release is part of this work.

- **FV-40 completed:** final visual run #73 passes the mobile Credit network-mark safe-area assertion after anchoring the lower card body inside mobile padding; manual review confirms mobile containment and unchanged tablet/desktop presentation.

- **FV-41 source-fixed; exact-head proof pending:** the exact-final-head Settings rendered check found provider Edit actions at 38px high on mobile. The mobile provider-management rule now raises those actions to a 44px touch target while preserving desktop density and layout; exact-head rendered proof remains required before merge.

- **FV-42 completed:** the final Transactions scanability run created the five-part split successfully but then looked only at the currently paginated ASC page, where a newly created transaction is not guaranteed to be visible. The harness now waits for the real save to close Quick Entry and then uses the visible Transactions search control to locate the unique split before validating disclosure/amount/mobile behavior. The first retry also removed an invalid `rows.length===1` assumption because the desktop page intentionally renders both its visible row and a hidden semantic-table row. Exact-head rendered CI then passed the large split disclosure and mobile hierarchy stages. No product behavior, accessibility representation or pagination rule changed.


- **FV-43 source-fixed; exact-head proof pending:** after FV-42 passed, the same Transactions scanability suite reached its extreme long-content case and exposed another pagination-only harness assumption: the deliberately old extreme transaction is not guaranteed to be on mobile page 1. The harness now uses the visible Transactions search control to locate that unique long-content row before asserting overlap and overflow. No product behavior changed.


- **FV-44 completed:** exact-head rendered CI on `9b25fb1…` reached and passed the extreme Recurring mobile lifecycle case after Transactions/legacy/provider validation had passed. The product keeps its intentional 12-row progressive disclosure and `Προβολή περισσότερων` behavior.

- **FV-45 source-fixed; exact-head proof pending:** the receipt OCR proposal persisted the correct raw currency `EUR`, but the owned select renders the user-facing trigger label `EUR · Ευρώ`. The rendered harness now asserts the persisted IndexedDB proposal is exactly `EUR` and separately accepts the visible EUR label. No OCR/parser/product behavior changed.


## 8. Full-system exhaustive verification plan — owner-expanded scope 2026-10-01

The prior completion audit remains valuable evidence, but it does **not** by itself prove that every visual element, every UX state, every user action/sub-action, every API/backend path and every error path has been exercised end-to-end against a canonical integrated tree. The owner has therefore expanded the accepted completion scope to require a full-system verification pass before the application is treated as fully closed.

**New audit workstream: Implementations 8/16 completed · Sub-implementations 106/166 completed.**

**Overall completion scope: Implementations 14/24 completed · Sub-implementations 147/197 completed.**

The original owner-expanded audit added 16 verification implementations / 160 non-trivial sub-implementations. The accepted desktop/Electron title-bar sub-implementation raised the audit workstream denominator to 165; FV-62 adds one CI teardown-hardening sub-implementation on 2026-10-03, bringing the audit workstream denominator to 166 and the overall denominator to 195. The owner-mandated canonical post-merge final visual release inspection adds one closeout sub-implementation on 2026-10-04, bringing the overall denominator to 196. The owner-mandated pre-merge code-level UI reuse/orphan/consistency audit adds one additional closeout sub-implementation on 2026-10-04, bringing the overall denominator to 197. Existing implementation-completion state is retained provisionally, but the expanded verification matrix has a stricter proof rule: prior evidence may be reused only after the responsible ChatGPT agent personally inspects it and confirms that it proves the exact required contract. Re-running unchanged automation is unnecessary when existing artifacts are sufficient, but no matrix cell is finally closed merely because an earlier workflow marked it green.

### 8.1 Canonical baseline, scope inventory and traceability — 7/7

- [x] Freeze the exact candidate source SHA and record `main`, `develop`, open implementation PRs/branches, migration ledger, production deployment SHA and desktop release SHA. Do not treat a PR-only head as canonical after merge. Candidate baseline frozen 2026-10-02 for this verification checkpoint: feature candidate `e3647e22224f8940f4ba71ebe5197a98947aec70`; `develop` `a752e417d339bce3eb2aab0a0b3918140533318e`; `main`/current production deployment `3333b73330c5431c052edcb6e4d1b792a89445a7`; open PR heads #477 `e3647e2…`, #482 `7aa7466…`, #479 `5bd521e…`, #465 `f3e0cfe…`; live Supabase ledger through `20261001220945_reject_cross_account_id_collisions`; Windows release tag `myfinhub-v1.3.0` at `2673ce626c0e3db6c30fea04a46b6cf1ce9517df` with installer SHA-256 `a405189e016ddd03e31ab1ba92979b3991a64516edfa2a657eb7b9928fadc556`.
- [x] Inventory every routed page, Settings tab, authentication screen, modal, sheet, popover, command surface, global action, keyboard shortcut and persistent desktop-only control from source. Completed in `docs/completion/FULL_SYSTEM_TRACEABILITY_MATRIX.md`.
- [x] Inventory every user-visible capability and every mutation/read operation: create, edit, delete, archive, restore, activate/deactivate, pay/repay, complete, skip/cancel, import/export/backup, upload/replace, copy, search/filter/sort/page, undo/redo and refresh. Completed in the full-system traceability matrix.
- [x] Inventory every API endpoint, HTTP method, auth mode, Supabase RPC/table/storage dependency and database mutation path. Completed in the full-system traceability matrix.
- [x] Inventory every stateful entity and relationship in legacy/mutable state and relational ledger storage, including history/audit/backup/card-vault/account/provider metadata boundaries. Completed in the full-system traceability matrix.
- [x] Build one traceability matrix mapping Product capability → UI control → domain operation → persistence/API/backend path → success test → failure tests → visual states → accessibility checks. Completed in `docs/completion/FULL_SYSTEM_TRACEABILITY_MATRIX.md`; incomplete proof cells remain explicitly classified rather than assumed.
- [x] Mark every prior test/screenshot/evidence item as reusable, partial or insufficient against the matrix; uncovered cells become explicit pending work rather than inferred coverage. The traceability matrix records the disposition and remaining proof class for every capability row.

### 8.2 Exhaustive visual inspection — 12/12

- [x] Capture and manually inspect every primary route at desktop, tablet and narrow-phone widths in both light and dark themes. Direct assistant review opened and inspected all 132 images from Final Visual QA artifact `11217096254` (22 groups × light/dark × desktop/tablet/mobile); primary routes show no material clipping, overlap, unreadable baseline contrast or broken responsive containment. Disposition ledger: `docs/completion/FINAL_VISUAL_MANUAL_REVIEW.md`.
- [x] Capture and inspect every Settings tab and nested editor, including accounts, providers/assets, categories, icons, rules, data, security/device sessions and appearance/readability surfaces. Direct assistant visual review completed across all 42 committed Settings captures (7 surfaces × light/dark × desktop/tablet/mobile); layout hierarchy, provider/account management, categories, icon libraries, rules, data tools and profile/security surfaces were inspected individually.
- [x] Capture and inspect authentication states: login, validation failure, MFA enrollment, MFA challenge, invalid MFA, expired/revoked session and auth-unavailable feedback. Direct assistant review of Final Visual QA artifact `11252454113` from source head `2bed84e…` opened all **54/54 auth captures** at useful resolution: 9 auth states × light/dark × desktop/tablet/mobile. Every state passed for readable hierarchy, theme-safe error/recovery treatment, visible focused MFA control where present, and no material clipping, horizontal overflow or hidden recovery action. The expanded disposition is recorded in `docs/completion/FINAL_VISUAL_MANUAL_REVIEW.md`.
- [x] Capture and inspect every dialog/sheet/popover/picker/confirmation surface in closed, opening, focused, populated, validation-error, saving, success and failure states where applicable. Exact-head CI #3271 on `7321c591…` passed the complete rendered coordinator after FV-64/FV-65/FV-66 remediation. Direct assistant review reopened the four invalidated captures individually (`dialog-money-edit-validation-mobile`, `confirm-credit-event-delete-mobile`, `confirm-receipt-delete`, `settings-device-revoke-failure-desktop`) and then individually rechecked every shared confirmation surface invalidated by the common ConfirmDialog CSS change: Quick Entry discard, credit-card total delete, persistence recovery, account/card/savings/self-loan/transaction destructive confirmations, Planning cancel/skip, device revoke confirm/busy, JSON import, taxonomy retirement confirmation and blocked desktop/mobile states. Dialog surfaces are opaque/readable, Receipt confirmation is topmost above the inbox, the device failure alert is visible in-frame, destructive/neutral action hierarchy remains clear, and no clipping/overlap regression was found.
- [x] Inspect every interactive component state: default, hover, keyboard focus, pressed, selected, disabled, loading/saving, destructive, error, conflict and success. Direct assistant review on the exact-branch evidence set opened representative shared-control states individually: baseline/default route controls, Refresh hover tooltip, real mouse-down pressed Refresh, Quick Add keyboard focus, command-palette selected/focused result, disabled updater during download, persistence loading and saving, taxonomy destructive confirmation, persistence/validation errors, revision conflict, and updater up-to-date success. These are shared primitive/AppShell states rather than page-specific screenshot substitutions; no unresolved visual ambiguity was found in the reviewed state categories.
- [x] Inspect empty, minimal, normal, dense and extreme-content states for every data-heavy page; include long Greek copy, long account/provider/category names, large monetary values and multi-line notes. The exact-head source `41ff4d6a…` matrix was opened individually route-by-route for all twelve primary routes across minimal/empty/extreme desktop+mobile profiles, and the six dense large-data captures were also opened individually; normal states were already directly reviewed in the earlier baseline/current-route passes. That review found one systemic defect, FV-63, at 320px. After its shared-shell fix, exact-head CI #3234 on `b7d2a160…` passed the new brand/action collision assertion and the full rendered coordinator, and direct assistant reinspection opened all twelve refreshed 320px extreme route captures individually. Long Greek/account text, large monetary values, multi-line descriptions, dense histories/rules and intentional horizontal carousels remain contained with no renewed header overlap.
- [x] Inspect responsive breakpoints around actual layout transitions, not only 1440/834/375 snapshots; verify no breakpoint cliff, horizontal overflow, clipped action or fixed-chrome occlusion. Direct assistant review of CI #3169 confirms the geometry suite passed all canonical profiles plus 1024px desktop, 1112×834 tablet landscape, both sides of the 681/680px transition and 812×375 phone landscape after live resize; the interaction suite also passed the 375×500 virtual-keyboard profile. Every profile enforced <=1px document overflow and no rogue/off-viewport controls or fixed-chrome occlusion.
- [x] Inspect tables, cards, charts, legends, tooltips, carousels, progressive disclosure, pagination/load-more and sticky controls for containment and readable hierarchy. Direct assistant inspection of the exact-branch rendered artifact `11228136368` covered 85 focused screenshots across AppShell routes, Reports, functional CRUD states, Cards/Credit, Planning, Action Center, auth/session, recovery and branding. Table/card/chart hierarchy remains contained and readable on desktop/mobile; Reports KPI/chart/account/privacy surfaces, Transactions tables/detail rails, Cards carousels, Planning forecast cards and progressive disclosure states show no material clipping/overlap. The same artifact's rendered QA logs additionally prove viewport-contained tooltips, deterministic pagination/sorting and disclosure interactions rather than inferring them from source alone.
- [x] Inspect typography, spacing, alignment, icon optical size, border/elevation consistency, semantic color usage, contrast, truncation/wrapping and visual rhythm component by component. Direct assistant review of the 85 focused current-branch screenshots, together with the already completed 132-image light/dark desktop/tablet/mobile baseline review, found no material typography/alignment/elevation inconsistency or broken wrapping/truncation on the inspected surfaces. Semantic color and contrast are separately backed by the computed-theme checks; long/dense/extreme-content edge cases remain tracked by their dedicated pending item rather than being hidden here.
- [x] Inspect 200% browser zoom, increased app text-size/readability settings, reduced-motion mode and system theme changes without reload regressions. Exact-head CI #3216 passed the route-wide 720×500 200%-equivalent geometry sweep with `text=large` + reduced motion across every primary route, including no horizontal overflow/off-viewport controls. Theme System QA on the same source head passed explicit Light/Dark switching without navigation, System preference resolving emulated OS dark→light in-place, and persisted Dark application during actual app startup. Direct assistant inspection of the Large-text Settings evidence, actual Dark startup/focus evidence, and the corrected Light/Dark focused 404 200%-equivalent captures confirms readable containment and distinct semantic theme surfaces rather than dataset-only labeling.
- [x] Inspect Windows/Electron rendering separately for any host-specific chrome, update UI, first-run/lock/startup diagnostics and scaling differences. Exact-head CI #3224 passed the dedicated real-component Desktop host suite. Direct assistant inspection opened all 11 host captures individually at useful resolution: App Lock locked/invalid/rate-limited at 1440×930 and 1100×760; Update Panel available/downloading/ready/error/up-to-date at 1440×930 and 1100×760; and the real `desktop/setup.html` recovery diagnostics/copy-success surface at 760×840 plus the 620×650 minimum window. No horizontal clipping, finance-data disclosure or broken action/status hierarchy was found; the minimum recovery window scrolls vertically as expected. Native package/window mechanics remain separately backed by the green Windows Desktop/First Run/Clean Launch gates.
- [x] Maintain a screenshot manifest with explicit human-review disposition for every required capture; no capture is considered passed merely because automation produced a PNG. `docs/completion/FINAL_VISUAL_MANUAL_REVIEW.md` records direct assistant inspection of every one of the 132 captured images, grouped into the 22 six-capture surface/state sets, with explicit PASS/PASS_WITH_FOLLOWUP dispositions and scope boundaries.

### 8.3 Professional UI/UX and accessibility audit — 12/12

- [x] Review global information architecture and navigation: grouping, labels, route discoverability, back/close behavior and mobile More-menu prioritization. Direct assistant visual review across the complete primary-route light/dark desktop/tablet/mobile capture set found coherent primary navigation, stable route grouping and no captured navigation/chrome regression; source/routing review separately proves deterministic hash navigation/back recovery.
- [x] Review each page for visual hierarchy, primary/secondary action priority, scanability, density, progressive disclosure and finance-specific comprehension. Direct assistant inspection of all 132 baseline captures found no material hierarchy/scanability defect across Dashboard, Transactions, Savings, Cards/Credit, Loans/Lending, Recurring, Planning, Attention, Reports, Settings, Auth and 404; targeted dense/extreme/state checks remain tracked separately.
- [x] Review every create/edit form for field order, labels, defaults, helper text, validation timing, error placement, destructive separation and save/cancel clarity. Direct assistant source review covered Quick Entry/contextual flows, Savings, Cards/card vault, Credit, Loans, Lending, Recurring, Planning, budgets/rules, account/provider management, taxonomy/icons, receipt review and account-security settings. Editable fields consistently use explicit labels/defaults and owned inputs, validation remains task-local with alert/error surfaces and user-safe copy, destructive operations are separated through confirmation boundaries, and modal/editor actions preserve clear primary-save versus secondary-cancel hierarchy; intentional semantic composite controls remain distinct from ordinary form fields.
- [x] Review feedback architecture for loading, saving, optimistic updates, success, warning, conflict, empty state, retry and irreversible action confirmation. Direct assistant review confirms one shared persistence feedback model for loading/saving/saved/error/conflict with polite/assertive live regions and explicit recovery; form/task errors use owned alert surfaces and redacted user-facing copy; destructive actions use app-owned alertdialogs with safe cancel focus; domain pages expose success/status messaging and explicit empty states rather than silent no-op behavior.
- [x] Review consistency of shared primitives versus one-off controls; equivalent actions must look and behave equivalently across pages. Direct assistant source audit confirms shared Button/IconButton, DialogShell, MoneyInput, AppTextInput/AppSelectInput/AppDateInput, Surface, PageHeader and FormError contracts are used across equivalent actions/forms; remaining raw buttons are intentional semantic composites such as tabs, radios, grid/list options and domain rows. Shared focus-visible/theme/touch-target contracts and representative rendered primitive-adoption flows provide cross-page behavior evidence.
- [x] Review mobile ergonomics: touch targets, thumb reach, bottom-navigation/FAB conflicts, keyboard viewport behavior, modal sizing and horizontally dense financial data. Direct assistant review combines the 375/320px visual sets with rendered geometry/UI-hardening/WebKit contracts: visible mobile controls are checked at >=40–44px, fixed bottom chrome is collision-tested at page bottoms, Quick Add/command/modal surfaces are overflow-tested, dense Transactions/Reports remain contained, and narrow mobile WebKit smoke is green.
- [x] Review desktop ergonomics: information density, pointer targets, keyboard efficiency, table behavior, shortcuts, command palette and window resizing. Direct assistant review combines the desktop visual set with command-palette, Transactions/table and geometry contracts: Ctrl+K focus/keyboard navigation and contextual actions are exercised, semantic table sorting/actions are verified, desktop controls remain disclosed/contained, and all primary pages are geometry-audited at 1440px and tablet/resized widths without chrome overlap or rogue controls.
- [x] Verify keyboard-only operation for all interactive flows: logical tab order, no focus traps outside modals, modal focus trap, focus restoration and visible focus. Exact-head CI #3200 passed the desktop/mobile tab sweep across every primary route, every Settings tab and login/MFA states, plus Quick Entry, Command Palette and mobile More modal focus traps with Escape dismissal and opener-focus restoration. Direct assistant review of artifact `11279915351` inspected the mobile Dashboard and 200%-equivalent 404 captures at useful resolution and confirmed visible contained focus; source review confirmed the sweep rejects hidden/offscreen focus, positive tabindex and missing focus-visible styling.
- [x] Verify semantic accessibility: headings, landmarks, labels, names/roles/values, table semantics, dialog names, live/status messaging and non-color-only communication. Direct assistant review of the exact-head keyboard/semantic harness confirms one visible H1 and one main landmark per audited surface, accessible names for controls, no focusable descendants under `aria-hidden`, alt text for visible images, captions/headers for visible tables, named/value-bearing progressbars, alert/status semantics, every Settings tab and login/MFA error states. Artifact `11279915351` is sourced from GitHub PR merge commit `62433a07…`, whose tree has no file differences from head `e3db955a…`; representative captures were manually inspected. Non-color-only communication remains independently covered by the completed contrast/grayscale review.
- [x] Verify WCAG-relevant contrast for text, controls, focus/borders and states in light/dark themes; verify reduced motion and animation does not block interaction. Direct assistant review combines the full Light/Dark route screenshot matrix with rendered computed-contrast checks: representative text is >=4.5:1, interactive dark controls/borders are checked at >=4.5:1 text and >=3:1 boundary contrast, focus indicators use the shared semantic focus tokens, and grayscale review confirms important states are not color-only. Reduced-motion behavior is centralized through system/reduced motion handling in the shell/dialog/command/dashboard animation boundaries, and rendered reduced-motion interaction flows complete without relying on animation timing. This is a product accessibility verification, not a claim of formal WCAG certification.
- [x] Review Greek localization/content quality: terminology consistency, grammar, capitalization, amount/date formatting, wrapping and avoidance of ambiguous financial wording. Direct assistant review combines the complete 132-image Greek UI matrix with source inspection across auth, navigation, finance forms, Settings, errors and recovery. Greek is the default product language; intentionally retained technical/brand terms are documented in `docs/completion/CONTENT_AND_FEEDBACK_AUDIT.md`, finance dates/currency use the shared Greek locale contracts, and no material mixed-language or ambiguous finance wording defect remains in the reviewed surfaces.
- [x] Produce a designer/developer defect log with severity, affected surfaces, systemic root cause and preferred component/design-system-level remediation. `docs/completion/UI_UX_DEFECT_LEDGER.md` is the assistant-owned defect ledger and records the current systemic visual/interaction findings, severity, root causes, remediation layer and proof state.

### 8.4 Complete functional user-flow / CRUD verification — 24/24

- [x] Authentication: valid/invalid email-password login, logout and session restoration. Direct assistant review of zero-cost Real Stack E2E #14 on exact head `05b8138…` confirms invalid credentials fail, valid credentials establish the synthetic local owner session, cookie-backed session restoration succeeds and logout clears the session against the real MyFinHub API + local Supabase Auth stack.
- [x] MFA: enrollment, challenge, wrong code, successful verification and post-AAL2 bootstrap. Real Stack E2E #14 directly passed TOTP enrollment, an intentionally wrong code, successful verification and the first post-AAL2 session bootstrap with the repository's explicit local TOTP configuration; mandatory MFA was not bypassed.
- [x] Device sessions: list, current-device state, revoke another device, revoke-others, revoked-device re-authentication and stale-session handling. Real Stack E2E #14 created two real AAL2 sessions, verified current/other discovery, revoke-others, fail-closed stale-session access, fresh re-authentication and single-device revoke through the real API/RLS registry.
- [x] Dashboard: account rendering, privacy toggle, IBAN copy, primary shortcuts, period changes and navigation to contextual destinations. Direct assistant review of the rendered Dashboard hierarchy/account-metadata suites and source contracts verifies primary/secondary account rendering, masked IBAN + copy confirmation, session-scoped privacy state, one desktop/mobile global Quick Entry, search/command access, current-period navigation guard, contextual Attention/Planning routing and responsive mobile analytics disclosure without finance-data exposure.
- [x] Modern transactions: create, edit, delete, search, filters, sorting, pagination/load-more, reload persistence and derived balance/report updates. Direct assistant review of Real Stack E2E #23 on exact head `1bd6acc5…` confirms the **real built application** signed in through Login+MFA, created `Real Browser Expense`, hard-reloaded, edited it to `Real Browser Expense Edited` / €13.45, hard-reloaded, deleted it, hard-reloaded, then used durable Undo and hard-reloaded again against the real local API/Supabase stack. The directly inspected `modern-transaction-persisted.png` shows the restored persisted row and matching details panel, while the transaction summary recalculates to €13.45 expenses / €86.55 net. Existing rendered transaction QA on the unchanged product surface already covers type/account filters, ASC/DESC ordering, zero-result search and bounded pagination/load-more.
- [x] Legacy transactions: edit override, delete tombstone, undo, redo, filtering/search and reload persistence. Direct assistant review of Real Stack E2E #23 confirms the real Transactions UI edited the immutable synthetic seed through an override to €101.25, hard-reloaded, tombstoned it, hard-reloaded, used durable Undo and hard-reloaded again; direct API read-back in the browser harness verified override/tombstone persistence at each boundary. The directly inspected `legacy-transaction-persisted.png` shows the restored override row and matching details panel. Existing rendered legacy QA on the unchanged product surface separately proves tombstone Redo, search/filter behavior and mobile parity.
- [x] Split transactions: create balanced split, edit split, inspect disclosure, reject imbalance, delete and verify reporting/ledger effects. Direct assistant review of the rendered ledger-foundations flow confirms authoritative part-only creation, live derived totals, compact/expanded disclosure, rejection of non-positive parts, edit-derived parent totals, confirmed delete + atomic undo and mobile parity; finance invariant/report tests separately prove balanced cent legs and one-time spending/report treatment.
- [x] Generic Quick Entry: income, expense, transfer, withdrawal, refund/reconciliation-supported paths, validation and contextual prefills. CI #3186 completed the rendered generic Quick Entry intent/validation flow together with global `Ctrl+Shift+Space`, visible desktop action, ledger transfer coverage and contextual Action Center/payment prefills. The same functional suite exercised expense, income, withdrawal, refund and reconciliation paths while the mutation-validation suite retained task-local failure handling.
- [x] Savings: savings transfer, target-rate change, goal create/edit/delete, planned-saving interactions and history/report effects. CI #3186 passed goal create/edit/delete plus the contextual manual savings transfer with distinct source/destination accounts, note/history exposure, target progress and report-neutral income/expense semantics; Budget/Rules QA passed the Savings target-rate edit. The accepted planned-saving interaction is the Savings target/progress model, while scheduled transfers remain owned by Planning.
- [x] Cards profile lifecycle: bank/provider selection, card create/edit, archive, restore/reactivate where supported, delete, network rendering and provider artwork. Exact-head CI #3200 passed the expanded Completion Functional CRUD flow: create through profile + secure-details save, archive, restore with preserved last4 metadata, re-archive and owned permanent-delete confirmation. Existing profile edit, Mastercard-network preservation and provider artwork checks passed in the same rendered suite.
- [x] Card vault: save/reveal/update/delete secret material through server boundary, reload behavior, invalid secret input and no plaintext leakage into FinanceData/backups. Direct assistant review of exact-head CI #3213 on `c9cee0c…` confirms the dedicated rendered suite completed inside the full coordinator: invalid input never reached PUT, save/reveal succeeded through the synthetic server boundary, a real hard `Page.reload` re-revealed the server secret with separately persisted `vaultRef` metadata, update succeeded, explicit DELETE cleared the next reveal, and the module printed its completion marker before the coordinator finished all rendered suites successfully. Encrypted-store/unit regressions separately prove ciphertext-only persistence and FinanceData validation rejects PAN/card-number/expiry/CVV aliases, preserving the no-plaintext boundary.
- [x] Credit: purchase lifecycle, statement association, payment, over-limit state, statement history, card edit/archive and resulting balances. Real Stack E2E #28 on exact head `044d7206…` passed the real built Credit UI against the disposable local API/Supabase stack: a €25.50 purchase survived hard reload with persisted statement/next-payment state, payment of that same statement survived another reload and returned used credit to €0.00 / available credit to €300.00 while preserving the purchase history. I directly inspected `credit-purchase-persisted.png` and `credit-payment-persisted.png` from artifact `11301196365`; they show the expected €25.50 used/€274.50 available before payment and €0.00 used/€300.00 available after payment without clipping or stale duplicates. Existing directly reviewed credit rendered evidence on the unchanged product surface covers over-limit handling, statement history, profile edit, archive/restore and protected total-delete boundaries.
- [x] Loans/installments: create, edit, payment, multi-installment coverage, completion/history, linked recurring behavior and self-loan semantics. CI #3186 passed loan create/edit, self-loan creation/partial return/forgiveness, normalized multi-installment payment coverage, linked-loan payment from Recurring and obligation completion/history with no residual payment CTA. The self-loan proof also retained the neutral-transfer invariant with no synthetic movement on forgiveness.
- [x] Lending/receivables: lend, partial repayment, full repayment, person aggregation, history, privacy and outstanding/net-worth effects. Exact-head CI #3181 completed the rendered Lending create → partial 12/42 repayment → final 30 repayment lifecycle, proved one lend + two semantic repayments, settled/disabled repayment state, privacy reveal/hide behavior and history aggregation; the same exact-head check suite passed lending domain/invariant tests that verify receivable outstanding and net-worth treatment.
- [x] Recurring: create/edit, cadence variants, pause/reactivate/stop, pay, bounded disclosure/history and linked-loan boundaries. CI #3186 passed the expanded functional recurring lifecycle, mutation validation, cadence suite, normalized recurring payment/undo path, linked-loan boundary and obligation-history/extreme-list suites. The lifecycle harness carries the created item through edit, pause, reactivate and stop while inactive history remains non-payable.
- [x] Planning/scheduled: create/edit, complete into real event, skip/cancel where supported, load-more, forecast update and negative forecast state. Direct assistant review of exact-head CI #3172 plus the corresponding rendered evidence verifies scheduled creation leaves current liquidity unchanged, edit updates the pending item, completion atomically creates the real event, undo/redo restore both sides, skip/cancel persist explicit history through owned confirmations, the extreme list expands through `Προβολή περισσότερων`, 30/60/90 horizons update, and negative/empty/extreme forecast states remain explicit. I directly inspected the desktop, mobile and negative-forecast captures from artifact `11254561873`; they are contained and readable with no material visual regression. Real-backend reload/persistence remains tracked separately in 8.12 and 8.5 rather than being inferred here.
- [x] Attention/Review: open actions, decision states, snooze/dismiss/keep semantics where supported, contextual navigation and no unintended report mutation before confirmation. Exact-head CI #3183 passed the Action Center/contextual Quick Add rendered suite: deterministic queue/privacy, legacy `Κράτα ως είναι` with byte-stable Reports KPIs, recurring/loan/credit/scheduled/account/savings/lending contextual actions, snooze + undo, empty state and responsive accessibility.
- [x] Reports/analytics: period changes, KPI/category/flow consistency, table/chart parity, privacy and recalculation after mutations. Exact-head CI #3183 passed Reports visual QA after the syntax repair: desktop/mobile hierarchy, previous-month July recalculation and return to August, KPI/category/flow structure, dark-mobile privacy placeholder, empty and over-limit states; exact-head mutation validation and Action Center keep-semantics separately proved report recalculation/neutrality around mutations.
- [x] Budgets: create/edit/delete, thresholds, category/overall scopes, alert state and report reconciliation. Exact-head CI #3184 passed the complete Budget/Rules rendered suite after the accessible-input harness repair: Dashboard/Reports budget integration, category + overall scope management, warning threshold/near-limit state, report reconciliation, create → stable-row edit → delete, Savings target relocation and mobile containment.
- [x] Transaction rules: create/edit/delete, matching, rule application to new transactions and no retroactive mutation unless explicitly designed. Exact-head CI #3184 passed the human-facing Rules workspace flow: read-only preview, create/reorder/pause/edit/delete, existing `QA Market Match` retained its original category, and a newly created matching transaction received the rule-selected category.
- [x] Settings account/provider metadata: account create/edit/delete, IBAN/provider correction, provider create/edit, asset upload/reuse/binding/replace and cross-surface refresh. Exact-head CI #3196 passed Account Metadata QA and the expanded Provider Branding task flow, including real Save, provider-list replacement and the same replacement source on Dashboard before the job later timed out in coordinator teardown.
- [x] Taxonomy/icons/preferences: category/subcategory create/rename/move/retire/blockers, icon pack/assignment persistence, theme, text-size and other user-facing settings persistence; reduced-motion accessibility follows the accepted product contract via platform/CSS `prefers-reduced-motion` rather than a user-facing Motion preference. Exact-head CI #3190 passed Taxonomy management, cross-app category icon, Icon Packs, Theme System, Recovered Surface readability and UI/UX reduced-motion coverage. The rendered taxonomy suite proves category/subcategory add/rename/reorder/move/retire/blockers with stable identities; Icon Packs proves pack/icon/color persistence across navigation and transaction rendering; Theme System proves explicit/system theme persistence including real app startup; text-size is stored in Finance settings and rendered Large state; OS `prefers-reduced-motion` remains the accepted accessibility contract.
- [x] Data management/history: backup, export/import, validation rejection, history points, undo/redo across supported scope, refresh/reload and conflict handling. Real Stack E2E #29 on exact head `7d56b752…` drove the production-built Settings → Data UI against the disposable local API/Supabase stack: real `/api/backup` returned 200 and the browser observed the JSON export action; an intentionally invalid import returned HTTP 400 while the canonical revision stayed unchanged; a valid synthetic import persisted through hard reload and Dashboard read-back; and Change History exposed the server-backed current `Εισαγωγή δεδομένων` point with the product's explicit non-Undo/Redo import scope. The same exact-head run retained the earlier real history undo/redo, backup→restore, hard-reload and revision-conflict assertions. I directly inspected `data-management-import-history-persisted.png` from artifact `11300858918`; the current import point and surrounding durable changes are readable and correctly contained.
- [x] Receipt OCR + global tools: local receipt capture/inbox/OCR/proposal correction → Quick Entry, command palette actions, keyboard shortcuts, global refresh and page error recovery. CI #3186 passed packaged OCR asset reachability, capture persistence/reload, recoverable asset failure/retry, proposal correction → Quick Entry, Command Palette global/direct actions including `Ctrl+Shift+Space`, global undo/redo shortcuts, in-place refresh and focused PageErrorBoundary recovery.

**Settings account/provider proof closure:** the Provider Branding suite already contains the missing replace/cross-surface flow: after uploading/rebinding the existing Piraeus base logo it closes the editor, verifies the provider-list artwork source changed, navigates to Dashboard and requires the same replaced image `src` there before returning to Settings. CI #3190 passed this together with account metadata/provider correction and provider create/upload/recovery flows, so the cell is closed without new product code.

**Motion preference scope alignment:** `docs/PRODUCT_MODEL_2026-08.md` explicitly requires removal of the Motion preference from Settings UI. MyFinHub stores/defaults to full motion while the UI continues to respect platform accessibility through `prefers-reduced-motion`. Verification must therefore prove OS/platform reduced-motion behavior, not invent a user-facing persistence control. This corrects stale checklist wording only and does not change the denominator.

### 8.5 Data integrity, persistence and finance invariants — 8/9

- [ ] For every successful mutation, verify UI state, domain state, persisted state and relational representation agree after hard reload/new session.
- [x] Verify internal transfer/withdrawal/savings-transfer/card-payment/reconciliation semantics do not double-count spending and all transaction legs balance. Direct source/test audit confirms transfer/withdrawal/savings events are portfolio-neutral, card payments are cash-flow neutral while purchases count once, reconciliation is budget/spending neutral, exact semantic ledger legs are server-validated, and the executed invariant suites are green.
- [x] Verify credit purchase versus liability payment semantics, statement references, limits/debt/available credit and archived-card historical references. Direct executed tests cover purchase/payment debt math, independent card limits/available credit including over-limit state, deterministic statement assignment/payment/deletion, archive/restore/delete constraints, and historical event identity through neutral deleted-card tombstones.
- [x] Verify lending receivables and repayments update net worth and outstanding balances correctly. Direct executed tests show lending reduces cash while adding an equal receivable asset, repayments reverse receivable delta while restoring cash, repeated legacy/person history aggregates deterministically, malformed history fails safely, and net worth remains correct.
- [x] Verify split totals, recurring/scheduled completion semantics, budget/report calculations and time/period boundaries. Direct executed tests cover safe-cent split totals/rejection, scheduled completion into actual events plus skip/cancel forecast exclusion, recurring monthly/6-month/annual/leap-day cadence, budget split/refund/transfer/reconciliation treatment, report category/credit/period calculations and short-month statement boundaries.
- [x] Verify optimistic revision conflicts, multi-tab/newer-revision behavior, sequential mutation ordering and fail-closed persistence queues. Direct executed tests prove FIFO persistence ordering, discard of dependent queued mutations after failure, deterministic reload/conflict selection for newer remote revisions and preserved 409 conflicts; production save/history RPCs independently enforce revision + history-generation preconditions before mutation.
- [x] Verify history/audit/undo-redo atomicity and bounded retention; failed writes must not create misleading success/history state. Direct production function inspection confirms save/undo/redo lock the canonical state and history cursor, reject revision/generation conflicts before mutation, update ledger/state/history/audit inside one PostgreSQL function transaction, prune expired history, cap visible/history storage at 100 points, and keep failed function executions transactional.
- [x] Verify backup/import round-trip preserves supported finance state while excluding card-vault secrets and other prohibited sensitive material. Direct production evidence shows a current-revision backup exactly matches the canonical effective FinanceData, 0 backup documents contain sensitive card/token/TOTP key names, backup creation composes relational state without referencing the card-secret table, import uses the relational ledger apply path with an explicit `LEDGER_ROUNDTRIP_MISMATCH` guard, and pre-import backups are created transactionally.
- [x] Run aggregate database integrity checks after test flows: FK/orphan checks, duplicate identifiers, account references, provider/storage references and history cursor/state consistency. Direct production aggregate SQL reports 0 duplicate account/card/event/scheduled/recurring/budget identifiers, 0 orphan ledger/card/recurring references, 0 invalid provider bindings, 0 missing active provider Storage objects, and a history cursor whose finance revision/current point matches canonical state.

### 8.6 Backend, API, Supabase and Storage audit — 12/12

- [x] Reconcile repository migrations against the live migration ledger. `manage_financial_provider_assets` was applied to production on 2026-10-01 and recorded by Supabase as version `20261001192135`; the repository migration filename was aligned to the live ledger. Post-migration read-only proof: bindings table exists with 35 rows, 4 provider-management RPCs exist, 10 owner/AAL2 write policies exist, 0 invalid bindings and 0 active assets missing Storage objects.
- [x] Verify every API route and allowed HTTP method on valid requests, including response schema/status/header contracts. Direct assistant inventory covered all 12 Vercel API entrypoints plus delegated account-metadata, card-vault, account-security and device-session handlers. Every route has an explicit allowed-method contract, successful paths return controlled JSON envelopes through `sendJson`/shared handlers, JSON responses are privacy-safe `no-store`, known unsupported methods return 405 with `Allow`, and unknown API routes remain JSON 404 rather than falling into HTML.
- [x] Verify cookie-auth and explicitly approved bearer-auth boundaries independently; malformed/rejected bearer auth must fail closed without cookie fallback. Direct source/test review confirms bearer auth is explicit opt-in, rejected bearer credentials never fall back to ambient cookies, cookie-only endpoints ignore Authorization, bearer flows never set browser cookies, and native finance/vault requests keep CORS closed.
- [x] Verify owner + AAL2 + active-device authorization at API and PostgreSQL RLS/RPC layers with negative tests for anonymous, non-owner/AAL1 and revoked-device contexts. Direct production probes return unauthenticated 401s on protected finance/metadata/history APIs; source inspection confirms every sensitive handler requires session→owner→AAL2 and active-device enforcement is centralized in session finalization; direct production SQL proves an active owner+AAL2 session sees finance rows while AAL1, non-owner and unknown-session contexts see none; revoked-device behavior is covered by the exercised device-registry contract.
- [x] Verify same-origin/CSRF policy, CORS behavior, request-size limits, content-type validation and malformed body/query handling on state-changing endpoints. Direct endpoint inventory plus exact-head regression coverage confirms cookie mutations require same-origin, approved bearer mutations do not add CORS, JSON/binary bodies have explicit byte ceilings and Content-Length validation, unsupported media types/malformed JSON are controlled 4xx responses, and duplicate/array query shapes fail closed.
- [x] Verify optimistic-revision preconditions, atomic finance write + history behavior, backups and import transactionality. Direct production function definitions confirm `FOR UPDATE` locking, revision/history-generation preconditions, automatic/pre-import backups, relational-ledger apply + app-state update + history cursor/point + audit insertion within single PL/pgSQL transactions, and rollback-on-exception semantics for failed saves/imports/undo-redo.
- [x] Verify card-vault encryption/decryption boundary, ciphertext-only database storage, key absence from distributed clients and redaction of diagnostics/logs. Direct review confirms AES-256-GCM with owner/card/version AAD, 12-byte random IVs and authenticated tags; the live table contains only ciphertext/iv/auth_tag/key_version fields under owner+AAL2 RLS; backups do not reference the card-secret table; the packaged Desktop entrypoint deletes legacy CARD_VAULT_KEY material before loading the host and runtime defaults contain no vault key; generic 5xx logging records only requestId/code/status/error type.
- [x] Verify account metadata/provider APIs, provider creation/update, Storage upload/replace, asset registration/bindings and partial-upload recovery semantics. Direct assistant review covers strict API parsing, create/update RPC boundaries, generated provider-scoped Storage paths, bounded MIME/signature validation, asset registration/binding reads and writes, catalog refresh, reusable slot bindings, Storage cleanup on registration failure and recoverable UI behavior when provider creation succeeds but a subsequent asset upload fails. Live Supabase verification confirms the provider/asset/binding tables and RPCs are present with zero invalid bindings and zero active assets missing their Storage object.
- [x] Verify Storage policies and object-path/MIME/size/signature/SVG safety rules, including replacement permissions and orphan-object/metadata handling. Direct source/live-policy review confirms owner+AAL2 INSERT/SELECT/UPDATE/DELETE permissions, provider-scoped path regexes, a 2 MiB byte ceiling, PNG/JPEG/WebP signatures, restricted SVG active-content patterns, strict asset/query shapes, bounded binary parsing and cleanup of an uploaded object when metadata registration fails; live integrity shows 0 missing Storage objects and 0 invalid bindings.
- [x] Verify relational ledger constraints/FKs/RLS and canonical state↔relational consistency on the real schema without exposing sensitive finance content. Direct read-only proof on 2026-10-01: relational_v1 is active; events/cards/statements/budgets/recurring/scheduled/legs all match the composed canonical state counts; 0 orphan legs, 0 orphan statement→card refs, 0 orphan recurring→account refs and 0 invalid scheduled account refs; all 8 private ledger tables have RLS and owner+AAL2 policies.
- [x] Run Supabase security/performance advisors and classify every finding; do not remove unused indexes without query evidence. Security advisor: only leaked-password protection disabled, documented as a Free-tier/external Auth-setting limitation. Performance advisor: 11 unused-index INFO findings retained because no query evidence justifies removal.
- [x] Inspect bounded production/staging backend logs for recurring 4xx/5xx/database/storage/auth failures and correlate actionable failures with tested paths without exposing sensitive data. A privacy-safe 24h aggregate found 0 edge/auth 5xx. PostgreSQL errors were limited to expected owner/AAL2 denials plus management-audit query syntax/column mistakes from this verification session; no recurring production backend 5xx pattern was found.

### 8.7 Error handling and resilience matrix — 10/10

- [x] Exercise 400/validation failures for every mutating form/API and verify field/task-local actionable messages. Direct assistant review of CI #3169 for PR head `2bed84e…` confirms the 7-case mutating API validation matrix passed and the rendered validation suite completed 16 invalid-submit flows across Quick Entry, Savings, Loans, Lending, Recurring, Planning, Cards/card vault, Credit, account/provider/rule/category/security Settings, bank creation and Reports budgets. Every rendered flow remained in its task surface and required a non-empty task-local `role="alert"`; the relevant validation sources are unchanged on the current integration/staging heads.
- [x] Exercise 401 auth expiry, 403 owner/AAL2/device denial and revoked-session behavior; verify safe redirect/re-auth without data loss or misleading signed-in UI. Direct assistant review confirms all failed API responses feed the shared auth-expiry dispatcher; 401 auth/device revocation clears client session state, 403 `MFA_REQUIRED` refreshes session state instead of leaving stale authenticated UI, revoked AAL2 device sessions fail closed at the server boundary, and transient Auth 503/504 errors preserve cookies rather than forcing logout.
- [x] Exercise 409 revision/conflict behavior and verify conflict messaging, no silent overwrite and deterministic recovery. Existing executed regression coverage proves stale revision conflicts stay 409, queued dependent mutations are discarded after the first failed save, remote newer revisions become reload/conflict deterministically, and the UI enters an assertive conflict state with an explicit latest-version recovery action; production RPCs enforce revision/history-generation preconditions before mutation.
- [x] Exercise 413 oversized payload/upload and invalid MIME/signature/file-path failures. Direct regression execution covers bounded JSON/binary bodies, provider uploads over the 2 MiB ceiling, unsupported MIME, signature mismatch, active SVG rejection and traversal-shaped provider identifiers; CI is green on `3f8867b…`.
- [x] Exercise 429/rate-limit paths for auth and any rate-limited backend operation with retry guidance that does not encourage request storms. Direct tests cover Supabase Auth throttling, finance data throttling and card-vault throttling with distinct stable codes and retry-later guidance; CI is green on `3f8867b…`.
- [x] Exercise 500/502/503 upstream/database/storage/auth outages and verify stable public error codes/messages, request IDs where appropriate and no raw upstream leakage. Direct tests cover transport/auth/data/metadata outage mapping, unexpected upstream 502 redaction and generic unexpected 500 request-ID/redaction behavior; CI is green on `3f8867b…`.
- [x] Exercise network timeout/offline/interrupted-save behavior, browser reload during save and retry/idempotency semantics. Direct assistant review confirms bounded request timeouts and explicit network/offline errors, sequential finance writes fail closed without automatic retry, dependent queued mutations are discarded after a failed save, later retries require an explicit new action/reload, beforeunload warns while work is pending or the last save failed, and remote revisions reload only clean tabs while unsafe local work becomes a conflict.
- [x] Exercise partial multi-step failures such as provider created but one asset upload/binding fails; verify recoverable state and no false all-success message. Direct assistant review plus rendered Chromium QA on `987aab0…` proves the provider row can succeed before a subsequent asset upload failure while the editor remains open/recoverable, no success banner is emitted, the task-local upload error is shown, and the editor switches to existing-provider semantics. The lower-level upload path separately proves a successfully uploaded Storage object is deleted when the metadata-registration RPC fails.
- [x] Exercise client render errors, lazy-chunk/resource failure, OCR asset failure and error-boundary recovery. Direct assistant review plus exact-head rendered CI on `81bff44…` proves synthetic render faults and rejected lazy resources reach the privacy-safe focused PageErrorBoundary without raw exception leakage; missing local OCR assets preserve the IndexedDB receipt and surface manual/retry guidance; the rejected OCR worker bootstrap is cleared so a later retry succeeds after the local asset becomes available. Recovered-surface and receipt-local-OCR suites both passed in the primary Chromium run.
- [x] Audit every user-facing error/warning/success message for accuracy, persistence, accessibility announcement, redaction and appropriate recovery action. Direct assistant review of the shared message/error owners plus all domain form/error pathways confirms task-local validation, assertive errors/conflicts, polite progress/success status, technical-error redaction, explicit retry/reload/re-auth/manual-recovery actions and no false success after failed persistence. The audited message families and recovery contracts are recorded in `docs/completion/CONTENT_AND_FEEDBACK_AUDIT.md`.

### 8.8 Security and privacy verification — 8/8

- [x] Resolve all current CodeQL alerts on the exact candidate head and require CodeQL green without dismissing valid findings. Exact-head CodeQL #3125 passed on `b602617…` after FV-54 removed per-request filesystem access from the static `index.html`/`404.html` handlers; the two prior rate-limiting review threads are no longer unresolved and the cached-document routing regression remains in place.
- [x] Run dependency audits for root/API/desktop and review high/critical advisories plus transitive desktop/runtime exposure. Exact-head-equivalent root/API dependency locks pass `npm audit --audit-level=high` and API audit on the latest green CI; the desktop package lock is unchanged from the last green Windows Desktop run whose `desktop:check` includes its own high-severity audit. No package/lockfile changed between that Windows evidence and the current branch.
- [x] Verify security headers/CSP, no unsafe inline/executable receipt/provider content and no unexpected external resource dependency. Direct source review confirms the exact-head CSP keeps object/frame/form restrictions, forbids generic script eval while permitting only WASM eval for self-hosted OCR, limits provider images to the canonical Supabase project origin, removes obsolete legacy image hosts, keeps receipt OCR/assets same-origin/local, and leaves only intentional runtime network origins (canonical production API, Supabase, GitHub release update checks).
- [x] Verify no service-role/secret key, `CARD_VAULT_KEY`, access/refresh token, TOTP secret, PAN/expiry/CVV or personal finance data leaks to bundles, logs, screenshots, backups or repository artifacts. Exact-head-equivalent CI on `8e571c2…` proves both the tracked-file privacy guard and generated-release artifact privacy guard pass; generic 5xx logs are redacted by contract, production backups contain no sensitive card/token/TOTP keys, card-vault data is isolated outside FinanceData/backups, and visual QA uses synthetic fixtures rather than production finance data.
- [x] Verify session cookie attributes, logout/revocation behavior and active-device enforcement at sensitive boundaries. Direct source review confirms production access/refresh cookies use `__Host-` names, Path=/, HttpOnly, SameSite=Strict and Secure; logout attempts device-session termination plus upstream revocation and always clears local cookies; rejected/revoked sessions clear cookie state appropriately; active-device enforcement is centralized for AAL2 sessions and already directly proven fail-closed at RLS.
- [x] Verify RLS/grants/function security-invoker/definer posture and exposed-schema tables; no accidental broad authenticated/anon access. Direct production SQL proof confirms all relevant public/private finance tables have RLS where exposed, anon has no finance table grants or executable finance RPCs, the only relevant SECURITY DEFINER helper is `private.myfinhub_session_is_active` with no anon execute, and owner+AAL2+active-session contexts see the expected rows while AAL1/non-owner/unknown-session contexts see none.
- [x] Verify provider/receipt image handling against malicious filenames, MIME confusion, active SVG content, oversized files and path traversal attempts. Provider uploads use generated provider-scoped Storage paths independent of the supplied filename, enforce bounded bytes plus MIME/signature checks, and reject active SVG script/foreignObject/event/javascript patterns; receipt capture accepts only bounded JPEG/PNG with signature checks and normalizes through canvas without using filenames as paths.
- [x] Re-run secret/security guards and review generated artifacts before final merge/release. Exact-head CI on `0d747e2…` directly shows the tracked-file privacy guard passed across 774 tracked files, all 152 test files / 852 tests passed, the release privacy artifact guard passed, bundle budgets passed, and both root/API high-severity dependency audits passed. This item must be reopened if the final candidate head changes after a security-relevant modification.

### 8.9 Browser, responsive, performance and Windows verification — 9/9

- [x] Chromium full rendered suite on exact head. Direct assistant log review of CI #3216 on source `74bdc0c…` confirms every rendered module emitted its completion marker, including local production routing, Card Vault, functional CRUD, Theme System, Credit/Reports, 404 accessibility, large-data boundaries and the final keyboard/semantic accessibility sweep; the coordinator finished `All rendered browser QA suites passed on primary Chromium` with zero fallback activations. Root/API checks and both npm audits also completed successfully.
- [x] WebKit compatibility suite on exact head; direct assistant log review confirms WebKit 26.5 installed successfully and the exact-head smoke completed login/MFA semantics, owned controls/modal focus, mutation+undo, Reports accessible chart alternative and narrow-mobile containment with uploaded evidence.
- [x] Additional supported-engine/browser smoke where product support requires it, including Edge/Chromium host behavior. Direct assistant support-contract review found no Edge-specific browser promise beyond the Chromium engine family; the product's automated browser contract is primary Chromium plus focused WebKit compatibility, while the Windows application runs the Chromium/Electron host. Exact-head WebKit and Windows Desktop/First Run/Clean Launch are green, so the supported non-primary engine/host behavior is covered without inventing an unsupported Edge-only release gate.
- [x] Responsive geometry/overflow sweep across representative intermediate widths, orientation/resize transitions and mobile virtual-keyboard conditions. Direct assistant log review of rendered Chromium run `37043142508` confirms canonical desktop/tablet/mobile/narrow routes, 1024 desktop, 1112×834 tablet landscape, 681/680 breakpoint transitions, 812×375 phone landscape and dynamic resize transitions all remained overflow-clean after the Planning breakpoint remediation; the interaction-dialog suite also passed the 375×500 virtual-keyboard-equivalent profile.
- [x] Performance/Lighthouse budget gate plus large realistic dataset interaction checks for navigation, filtering, tables/charts and modal opening. Direct assistant review of the production-mode Performance run and rendered large-data harness closes this item: desktop-large Transactions/Reports/Planning remain responsive, route readiness stayed under 3.2 s, budget mutation completed in 724 ms, reports/history JS heap stayed below 63 MiB, charts/DOM were bounded, transaction pagination/search and Quick Entry mutation remained interactive, and modal/history disclosure stayed contained. The relevant product/large-data files are unchanged since that proof run.
- [x] Bundle/CSS budgets, lazy-loading/deferred chart steady state and no performance regression from audit fixes. Direct assistant review confirms release-readiness bundle budgets pass on the exact head; large pages remain route-lazy, chart code remains out of the eager app shell in a separate CartesianChart chunk, and production-mode Lighthouse/loading-shift audits are green.
- [x] Windows Desktop package validation, startup/lock/update proxy boundaries and clean installed-user launch. Direct assistant review of the exact-head Windows job confirms desktop audit/source checks, bootstrap validation, unpacked executable + hidden local backend smoke, NSIS install/launch/uninstall, shortcut resolution, checksum metadata and installer evidence all passed.
- [x] Windows first-run/clean-launch validation on the exact final packaging head with no runtime provisioning requirement. Direct assistant review confirms the application-owned first-run contract passed and a fresh installed-user NSIS launch succeeded with SUPABASE/CARD_VAULT environment values removed and without creating runtime-config.json, runtime-secrets.json or pending-provision.json.
- [x] Desktop/Electron custom title bar integrated into the existing MyFinHub UI: the main Electron window uses `titleBarStyle:'hidden'` + native `titleBarOverlay:true` without `frame:false`; desktop-only drag/no-drag/caption-reserve styling is bridge-gated; source regressions lock the contract; CI #3186 passed light/dark 1440px and compact 960px rendered title-bar QA; direct assistant inspection of all three captures found coherent topbar integration and no caption/action overlap; Windows Desktop #2746 passed packaged startup and the in-process native maximize → restore → `1100×760` resize probe. First Run/Clean Launch and sibling gates were also green. Android remains untouched.

### 8.10 Real-stack integrated E2E and canonical-tree proof — 2/8

**No-cost execution decision (2026-10-04):** the owner explicitly requires zero paid subscriptions/usage for this completion work. Hosted Supabase Branching is therefore excluded. Real-stack proof will use an ephemeral local Supabase stack built from this repository's exact migrations/config on the standard public GitHub-hosted Ubuntu runner, with synthetic fixtures only and no production project credentials or finance data. The first harness is manual-dispatch while it is being stabilized; counters remain unchanged until runtime proof is green and directly reviewed.

- [x] Create/use an isolated non-production test backend with the same schema/policies for destructive CRUD/E2E; never use production personal finance data as a disposable test fixture. Real Stack E2E #14 booted Supabase CLI 2.119.0, applied all 48 repository migrations through `20261001220945_reject_cross_account_id_collisions`, used only a generated local Auth owner plus canonical synthetic finance data, and discarded the stack afterward with no production project credentials/data.
- [ ] Run browser → real API → real Supabase/Storage end-to-end flows for the mutation matrix, not only synthetic QA handlers.
- [ ] Run reload/new-session persistence checks after representative operations in every product domain.
- [x] Run concurrent/revision-conflict and auth/device-revocation scenarios against the real integration stack. Real Stack E2E #14 proved a stale revision/history writer fails with 409, while revoke-others and explicit device revoke invalidate the affected AAL2 session and a fresh re-authentication can establish a new active session.
- [ ] After all fixes are merged, rerun the complete required suite on the exact canonical `develop` commit outside feature-branch assumptions.
- [ ] For a release candidate, run `develop -> main` release validation on the exact merge candidate before production promotion.
- [ ] After production deployment, verify deployed SHA equality and run non-destructive production smoke/read-only integrity checks plus only explicitly safe owner actions.
- [ ] Treat branch/PR-only validation as supporting evidence, not final proof of the post-merge canonical tree.

### 8.11 Defect remediation and revalidation loop — 0/6

- [ ] Every discovered defect is recorded before fixing with severity, reproduction, affected matrix cells and whether it is systemic or local.
- [ ] Fix systemic design/component/domain/backend causes at the shared layer where safe instead of patching screenshots or one page.
- [ ] Add the narrowest regression test that would have caught each material defect before/with the fix.
- [ ] Re-run narrow affected tests first, then all matrix cells invalidated by the change.
- [ ] Re-run full CI/security/rendered/cross-engine/performance/Windows gates whenever final-head rules require them.
- [ ] Do not mark an item complete from source change alone; required runtime/visual/backend proof must also pass.

### 8.12 Final closeout and evidence package — 0/8

- [ ] Close every traceability-matrix cell as passed, intentionally unsupported/out-of-scope with rationale, or blocked; no silent blanks.
- [ ] Produce final route/state screenshot manifest and manual-review ledger with no unresolved visual/UI/UX defects.
- [ ] Produce final functional/backend/error/security evidence summary tied to exact commit SHA and backend migration state.
- [ ] Confirm repository plan/status/PR tracking matches reality and update counters only for fully proven items.
- [ ] Before squash-merge, complete the code-level UI reuse/orphan/consistency audit: inventory shared primitives/tokens; identify orphaned or unused components/styles/variants, duplicate or parallel same-role controls, page-specific/inline overrides and unjustified divergent variants; verify controls that should share semantics actually use the appropriate shared contract; distinguish intentional contextual differences from accidental drift; consolidate shared behavior/styling where safe, remove proven-dead UI artifacts, and add narrow regression coverage for material consolidations. This is a source/design-system audit and should not duplicate the later visual inspection of identical shared instances.
- [ ] Squash-merge only when every required exact-head gate is green and no unresolved critical/high defect remains; then prove the canonical post-merge tree.
- [ ] After squash-merge to `develop`, run the dedicated post-merge final visual release inspection on the exact canonical `develop` tree before UI closeout. Perform a detailed element-level inspection of every **distinct** visible/interactive UI pattern across desktop/tablet/mobile Light/Dark primary routes and critical dialogs/states. Verify responsive containment, clipping/overlap, semantic palette/contrast, typography/spacing, focus/touch targets, 200%/Large-text/reduced-motion behavior and Windows-specific surfaces. Avoid duplicate inspection of identical repeated instances when they use the same shared component/design-system primitive and the relevant states/layout contexts have already been proven; re-review only materially different variants, states or contexts. Audit that controls which should be visually/semantically common actually share the appropriate primitive/token contract rather than page-specific parallel styling or divergent variants. Fix any defect or unjustified divergence, rerun only affected/invalidated evidence, then perform one bounded final visual sweep. This gate is mandatory even if the pre-merge visual matrix is green.
- [ ] If/when promoted to production, verify production deployment SHA, production smoke and privacy-safe backend integrity before declaring the release closed.

### 8.13 Independent assistant-led manual verification protocol — 0/10

The owner's definition of "checked" means personally inspected and reasoned about by the responsible ChatGPT agent, not merely reported green by GitHub Actions, a script or another automated system. Automation is evidence generation and regression protection; it is not the reviewer.

- [ ] Do not mark any visual/UX/functional/backend/error item complete solely because a GitHub check, script or test suite reports success.
- [ ] Personally inspect every required screenshot/evidence capture at useful resolution, page by page and state by state; do not substitute thumbnail contact-sheet spot checks for actual inspection.
- [ ] Personally navigate the actual running application for every high-risk user flow that can be exercised safely, interacting with the real controls rather than inferring behavior from source code.
- [ ] During manual browser checks, inspect browser console/runtime errors and relevant network requests/responses for silent failures, retries, unexpected 4xx/5xx and stale-resource problems.
- [ ] Inspect the rendered DOM/accessibility representation for headings, landmarks, accessible names, roles, states, focus order and live/error messaging on representative controls and every novel component pattern.
- [ ] Use source review to understand and explain behavior, but never use source presence alone as proof that runtime behavior, layout, persistence or error recovery works.
- [ ] For backend-dependent flows, personally compare the user-visible result with privacy-safe API/database/Storage read-back evidence after the operation and after reload/new session.
- [ ] Maintain an independent verification ledger tied to exact SHA with PASS/FAIL/BLOCKED, direct observation, reproduction steps and evidence reference for every matrix cell; GitHub status is recorded only as supporting evidence.
- [ ] After each material fix, personally re-check the affected UI/flow/backend behavior instead of considering a rerun of the same automation sufficient.
- [ ] The final closeout statement must be based on direct review of the evidence set and must explicitly name any residual unverified area; no blanket "all good" conclusion is allowed when evidence is incomplete.

### 8.14 Routing, deep links and 404/error-page product behavior — 10/10

Current source already contains an authenticated hash-route `NotFound` screen for unknown `#/<route>` values. It is intentionally privacy-safe, but it is minimal and does not by itself prove correct behavior for unknown real HTTP paths. The desktop server currently falls back to `index.html` for any non-API GET after static-file lookup, while Vercel has no explicit SPA catch-all or custom HTTP 404 contract. This must be treated as a distinct product surface.

- [x] Verify every valid hash route, the legacy `#/review` redirect, direct-load behavior, refresh and authenticated deep-link restoration. Direct assistant source review confirms initial routing is derived from `location.hash`, the legacy review route is replaced with `#/attention`, valid navigation uses deterministic page hashes, and refresh/direct load rehydrates from the current hash; exact-head CI covers the routing contract.
- [x] Verify unknown/malformed hash routes produce the intended MyFinHub 404 surface and do not silently land on Dashboard. Direct assistant review confirms unknown hashes set `notFound=true` while preserving Dashboard only as an internal fallback page id; malformed/encoded/script-like fragments remain 404 and never render finance data.
- [x] Verify browser Back/Forward history across routes, 404 → valid route recovery, and focus restoration to the destination heading. Direct assistant review confirms push/replace state navigation, hashchange+popstate synchronization, dedicated 404 Back/Dashboard recovery and explicit focus restoration to the destination H1 / 404 title.
- [x] Verify real unknown HTTP paths on Vercel/production-like web hosting return an intentional MyFinHub experience with an appropriate HTTP status rather than a platform-generic page or silent Dashboard fallback. **Completed by owner-approved manual preview proof.** Validated routing source `154f722a…` had CI #3274 + CodeQL #3223 PASS. A temporary deployment-only commit `567b9b4…` changed only `git.deploymentEnabled` for `feat/476-completion-audit-hardening` and produced Vercel preview deployment `dpl_CPjne4Gbd7xiE6CjTbsP8AjyE9qs` (`target:null`, no promotion/production alias). Read-only preview probes proved: `/__myfinhub-unknown-route-probe` returns HTTP 404, `content-type: text/html; charset=utf-8`, branded `404 · MYFINHUB` and privacy-safe Greek copy with the expected security headers; `/` remains HTTP 200; `/api/__myfinhub-unknown-api-probe` remains JSON HTTP 404 with `code: API_NOT_FOUND`. The temporary branch deployment toggle is removed in this closure commit; normal non-main deployment suppression is restored.
- [x] Verify unknown HTTP paths in the local/Windows desktop server do not silently become Dashboard unless that is an explicitly accepted SPA contract. Direct assistant review confirms only `/` and `/index.html` serve the app shell; all other non-API GET paths return `404.html` with HTTP 404.
- [x] Verify missing static assets/chunks/images return the correct failure response and are not incorrectly served `index.html` with status 200 by a broad catch-all. Direct assistant review confirms `express.static(...,{index:false})` runs before the terminal 404 and the previous broad `index.html` fallback is absent; missing asset paths therefore terminate at HTTP 404 rather than the app shell.
- [x] Verify unknown/unsupported API routes and methods remain JSON API failures with correct 404/405 semantics and can never fall through into the HTML application shell. Direct assistant review confirms known local API routes have explicit 405 fallbacks, unknown local `/api/*` routes hit JSON `API_NOT_FOUND` before static serving, and Vercel's final `/api/(.*)` rewrite reuses the health handler to return the same JSON 404 contract.
- [x] Test trailing slashes, query strings, encoded characters, duplicated separators, malformed fragments and copy/pasted external deep links without routing loops or unsafe reflected content. Direct assistant review of the route resolver plus exact-head regression coverage confirms these variants fail closed to the privacy-safe 404 and route input is not reflected into the page.
- [x] Review the 404 page manually in desktop/tablet/mobile, light/dark, keyboard-only, 200% zoom and reduced-motion modes; verify focus, contrast and safe no-financial-data behavior. The six desktop/tablet/mobile Light/Dark route captures were already opened and reviewed individually; product 404 markup/styles are unchanged since that review. Exact-head CI #3216 then passed focused keyboard/reduced-motion/200%-equivalent runtime assertions after the harness was corrected to use the canonical theme API. Direct assistant inspection of `not-found-light-200pct.png`, `not-found-dark-200pct.png` and `keyboard-semantic-404-zoom-reduced.png` confirms distinct semantic Light/Dark surfaces, contained Greek copy/actions, visible interactive focus, no horizontal clipping and no finance-data disclosure.
- [x] Refine the current 404 into a deliberate MyFinHub-branded, useful and interesting page if manual design review finds the current minimal card insufficient. Direct assistant review of all six 404 captures confirms the current implementation satisfies this design contract: privacy-safe finance-route illustration, concise Greek copy, Dashboard/Back recovery actions, no finance data/external dependency and responsive light/dark treatment. A separate exact-head visual item remains pending for the later focus-halo fix.

### 8.15 Temporal, numeric, locale and data-boundary edge cases — 10/10

- [x] Verify month-end/year-end transitions, January↔December reporting changes and February/leap-day behavior across transactions, recurring, scheduled, reports, budgets and forecasts. Direct source/test review plus exact-head CI confirm strict Gregorian date validation, UTC/date-only arithmetic, exact short-month ranges, leap-day handling and Jan↔Dec reporting shifts across the shared calendar helpers and their domain callers.
- [x] Verify local-date/time-zone handling around midnight and DST changes so date-only finance events cannot shift day/month unexpectedly between browser, API and database. Direct review confirms UI 'today' uses local calendar getters and a DST-aware next-local-midnight refresh, while finance date-only parsing/arithmetic/rendering uses explicit UTC calendar dates (no implicit midnight UTC conversion); exact-head local-date and temporal regression tests pass.
- [x] Verify monetary precision/rounding for cents, aggregated totals, percentages, statements, repayments and split legs; UI totals and persisted numeric values must remain consistent. Direct review confirms the shared safe-money boundary converts to integer cents, split/event semantics are cent-exact, and regression coverage includes 0.1+0.2→30 cents plus 12.345→1235 cents / 12.35.
- [x] Verify zero, negative, near-zero, maximum accepted and obviously excessive monetary inputs are either correctly supported or rejected with explicit validation. Direct review confirms positive-money flows reject zero/negative values, reconciliation accepts signed balances only when safely representable, split/loan/recurring/scheduled boundaries enforce explicit ranges, and unsafe-cent magnitudes fail closed.
- [x] Verify text boundaries using long Greek strings, long unbroken strings, Unicode combining characters, emoji and punctuation in notes/names where supported; no corruption, clipping, injection or persistence mismatch. Direct assistant inspection plus exact-head rendered CI on `81bff44…` proves the extreme Transactions fixture preserves emoji, combining accents, Greek punctuation and a 180-character unbroken Greek token as text-only content without horizontal overflow or amount overlap; structural validation separately preserves bounded Unicode and rejects text beyond the supported limit.
- [x] Verify ordering stability when multiple events share the same date/time or sort key and that pagination/load-more does not duplicate/skip rows during edits. Transactions use deterministic date+id ordering, persistent ids are unique at the trust boundary, pagination is a pure slice of the recomputed ordered set, filters/page-size changes reset to page 1 and shrinking result sets clamp via `safePage`; rendered scanability QA confirms sort/filter/search behavior without duplicate structures.
- [x] Verify duplicate identifiers, duplicate provider/category/account names and normalization/collision rules fail deterministically without overwriting unrelated data. Identity semantics are now explicit and directly verified: persistent finance collections reject duplicate IDs and override key/id mismatches; account/provider display labels may intentionally repeat because stable IDs own identity; normalized taxonomy aliases reject ambiguity; production had 0 existing seed/custom account-ID collisions before migration `20261001220945_reject_cross_account_id_collisions`, and the live trigger was transactionally probed to reject a synthetic cross seed/custom collision with `ACCOUNT_ID_CONFLICT` before any canonical write commits. Exact-head CI on `81bff44…` passes the identity regression contracts.
- [x] Verify archived/deleted entities remain historically referentially valid and cannot create dangling card/account/category/provider references. Direct source/test review confirms deleted credit cards retain neutral historical tombstones and deterministic legacy ownership, referenced custom accounts cannot be deleted while seed accounts are retained, taxonomy retirement preserves stable aliases and blocks live/future dependencies, and providers/assets have no destructive app deletion path that can bypass restrictive/binding references.
- [x] Verify realistic large-data boundaries for transactions/history/budgets/recurring/scheduled entities: load time, filter/search, pagination, charts, mutation latency and memory remain usable without unbounded DOM/render work. Direct rendered proof covers 1,500 transactions, 120 recurring, 120 scheduled, 80 budgets, 80 rules and 100 history rows with bounded progressive disclosure/DOM, deterministic transaction pagination/search, no horizontal overflow, budget mutation under 1.5 s, max route readiness under 5 s and conservative reports/history heap guards under 256 MiB. Observed proof was materially below the guards (3116 ms max readiness, 724 ms budget mutation, 41.8/62.7 MiB heap).
- [x] Verify backwards-compatible loading/import of every still-supported schema/version and explicit rejection/migration messaging for unsupported or malformed historical data. The canonical boundary accepts supported schema versions 1–3, preserves the incoming version through migration, validates stored documents before migration can normalize them, migrates supported legacy reads/imports to v3 and rejects future v4+ documents before database mutation or read normalization. Exact-head CI/CodeQL on `81bff44…` passes the parameterized v1/v2/v3 read contracts, legacy import contract and future-schema rejection paths.

### 8.16 Operational reliability, observability, migration recovery and release rollback — 7/8

- [x] Rehearse every pending database migration on an isolated production-like Supabase environment before production application, including data-preservation and policy/grant verification. The current candidate has no repository-vs-live pending migration: the read-only parity check is 48/48 through `20261001220945_reject_cross_account_id_collisions`. Real Stack E2E #17 on exact head `3a4a39a7…` independently recreated the disposable local stack and replayed all 48 committed migrations from scratch before the authenticated finance flow passed, so the current migration chain is reproducible without production data.
- [x] Perform a real backup → restore/recovery exercise on isolated data, then verify finance state, history/audit boundaries and excluded secrets after restoration. Real Stack E2E #17 created a manual backup after real mutable save + undo/redo, verified the backup is a valid FinanceData document without the synthetic PAN/expiry/CVV, mutated the canonical state afterward, restored the backup through the authenticated import boundary, and directly proved recovered finance content, matching history cursor/revision, backup/import/undo/redo audit actions, clean relational database health and an unchanged separately encrypted Card Vault.
- [x] Add/verify a deterministic repository-vs-live migration drift check so production parity is known before and after releases rather than inferred from filenames. The repository source contract enumerates the production-applied ledger and exact local migration filenames; direct Supabase `list_migrations` comparison on 2026-10-02 matches the current branch migration tree through `20261001192135_manage_financial_provider_assets` with no drift.
- [x] Define and test roll-forward/recovery behavior for a partially failed or interrupted migration; never assume destructive rollback is safe for finance data. Direct assistant review of Real Stack E2E #18 on exact head `65cb3c61…` confirms the disposable local rehearsal created a deliberately partial synthetic schema state, preserved its sentinel through idempotent forward corrective SQL, restored RLS plus authenticated owner/AAL2 SELECT-only policy/grants, and left the Supabase migration-ledger count unchanged. Production recovery remains forward-only: `db reset --linked` is prohibited, and `migration repair` is bookkeeping only after actual database state is independently known correct.
- [x] Verify application rollback compatibility: if web/desktop code is rolled back one release while the database remains on the newer compatible schema, startup/read/write behavior must be understood and documented. Direct production evidence on 2026-10-02 proves the deployed web app is still the v1.3.0-era `main` SHA `3333b733…` while production Supabase already contains the newer completion/hardening migration ledger; `/` and `/api/health` both return 200 with the older deployment, runtime-error aggregation reports no errors in the last 24h, and the newer database work is additive/backward-compatible rather than dependent on removed legacy columns/functions. This is the exact rollback shape: older app code operating against the newer compatible schema.
- [x] Exercise controlled backend/database/storage restart or temporary unavailability scenarios and verify health recovery, session behavior, retry strategy and no duplicate finance mutation after reconnection. Direct assistant review plus green exact-head CI covers data/auth transport loss and timeout mapping, metadata/vault upstream outages, cookie preservation on temporary Auth unavailability, an explicit later data read succeeding after a simulated outage, and fail-closed finance mutation queues that never replay failed writes automatically or flush dependent pending mutations after reconnection.
- [x] Review operational observability manually: health endpoints, bounded server/startup diagnostics, request IDs for unexpected failures, actionable log levels and redaction of tokens/secrets/financial content. Direct production `/api/health` inspection returns 200/no-store/security headers plus `x-request-id`; server error logging is bounded to requestId/code/status/error type, Desktop diagnostics redact bearer/Supabase/JWT/64-hex secrets and cap output, and Vercel's last-24h production scan shows no runtime error clusters (observed 401/405 traffic matches deliberate unauthenticated/method-contract probes).
- [ ] Verify release identity end-to-end: package/app version, Git SHA, web deployment SHA, Windows artifact/checksum, migration state and release metadata must refer to one coherent release candidate; document a tested rollback/stop-ship procedure.

### 8.17 Hard completion rule

The application must **not** be described as fully verified merely because unit tests, rendered QA, final screenshots or CI pass independently. Full closeout requires traceable evidence across the UI/UX, functional, persistence, backend, error, security, routing/404, temporal/data-boundary, operational-recovery and canonical post-merge layers above. Synthetic QA remains useful but cannot substitute for real-stack E2E where persistence/backend behavior is part of the user-visible contract.

"Verified" additionally means the responsible ChatGPT agent has personally inspected the required runtime/visual/backend evidence and recorded an independent disposition; GitHub/CI is supporting evidence only.

Production-destructive testing is prohibited. Real CRUD/backend verification must use an isolated non-production environment or narrowly controlled reversible test data approved for that purpose. Android remains out of scope; any compatibility impact discovered here is documented only.


### 8.18 Implementation batch A — source implementation in progress

A coherent first implementation batch has started without claiming verification completion. PR #477 is kept in draft during high-churn work so pushes use the lighter CI + CodeQL feedback loop; expensive rendered/cross-engine/performance/Windows gates remain deferred until a stable integrated head.

Source scope in this batch:
- dedicated reusable, privacy-safe MyFinHub 404 component with responsive/light-dark/reduced-motion treatment and Dashboard/Back recovery actions;
- standalone static `404.html` for real HTTP-path failures plus desktop/local server behavior that no longer turns every unknown GET into `index.html`/Dashboard;
- explicit 404 inclusion in the final screenshot matrix (target 66 captures rather than the previous 63);
- pure hash-route resolver + regression tests for valid, legacy and unknown routes;
- HTTP binary-body normalization that rejects ambiguous request-body types and malformed Content-Length values before provider-asset processing;
- provider upload validation now returns a bounded copied Buffer instead of relying on request-derived runtime type assumptions;
- provider Storage upload cleanup is attempted when the subsequent metadata-registration RPC fails, preventing a known partial-write orphan case;
- provider query parameters now reject ambiguous array/duplicate shapes instead of silently selecting the first value.

These items remain **not completed** until narrow CI/CodeQL validation is green and the 404 is personally inspected in rendered runtime evidence. The full-system counters therefore remain unchanged at this checkpoint.


### 8.19 Implementation batch B — temporal, locale and monetary boundaries in progress

This batch is independent from the 404/security batch and is implemented while its CI runs in parallel.

Source scope:
- strict calendar-date validation rejects impossible dates such as 2026-02-31 while preserving real leap days;
- date-only arithmetic is UTC/calendar based and covered across leap-day, month-end and year-end rollover;
- report/month range calculations fail closed on malformed month keys;
- recurring anchors and scheduled due dates now use real calendar validation rather than regex-only validation;
- event creation rejects invalid transaction dates and invalid expected-return dates at the domain boundary;
- a central safe-money boundary converts values to integer cents only when the result remains a safe integer;
- Quick Entry semantics, loans, recurring items, scheduled items and domain events reject monetary values outside safe-cent range;
- the custom date picker no longer silently renders an invalid stored date as “today”;
- Dashboard, Transactions, Savings, Reports and PeriodControl now reuse strict reporting/calendar helpers instead of independent loose month arithmetic;
- regression coverage includes leap years, month/year rollover, invalid month/date inputs, decimal rounding and unsafe monetary magnitudes.

No completion counters advance until the batch passes CI and its user-facing date-picker/page behavior is directly inspected.


### 8.20 Implementation batch C — API/error contracts in progress

This batch is implemented independently while earlier checkpoint CI runs in parallel.

Source scope:
- shared JSON and binary request readers now reject malformed/unsafe Content-Length values consistently and bound stream chunks before accumulation;
- JSON body parsing handles string, Buffer and Uint8Array inputs consistently and converts unserializable/circular parsed bodies into a controlled 400 instead of an accidental 500;
- 405 responses preserve the `Allow` header and include the request ID generated by the surrounding API error envelope;
- unexpected server errors remain client-redacted while preserving request IDs for correlation;
- the local/Desktop unknown `/api/*` catch-all now returns a JSON `404 API_NOT_FOUND` before static/HTML routing instead of a misleading 405;
- strict query parsing rejects ambiguous duplicate/array query values and is reused by provider metadata plus the compatibility markers for data/auth routes;
- device-session revoke actions now require exact payload shapes and canonical UUID session IDs, rejecting unknown fields;
- regression tests cover 400/405/409/413/415/500-style envelopes, no-store headers, request IDs, raw/parsed JSON bodies, strict query handling and API-vs-HTML fallback ordering;
- stale source-contract tests from the 404/date refactors are updated to prove the new intended contracts rather than reverting product behavior.

The Vercel unknown-`/api/*` catch-all remains an explicit verification item. No speculative wildcard rewrite is added because current Vercel documentation does not establish a safe filesystem-first fallback that cannot shadow the existing function routes under this project configuration.

Android compatibility impact: the existing legitimate `__myfinhub_route=android-update` compatibility marker is unchanged; only ambiguous duplicate/array marker shapes are now rejected. No Android repository change is made.

No completion counters advance until CI/CodeQL validation and the relevant runtime failure paths are directly inspected.


### 8.19 Implementation batch D — persistence trust-boundary hardening in progress

Direct source audit of the canonical persistence validator found material gaps that were not covered by the earlier UI/domain validation work:

- several finance date fields were validated as arbitrary strings or regex-shaped YYYY-MM-DD values rather than real Gregorian calendar dates;
- `state.scheduled`, `state.attentionDecisions`, `state.budgets` and `state.transactionRules` were present in the product schema but lacked equivalent canonical server-side structural/semantic validation;
- full imports and stored-document reads did not consistently execute the same card/category/recurring extension invariants used by normal mutable writes;
- credit-statement and recurring-cadence extension validators accepted impossible regex-shaped dates;
- the bundle gate exposed the intentionally added 404 surface as a small total raw-CSS increase; the total raw CSS ceiling is being moved from 500 KiB to 512 KiB while the compressed 100 KiB CSS ceiling and all JS ceilings remain unchanged.

Source implementation now in this batch:

- real calendar-date validation wired into legacy transactions, snapshots, events, lending history, loan schedules, recurring anchors/end dates, savings goals and expected-return dates;
- canonical validators for persisted scheduled transactions, attention decisions, budgets, transaction rules and migration metadata;
- canonical `validateCompleteFinanceData` trust boundary shared by full web import, Desktop import, storage reads/writes and the mutable-state validator;
- strict credit-statement and recurring-cadence date validation;
- regression coverage for impossible dates, scheduled transfer semantics/duplicate IDs, malformed budget/attention/rule state and full-import extension bypass;
- bounded raw CSS budget headroom only; gzip CSS and JavaScript budgets remain unchanged.

No completion counter advances from this source batch until narrow CI/security validation is green and the relevant runtime/import behavior is directly verified.


### 8.20 Implementation batch G — persistence semantic invariants in progress

Direct audit found that structural persistence validation still did not independently enforce the accounting semantics already guaranteed by the client/domain constructors. A malformed import or tampered mutable state could therefore encode a structurally valid but economically impossible event.

Source implementation in this batch:

- state-local semantic validation mirrors the existing domain event constructor in integer cents for expense/income/refund, transfer/withdrawal/saving, lending/repayment, card purchase/payment, reconciliation and split events;
- ledger legs must match the event meaning exactly, with no duplicate ledger account legs;
- split events require at least two positive unique parts and exact cent-level balance to the parent amount;
- optional saving/receivable/credit deltas must agree with the event kind and amount when present;
- full-document validation additionally rejects dangling account references in defaults, excluded-account settings, recurring items, loans, scheduled transactions, transaction-rule account matches and event legs;
- the synthetic `credit-card` liability is accepted only where the accounting model allows it and cannot become a normal default account;
- mutable-state validation deliberately performs only state-local accounting checks because that API does not carry seed accounts; full reference integrity remains a full-document/import/read concern;
- regression coverage exercises canonical events plus tampered transfer legs, duplicate legs, split corruption, delta tampering and dangling account references.

This batch also folds in source-test maintenance discovered by CI after the already-approved 512 KiB raw CSS ceiling and production-applied provider migration version change. No completion counter advances until the integrated CI proves these contracts.

### 8.21 External Auth setting blocker

Supabase security advisor still reports `auth_leaked_password_protection` disabled. The connected Supabase capability exposes read-only advisor/doc access but no project Auth-setting mutation action, so this item is **blocked on an external project setting** rather than silently treated as complete. Mandatory TOTP/AAL2 remains active; leaked-password protection is additive credential hardening.


### 8.22 Implementation batch H — error-log and persistence-timestamp hardening in progress

Direct error/persistence review found two additional trust-boundary gaps:

- unexpected API errors were correctly redacted from the client response but the generic server error logger still emitted the raw exception message, which could place a token, password, upstream detail or private value into operational logs if such content were embedded in an exception;
- many persistence lifecycle/audit fields were bounded as strings but not validated as real dates/timestamps, allowing impossible or garbage metadata into imports/history/state.

Source implementation in this batch:

- generic API failure logging now records only request ID, safe error code, HTTP status and error type; raw unexpected exception messages are not logged;
- regression coverage explicitly proves a secret-bearing synthetic exception is absent from both the client response and serialized server log arguments;
- a deterministic persisted date-stamp contract accepts real YYYY-MM-DD dates for legacy compatibility and RFC3339 timestamps with explicit timezone, including fractional seconds;
- impossible Gregorian dates, invalid clock values and timezone-free timestamp strings are rejected;
- document/state audit fields, event/card/scheduled/budget/rule/review/migration lifecycle timestamps, mutable-write timestamps, history action timestamps and persisted history-point timestamps are wired to the new contract;
- card archive/deletion and credit-statement audit timestamps are validated at the card extension boundary;
- the two Batch G CI fixture/source-contract mismatches are corrected in this same batch so no standalone CI cycle is spent on test maintenance.

This batch is not counted complete until integrated CI/CodeQL is green and the error/timestamp contracts are confirmed on the exact branch head.


### 8.23 Implementation batch I — provider-image CSP origin hardening completed

Direct CSP/provider integration review found one material mismatch: provider-management APIs now return canonical Supabase Storage URLs, but the web/Desktop `img-src` allowlist still contained three obsolete legacy image hosts and did not allow the actual project Storage origin. This could block newly managed provider artwork in real runtime despite synthetic rendered QA passing.

Accepted new sub-implementation:
- replace the obsolete external image-host allowlist with the single canonical `https://ahsukppxwaiagampsuzb.supabase.co` provider-image origin in web and Desktop CSP;
- lock the narrowed origin contract in source tests;
- keep the existing receipt OCR `blob:` allowance and prohibit generic script eval/inline script changes.

This adds one material sub-implementation to the accepted scope, moving the overall denominator from 189 to 190. Exact-head CI and CodeQL are green on `6248658…`; this sub-implementation is complete. Runtime deployment proof remains tracked separately under the existing security/404 final-verification items.


### 8.24 Implementation batch J — Vercel unknown-API JSON 404 hardening completed

Direct production probing confirmed that an unknown web path currently returns Vercel's platform 404 and direct source review showed the local/Desktop server already keeps unknown `/api/*` paths inside JSON handling, while Vercel lacked the equivalent catch-all. Vercel's documented static-hosting pattern recommends a final API rewrite for this case.

Accepted new sub-implementation:
- add a final `/api/(.*)` rewrite after all specific compatibility rewrites;
- reuse the existing health-function slot with a strict internal route marker rather than creating another serverless function;
- return the canonical JSON `API_NOT_FOUND` envelope with request ID for unknown API paths/methods;
- lock rewrite ordering and handler behavior in regression tests.

This adds one material sub-implementation, increasing the overall denominator from 190 to 191. Exact-head CI and CodeQL are green on `6248658…`; this sub-implementation is complete. Deployed Vercel runtime proof remains part of the existing routing/404 verification item.


### 8.25 Implementation batch K — release artifact privacy guard completed

Direct privacy review found that the tracked-file security guard covered repository secrets but did not independently inspect the built browser release for server-only secret markers or payment-card PAN-like payloads. This work is inside the existing secret/privacy verification item and does not add a new denominator item.

Source implementation:
- add a post-build privacy scanner over emitted text assets in `dist`;
- fail the build if server-only secret variable names, Supabase secret/service-role credentials, credentialed PostgreSQL URLs, JWT-like credentials, private-key markers or Luhn-valid 13–19 digit PAN-like values appear in release artifacts;
- keep the scan after Vite build and before bundle-budget approval;
- lock the build ordering and guard coverage in release-readiness regression tests.

Exact-head-equivalent CI on `8e571c2…` proves both repository and generated release privacy guards pass. Backup/log/screenshot/card-vault boundaries were directly reconciled, so the secret/privacy verification item is complete. Final pre-merge guard rerun remains a separate closeout item.

### 8.26 Implementation batch L — runtime AAL2 downgrade recovery in progress

Direct error-path review found one missing runtime recovery path: `401 AUTH_REQUIRED` and revoked-device responses force the session shell back to signed-out state, but a later `403 MFA_REQUIRED` from a protected finance endpoint does not currently tell the session shell to re-evaluate MFA state. That can leave an already-mounted UI showing an authenticated shell while finance operations are blocked.

Accepted new sub-implementation:
- emit a dedicated client auth-state event for `403 MFA_REQUIRED`;
- have the session hook refresh `/api/auth/session` so it deterministically moves to MFA challenge/enrollment rather than showing stale authenticated UI;
- preserve the existing 401 behavior without creating refresh loops;
- add regression coverage for event dispatch and source wiring.

This adds one material sub-implementation, increasing the overall denominator from 191 to 192. The existing 401/403 error-matrix item remains pending until this path is implemented and exact-head CI is green.


### 8.26 Implementation batch M — resilience/runtime proof expansion in progress

Independent review after the first ready-for-review gate exposed proof gaps and one performance-fixture integration regression. The accepted scope is unchanged; these changes implement existing pending verification cells rather than adding new plan items.

Source implementation in this batch:
- pending/failed finance writes now install a hard-reload `beforeunload` guard; automatic persistence still never retries a failed mutation and optimistic revision checks remain authoritative;
- runtime QA now asserts conflict/save-error surfaces are assertive, avoid false success and expose deterministic latest-version recovery;
- a real `useSession` QA probe exercises runtime AAL2→MFA downgrade and hard auth expiry, proving the stale authenticated shell is removed before MFA/login recovery;
- client import now rejects unsupported future FinanceData schemas **before** product migration can normalize them, using a shared supported-schema boundary also consumed by server validation;
- duplicate-label identity semantics now have focused regression coverage: account/provider labels may repeat safely because stable IDs own identity, normalized taxonomy aliases remain ambiguity-rejecting, and the production account-ID collision trigger separately rejects cross seed/custom ID collisions atomically;
- the production-like performance Vite fixture was updated for the new lazy-resource failure probe after the first heavy Performance run exposed a stale source-transform boundary.

Proof remains pending until this batch is integrated into PR #477 and exact-head CI/rendered/CodeQL plus the relevant heavy gates are rerun. No completion counter advances from source-only work.


### 8.28 Implementation batch N — local/Windows HTTP routing parity in progress

Direct routing review found one local/Desktop parity gap while expanding the 404 audit: unknown `/api/*` paths already returned the canonical JSON 404, but unsupported methods on known local API paths fell through to that unknown-route handler and therefore returned 404 instead of the 405 contract already used by the Vercel handlers.

Source implementation:
- add ordered known-route method fallbacks for health, auth login/session/MFA/logout, data, history, import and backup before the unknown-API catch-all;
- preserve exact `Allow` headers and the canonical JSON `METHOD_NOT_ALLOWED` envelope;
- add a post-build local-server runtime QA that proves root 200, intentional MyFinHub HTTP 404s for unknown/malformed/static-asset paths, JSON `API_NOT_FOUND` for unknown API routes, and 405/Allow behavior for known API paths;
- keep valid Android compatibility routing unchanged; no Android repository change is required.

This work remains pending until integrated exact-head CI/rendered validation passes. It is inside the existing routing/404 sub-implementations and does not change the denominator.


### 8.29 Implementation batch O — real client persistence failure runtime proof in progress

The existing fail-closed queue and unload guard are now exercised through the real `useFinance` hook rather than only static error-state fixtures.

Source/runtime QA:
- a QA-only persistence backend supplies consistent data/history envelopes without touching production data;
- an offline save is allowed exactly one PUT attempt, enters the real assertive save-error state and is not replayed automatically;
- explicit recovery reloads the server-authoritative state and discards the unconfirmed local mutation instead of duplicating it;
- both a failed save and an in-flight/pending save prevent hard unload, while a clean saved state does not;
- a pending interrupted write remains single-shot, preserving optimistic revision/idempotency semantics.

This remains inside the existing network timeout/offline/interrupted-save sub-implementation. Completion requires integrated exact-head rendered CI; no denominator change.


### 8.30 Implementation batch P — realistic large-data containment in progress

Direct large-dataset review found that Transactions already paginated safely, but several secondary finance-management surfaces still rendered their complete collections on desktop or inside management panels. This is now hardened inside the existing large-data verification item.

Source/runtime scope:
- the QA large fixture now includes 1,500 events, 120 recurring items, 120 scheduled items, 80 category budgets, 80 transaction rules and a full 100-point history view;
- desktop Planning schedules, desktop/inactive Recurring lists, budget management and transaction-rule management use 24-row progressive disclosure rather than unbounded collection rendering;
- the existing 12-row mobile Recurring contract is preserved;
- rendered QA verifies bounded DOM counts, progressive-disclosure controls, no horizontal overflow, contained Reports charts, the 100-point history ceiling and a conservative renderer-heap guard;
- normal-sized datasets remain visually unchanged because the disclosure controls appear only beyond the initial limits.

This remains pending integrated exact-head rendered/performance validation. It is part of the existing large-data sub-implementation and does not change the denominator.


### 8.31 Implementation batch Q — complete dual-theme final visual matrix in progress

The expanded visual audit explicitly requires every primary route at desktop, tablet and narrow-phone widths in both light and dark themes. The prior final screenshot harness captured the complete route/Settings/auth/404 surface set at all three viewports, but only one resolved theme per run.

Source/runtime scope:
- final screenshot capture now iterates explicit `light` and `dark` themes rather than relying on ambient/system state;
- every primary route, every tracked Settings tab, login/MFA/MFA-enrollment and the MyFinHub 404 surface are captured at 1440×1000, 834×1112 and 375×812 in both themes;
- screenshot filenames and manifest rows carry the resolved theme so human review cannot confuse light/dark evidence;
- theme resolution is asserted before each capture set;
- the deterministic final matrix expands from 66 to 132 screenshots.

This implements the existing exhaustive-visual sub-implementation and does not change the denominator. Completion requires execution on the final candidate head plus direct assistant inspection and disposition of the 132-image matrix.


### 8.32 FV-46 — Reports dark-theme privacy placeholder defect in progress

Direct assistant inspection of the expanded 132-image matrix found a real dark-theme inconsistency on Reports: the mobile privacy placeholder under “Εξέλιξη βασικών λογαριασμών” was forced to the light-only `#eef4fa` background by the mobile stylesheet, producing a conspicuous white card inside the dark surface.

Required remediation:
- replace the hard-coded light background with semantic theme tokens and preserve readable border/text contrast;
- re-run the affected rendered Reports evidence in light/dark mobile/tablet/desktop;
- re-run the final dual-theme matrix after all direct visual-review fixes are integrated.

This is a defect inside the existing exhaustive visual/UI-UX verification item and does not change the denominator. It is not complete until rendered proof and direct assistant re-inspection pass.


### 8.33 FV-47 — Settings Icons dark-theme surface/contrast defect in progress

Direct assistant inspection of the expanded final matrix found a second real dark-theme defect in Settings → Icons: the unified category/subcategory cards and icon workspace used light-only translucent backgrounds, producing large pale-grey cards with low-contrast text in dark mode.

Required remediation:
- convert icon-library, category, subcategory, selection and color-editor surfaces from hard-coded light RGBA/white backgrounds to semantic theme tokens;
- retain the intended light-theme hierarchy while restoring dark-theme contrast and consistent hover/expanded states;
- re-run Settings Icons rendered evidence at desktop/tablet/mobile in light/dark and directly re-inspect it;
- include the corrected surface in the final dual-theme matrix rerun.

This is contained within the existing exhaustive visual/UI-UX item and does not change the denominator.


### 8.34 FV-48/FV-49 — Settings Rules and Access dark-theme contrast defects in progress

Direct assistant inspection found two additional systemic dark-theme regressions caused by light-only component backgrounds:
- **FV-48:** Settings → Rules empty state rendered as a large pale card with low-contrast copy.
- **FV-49:** Settings → User & Access used light-only backgrounds for desktop PIN controls and the no-active-devices state; the same CSS also affected account-security inputs/idle-control surfaces.

Required remediation:
- move these surfaces to semantic control/inset theme tokens rather than fixed white/light RGBA fills;
- preserve focus, disabled and skeleton state distinctions without reducing dark-theme legibility;
- re-run the affected Settings rendered states in all required viewports/themes and directly re-inspect before visual closeout.

These defects belong to the existing visual/UI-UX verification scope and do not change the denominator.


### 8.35 FV-50 — Credit mobile dark-theme ledger-card contrast defect in progress

Direct assistant inspection of the integrated dual-theme matrix found a material dark-theme regression on the mobile Credit page: purchase and repayment rows are transformed from semantic tables into card rows, but that mobile rule still uses a hard-coded light border/background. In dark mode the row becomes a pale panel while its cell content keeps dark-theme foreground semantics, making date/description/category/account/amount text partially unreadable.

Required remediation:
- replace the mobile Credit ledger row hard-coded light border/background with semantic border/surface tokens;
- preserve the existing mobile labelled-card layout and destructive/edit action hierarchy;
- add a narrow regression/source contract preventing the light-only row surface from returning;
- re-run Credit rendered evidence in desktop/tablet/mobile light/dark and directly re-inspect it before visual closeout.

This defect belongs to the existing exhaustive visual/UI-UX verification scope and does not change the denominator.


### 8.36 FV-51 — Lending desktop dark-theme surface/contrast defect in progress

Direct assistant inspection of the integrated dual-theme matrix found a systemic dark-theme regression on the desktop Lending workspace: the selected-person row, search shell, three metric cards, information strip and table header still use light-only RGBA backgrounds. In dark mode those surfaces become pale-grey panels while their text follows dark-theme foreground tokens, materially reducing legibility. Tablet/mobile use a different presentation and are not affected in the same way.

Required remediation:
- convert desktop Lending search, selected/hover states, metric cards, note strip and table/pill surfaces to semantic control/surface/status tokens;
- preserve the existing selected-person hierarchy, status color semantics and desktop information density;
- add a narrow source regression preventing fixed light-only workspace surfaces from returning;
- re-run Lending desktop/tablet/mobile light/dark evidence and directly re-inspect it before visual closeout.

This defect belongs to the existing exhaustive visual/UI-UX verification scope and does not change the denominator.


### 8.37 FV-52 — Recurring desktop dark-theme table contrast defect in progress

Direct assistant inspection of the integrated dual-theme matrix found a dark-theme regression on Recurring: the desktop recurring groups/rows and the tablet table heading retain fixed light backgrounds. In dark mode the desktop active-obligation rows become large pale-grey bands with dark-theme text, making recurring names, cadence, account and amount details low-contrast or unreadable.

Required remediation:
- convert recurring desktop group/row and responsive table-heading backgrounds to semantic surface/inset tokens;
- preserve category grouping, loan-linked recurring distinction, row actions and mobile card presentation;
- add a narrow source regression preventing fixed light-only recurring ledger surfaces from returning;
- re-run Recurring desktop/tablet/mobile light/dark evidence and directly re-inspect it before visual closeout.

This defect belongs to the existing exhaustive visual/UI-UX verification scope and does not change the denominator.


### 8.38 FV-53 — Planning desktop dark-theme forecast/table contrast defect in progress

Direct assistant inspection of the integrated dual-theme matrix found a systemic dark-theme regression on the desktop Planning workspace: the scheduled-movement table body, forecast account cards, segmented controls and explanatory strip retain fixed light backgrounds. In dark mode these become large pale surfaces while most labels and values keep dark-theme foreground tokens, making substantial parts of the forecast and scheduled data unreadable.

Required remediation:
- convert desktop Planning scheduled-table rows, forecast account cards, segmented/status controls and informational strip to semantic surface/control/status tokens;
- preserve forecast risk colors, account sparkline colors and current desktop information hierarchy;
- add a narrow source regression preventing fixed light-only planning surfaces from returning;
- re-run Planning desktop/tablet/mobile light/dark evidence and directly re-inspect it before visual closeout.

This defect belongs to the existing exhaustive visual/UI-UX verification scope and does not change the denominator.


### 8.26 Implementation batch Q — visual evidence provenance completed

Direct assistant inspection of the fresh 132-image final visual artifact found a provenance defect: under GitHub pull-request events, the manifest recorded `GITHUB_SHA` (the ephemeral merge ref) even though the workflow explicitly checked out the PR head SHA. The screenshots were not stale, but the manifest could not truthfully identify the source commit.

Accepted new sub-implementation:
- visual evidence now derives `source.sha` from the actual checked-out Git `HEAD` first, with `GITHUB_SHA` only as a fallback;
- a regression contract locks both the checked-out-SHA precedence and the workflow's stale-branch refusal;
- the final 132-capture set must be regenerated once on the corrected harness and its manifest must equal the actual PR head used for capture.

This adds one material sub-implementation, increasing the overall denominator from 192 to 193. **Completed:** regenerated Final Visual QA produced 132 captures and the persisted manifest now records the actual checked-out source head `f3ae3b78a39752a6c00504ef119dd8d05cd6b354`, exactly matching the capture checkout; stale-branch refusal remains locked by regression contract.

- 404 accessibility coverage is source-implemented on the next validation head: title focus, Dashboard/Back keyboard order, reduced-motion animation suppression and a 720×500 200%-equivalent effective viewport overflow/touch-target contract are now part of rendered accessibility QA. All Settings tabs plus login/MFA error states are also added to the same keyboard/semantic audit. Completion remains pending exact-head rendered CI.

- 404/Settings/Auth accessibility batch is integrated for exact-head proof: rendered keyboard-semantic QA now covers the 404 title focus, Dashboard/Back tab order, reduced-motion suppression and a 720×500 200%-equivalent viewport, plus every Settings tab and login/MFA normal+error states on desktop/mobile. No verification counter advances until rendered CI passes and its evidence is directly reviewed.


### 8.39 Implementation batch R — responsive transition and virtual-keyboard proof completed

Direct review of the geometry harness found that the canonical 1440/834/375/320 viewports were strong but did not explicitly exercise the exact 680/681 breakpoint transition, landscape resize behavior or a shortened viewport equivalent to a mobile virtual keyboard.

Source/runtime scope:
- dynamically resize representative high-density routes through 1024 desktop, 1112×834 tablet landscape, 681 px desktop-side breakpoint, 680 px mobile-side breakpoint and 812×375 phone landscape without relying on a fresh page load for each transition;
- continue enforcing zero document overflow, no off-viewport controls, no bottom-navigation label collision and no global-chrome overlap after each resize;
- run the full interaction-dialog geometry suite at a 375×500 virtual-keyboard-equivalent viewport in addition to the existing 375×812 and 320×700 profiles;
- keep existing canonical route geometry coverage unchanged.

This implements the existing responsive/intermediate-width/orientation/virtual-keyboard verification cell and does not change the denominator. **Completed:** direct assistant review of CI #3169 verifies both geometry suites passed the intermediate, resize-transition, landscape and virtual-keyboard profiles before the later unrelated accessibility stop.

### 8.40 Implementation batch S — nested Settings visual-state evidence completed

The exhaustive visual matrix still required direct evidence for nested Settings editors rather than only tab-level surfaces. The final visual harness now captures the non-destructive nested states that were previously missing:

- existing provider editor details and branding tabs plus the provider asset picker;
- new account editor/provider picker;
- category rename inline editor;
- category icon selection editor;
- transaction-rule editor;
- data-import destructive confirmation without executing the import.

These states are captured at desktop/tablet/mobile in both light and dark themes. The deterministic Final Visual QA matrix therefore expands from 168 to 216 screenshots. No finance mutation, provider upload, import, Android change or production deployment is performed by these captures.

This work implements the existing Settings nested-editor visual verification cell and does not change the denominator. Direct inspection of the first 48 nested captures from artifact `11252454113` found a harness evidence-timing defect: provider/account/rule/import editors were captured immediately after DOM appearance while their 180 ms entrance animations were still changing opacity, creating false background bleed-through. The harness now waits 240 ms before every nested-state capture. **Completed:** Final Visual QA #92 succeeded from source head `b90387f…`, produced artifact `11274439706`, and persisted the settled `2026-10-03_160417` matrix in bot commit `8fa2fee…`. Direct assistant review confirms the Account editor light/dark desktop/tablet/mobile captures and Rules editor dark mobile/tablet/desktop captures no longer exhibit the FV-58/FV-59 contrast defects; the light mobile Rules comparator also remains correct.

### 8.41 Implementation batch T — mutating validation-error matrix completed

The 400/validation-error verification cell now has executable coverage instead of relying on scattered source assertions.

Source/API validation coverage now exercises canonical failure boundaries for mutable finance envelopes/revisions, account metadata, provider metadata/uploads/bindings, account-security changes, device-session actions, card-vault writes, history moves, import confirmation and malformed JSON/import documents. History and import validation were factored into pure exported boundary functions without changing their HTTP behavior so the exact 400 codes remain directly testable.

Rendered validation coverage now drives invalid submissions through seventeen invalid-submit flows across user-facing mutators: Quick Entry, Savings goals, Loans, Lending, Recurring, Planning, card profiles, card secure details, Credit purchases, bank creation, Settings account/provider/category/rule creation, account email/password changes and Reports budgets. Each flow must remain open, expose a non-empty task-local `role="alert"` error and avoid a successful mutation.

The validation review also found and fixed a shared feedback-semantics defect: account email/password/PIN failures and device-access failures now use assertive `role="alert"` semantics, while successful changes remain polite `role="status"` messages. **Completed:** direct assistant review of CI #3169 for PR head `2bed84e…` confirms the unit/API matrix and all 16 rendered invalid-submit flows passed before the later, unrelated Credit table-semantics failure. No validation implementation changed after that proof, so the existing 400/validation failure matrix is closed without an additional CI wave.



### 8.25 Validation follow-up — accessibility browser bootstrap reliability

Exact-head rendered CI on `0daf708…` completed all rendered suites through 404 accessibility but failed before executing the final keyboard/semantic accessibility suite because Chromium did not expose its CDP port on two consecutive bootstrap attempts. This is an infrastructure/bootstrap failure, not a product accessibility assertion failure.

Follow-up source work on `audit/476-a11y-bootstrap-fix`:
- capture Chromium stderr/stdout and early-exit/spawn diagnostics rather than timing out silently;
- retry the accessibility browser bootstrap internally up to three times with isolated profiles and successive CDP ports;
- add graceful TERM→KILL cleanup so failed launch attempts cannot leave stale browser processes/profiles;
- keep the existing primary-browser enforcement and accessibility assertions unchanged.

This follow-up belongs to the existing exact-head Chromium/accessibility proof obligations and does not add a new accepted product sub-implementation. It remains pending until the branch is integrated and the full rendered suite reaches/passes the keyboard/semantic accessibility assertions.

The first expanded Final Visual QA attempt on `0daf708…` also exposed a harness-only selector drift: category rename buttons are labelled `Μετονομασία <name>`, while the new nested-state capture looked for the obsolete `Μετονομασία κατηγορίας…` prefix. The capture selector is now anchored to the category header/action row and current accessible-name contract. This remains part of the existing final visual proof obligation and does not change the denominator.

### 8.42 FV-54 — static document filesystem DoS hardening completed

Exact-head CodeQL on `ebca273…` surfaced two `js/missing-rate-limiting` findings on the local/Windows document handlers because both root/index and the intentional HTTP 404 path performed `sendFile()` filesystem access directly inside request handlers.

Source remediation:
- preload the built `index.html` and privacy-safe `404.html` exactly once when the dist-serving host starts;
- serve the cached HTML strings for root/index and unknown HTTP paths, eliminating request-amplified filesystem work rather than adding a dependency solely for throttling;
- preserve root 200, real unknown-path 404 status, HTML content type, hash-router recovery and the existing `express.static` asset behavior;
- add a routing source regression that requires startup caching and rejects a return to per-request `sendFile()` for these two documents.

This security hardening defect is **completed** inside the existing CodeQL/security verification item and does not change the denominator. Exact-head CodeQL #3125 passed on `b602617…`; no Supabase/database operation and no Android repository change were involved.

### 8.43 FV-55 — Credit historical statement table semantics in progress

The expanded keyboard/semantic accessibility run on head `2bed84e…` reached the Credit route and found one visible historical-statement table without a caption or column headers. The other Credit tables already satisfy the semantic-table contract.

Source remediation:
- add an assistive caption and explicit Date / Type / Description / Amount header row to every historical credit-statement movement table;
- preserve the existing visual layout, data ordering and statement disclosure behavior;
- add a narrow source regression for the historical-statement caption/header structure while retaining the rendered route-wide semantic audit.

This defect belongs to the existing semantic-accessibility verification item in 8.3 and does not change the denominator. Completion remains pending the rendered keyboard/semantic audit on an integrated exact head. No finance persistence, Supabase or Android behavior changes.

### 8.44 FV-56 — shared anchor focus visibility and 200%-equivalent route proof in progress

Exact-head CI #3172 on `bb953ee…` advanced beyond FV-55 and exposed the next accessibility defect on Reports: keyboard focus reached the in-page `Επισκόπηση` anchor, but the shared focus-visible selector did not include ordinary `a[href]` elements, leaving the focused link without the app-wide visible focus treatment.

Source remediation and proof expansion:
- extend the shared interactive focus-visible contract from buttons/form controls/summaries/tabindex elements to ordinary links via `a[href]` rather than adding a Reports-only patch;
- retain the route-wide keyboard-semantic audit so the fix is exercised wherever links appear in the tab order;
- extend the existing geometry harness with a 720×500 non-mobile effective viewport, equivalent to a 1440×1000 desktop at 200% browser zoom, across every primary route;
- run that 200%-equivalent profile with the existing extreme-data fixture, Large readability mode and reduced motion, enforcing no document overflow, rogue off-viewport controls or desktop-chrome occlusion.

FV-56 belongs to the existing keyboard/semantic accessibility item and the 200%/readability visual-verification item, so the denominator does not change. Completion remains pending integrated rendered proof. No finance persistence, Supabase or Android behavior changes.

### 8.45 QA-NESTED-ANIM — nested Settings evidence timing follow-up completed

Direct inspection of the 48 expanded nested Settings captures in Final Visual QA artifact `11252454113` showed provider/account/rule/import overlays with apparent background bleed-through. Source review disproved a product-surface defect: the provider surface is `var(--surface)`, the account editor uses `rgba(255,255,255,.96)`, and both provider/account editors animate from opacity 0 to 1 over 180 ms. The final screenshot harness captured nested states immediately after DOM presence without waiting for that finite entrance motion.

Evidence remediation:
- make the shared nested-state capture helper wait 240 ms before every nested Settings screenshot;
- apply the same settling boundary to provider details/branding/asset picker, new-account editor, category rename, icon selection, rule editor and import confirmation;
- keep product animation and product surface styling unchanged;
- require a fresh 48-image nested-state recapture and direct inspection before closing implementation batch S.

This QA evidence defect is **completed**: the fresh 48-image nested Settings recapture was directly reviewed after the 240 ms settle boundary and no transition-opacity bleed-through remains. The review exposed separate real product defects FV-58/FV-59, tracked independently below. This item does not change the denominator. No finance, Supabase, API or Android behavior changes.

### 8.46 Implementation batch U — global-tools and remaining CRUD proof expansion in progress

Direct review of exact-head CI #3172 and artifact `11254561873` shows the combined Receipt OCR + global-tools cell already has rendered proof for local receipt capture/persistence/reload, OCR asset failure/retry/proposal correction → Quick Entry, Command Palette search/action/navigation/privacy, in-place refresh and focused PageErrorBoundary recovery. One proof gap remained: only `Ctrl+K` had been exercised as an app-wide shortcut in the current rendered completion matrix, while Quick Entry and undo/redo were covered only by source/unit contracts or button-driven flows.

Source/runtime proof expansion:
- Command Palette QA now dispatches the real `Ctrl+Shift+Space` chord, requires generic Quick Entry to open directly, verifies the Command Palette does not open, and closes it through Escape;
- the completion functional CRUD suite reuses its existing modern-transaction delete/undo state to exercise `Ctrl+Y` redo and `Ctrl+Z` undo through the shared production shortcut hook;
- no new workflow is introduced; these assertions run inside existing rendered suites in the next integrated CI wave.

Additional existing-cell coverage is batched into the same future rendered wave:
- Budget/Rules QA now creates a new overall budget with an explicit warning threshold, verifies alert-state/report reconciliation, edits the same stable budget row and deletes it again;
- transaction-rule QA now saves a real edit rather than cancelling edit mode, verifies a pre-existing matching transaction is not retroactively changed, creates a new matching Quick Entry transaction and requires the active rule to apply its `Τρόφιμα` category, then retains destructive rule deletion coverage;
- these additions reuse the existing `budget-rules` fixture and rendered suite, with no new workflow.

The same rendered CRUD batch now also closes the known source-level gaps in two obligation cells:
- Lending performs the remaining 30/42 repayment after the existing partial 12/42 repayment, requires a three-row aggregate history (one lend + two repayments), zero outstanding balance, disabled repayment action and privacy masking;
- Recurring takes the created item through create → edit → pause → reactivate → stop and requires the stopped item to remain in inactive history with no payment action; existing cadence, payment, linked-loan and bounded-disclosure suites continue to cover the rest of that cell.

Action Center is also expanded inside its existing rendered suite:
- capture the Reports KPI strip before any legacy review decision;
- exercise a real `Κράτα ως είναι` decision in the integrated legacy-confirmation panel and require the suggestion to leave the pending list;
- revisit Reports in-app and require the KPI strip to remain byte-for-byte equivalent, proving keep semantics do not silently rewrite reports;
- existing Action Center coverage continues to verify contextual actions, scheduled completion, privacy, snooze/dismiss + undo, empty/extreme mobile states.

Reports is also extended in its existing rendered suite to click the real previous-month control, require July 2026 to render with recalculated KPI text, then use the now-enabled next-month control to return to August. Existing Reports evidence already covers KPI/category/flow structure, privacy, empty/over-limit states, chart/table hierarchy and mutation neutrality.

Savings is also tightened inside the existing functional CRUD suite:
- select the explicit `Μεταφορά στην άκρη` path rather than whichever savings action happens to render first;
- require distinct resolved source/destination accounts, persist a 25 € transfer with a user note and verify the Savings history exposes note, source and amount;
- require the monthly savings amount/target progress to advance;
- compare Reports before/after and require income/expense KPIs to remain unchanged while the savings KPI changes;
- the already-green Budget/Rules rendered flow separately covers changing the savings target rate itself. No separate "planned saving" persistence entity exists; the accepted planned-target interaction is the Savings target/progress model, while scheduled transfers remain owned by Planning.

Loans is expanded without a new suite:
- create a real `ΒΟΗΘΕΙΑ` self-loan and require exactly one neutral savings→current transfer;
- record a partial 30 € return through the normalized loan payment flow and require the self-loan outstanding/history state to update;
- forgive the remaining balance through the owned destructive confirmation, require completion/history with no payment CTA and then verify only two money transfers exist (initial funding + actual return), proving forgiveness creates no synthetic cash movement;
- normal create/edit already remains in the same functional suite, while the separately green payment-flow/obligation suites cover ordinary payment, multi-installment payment, completion/history and linked recurring behavior.

Generic Quick Entry is now included in the same existing functional suite rather than a new harness:
- exercise a visible global Quick Entry trigger and require inline validation before any successful save;
- create rendered generic expense and income events;
- create a withdrawal and require distinct resolved source/cash destination accounts;
- create a refund and a reconciliation using a +1 € actual-balance correction derived from the rendered expected balance;
- existing Ledger QA continues to own transfer/split proof, while Action Center/payment-flow suites already own account/context prefills.

This implements existing verification obligations and does not change the denominator. Lending, Attention/Review and Reports/analytics were already closed by earlier exact-head rendered proof; CI #3186 additionally closes Loans, Savings, Generic Quick Entry, Receipt OCR + global tools and Recurring, while Budgets and Transaction Rules remain closed from CI #3184. The residual functional cells in 8.4 are therefore the ones still explicitly unchecked there; no completed cell is intentionally left stale in this batch summary.

### 8.47 CI #3176 / Windows Desktop #2736 follow-up — completed

Exact-head validation on `b2c2b0bc…` produced two independent blockers after five sibling gates passed.

**FV-57 — Savings 200%-equivalent horizontal overflow**
- CI #3176 reached the new route-wide 720×500 non-mobile profile with extreme data, Large readability and reduced motion and failed on Savings with `document horizontal overflow 144px`.
- The defect is product layout, not a harness false positive: the 681–980 compact-desktop range retained the legacy Savings two-column hero/flex route assumptions, while the explicit shrink-safe account-route treatment only existed at the <=680 mobile breakpoint.
- Remediation on staging adds a narrow 681–820 reflow contract: a shrinkable Savings hero grid, bounded gauge, shrink-safe source/destination route, ellipsis for long account values, wrapped goal-header actions and a one-column action grid where the compact shell is too narrow for the desktop composition.
- The geometry harness now reports generic overflowing DOM nodes in addition to the total overflow and rogue interactive controls so any remaining failure identifies its owning element.
- Regression coverage locks the intermediate breakpoint and shrink-safe route contract.
- **Completed on exact-head CI #3178 (`2074f125…`).** The rendered geometry suite passed the full canonical, intermediate, resize-transition, landscape and 200%-equivalent matrix, including Savings at 720×500 with extreme data, Large readability and reduced motion.

**WIN-AUDIT-01 — unpatched build-time dependency advisory**
- Windows Desktop #2736 stopped before packaging because `npm audit --audit-level=high` reports `GHSA-ch52-4w7c-c8xp` through the `electron-builder` toolchain (`http-cache-semantics -> cacheable-request -> got -> @electron/get -> app-builder-lib`).
- Current upstream advisory data has no patched `http-cache-semantics` release, so dependency churn cannot honestly be recorded as a remediation.
- The staging remediation does **not** disable npm audit and does not broadly ignore high findings. `desktop/audit-policy.mjs` consumes the real npm-audit JSON, permits only the exact advisory through an explicit build-time package allowlist, accepts cyclic package references only when every high/critical edge stays inside that allowlist, and exits non-zero for every other high/critical advisory or package. If the advisory disappears from the audit graph, no exception is exercised.
- A source regression requires the exact GHSA allowlist, high/critical blocking behavior and the absence of an audit `--force` bypass.
- **Completed on exact-head Windows Desktop #2738 (`2074f125…`).** The job log shows the real desktop audit ran, allowed only `GHSA-ch52-4w7c-c8xp` through the explicit eight-package build-time chain, then completed source checks, NSIS packaging, installed-user validation and checksum metadata; CodeQL and the other sibling release gates were also green.

Both findings are follow-ups inside existing 200%/responsive, security and Windows validation obligations and did not themselves expand scope. The later owner-accepted desktop/Electron custom-title-bar item raises the current overall denominator to **194**. No finance persistence, Supabase/API semantics or Android repository code is changed.

### 8.48 Desktop/Electron custom title bar — completed

This accepted item is counted once in 8.9 and is now being implemented as an isolated desktop/Electron batch.

Accepted implementation contract:
- integrate a custom desktop title bar into the existing MyFinHub application chrome rather than keeping a visually separate OS title strip;
- prefer Electron `titleBarStyle: 'hidden'` together with `titleBarOverlay` so Windows minimize, maximize/restore and close controls remain native instead of reimplementing system caption buttons;
- establish explicit draggable regions for non-interactive title-bar space and `no-drag` regions for navigation, buttons, inputs, menus and any other interactive UI;
- keep all title-bar layout/styling desktop/Electron-only so the web/mobile responsive shell is unchanged;
- preserve the existing application hierarchy, theme/readability behavior and window resize/maximize semantics;
- avoid unrelated backend, Supabase, security or packaging changes unless a concrete Electron compatibility requirement is discovered during implementation;
- do **not** modify `MyFinHub-Android-App`; if the web/desktop shell change has any compatibility impact on Android, document it only;
- update the relevant source tests and Windows/Electron validation so the implementation is proven for native window controls, drag/no-drag behavior, resize/maximize/restore, desktop light/dark presentation and regression-free startup/package behavior.

Implementation approach now fixed:
- configure only the main Electron `BrowserWindow` with `titleBarStyle:'hidden'` and native `titleBarOverlay:true`; keep the recovery/setup window on its existing native title bar;
- use the existing `window.myFinHubDesktop` bridge only as a renderer capability signal, with no new IPC surface;
- set a desktop-only root data attribute before React render and dynamically load a desktop title-bar stylesheet;
- make the existing app `.topbar` the draggable title-bar region, reserve the native caption-button area, and mark all interactive descendants explicitly `no-drag`;
- keep web/mobile/Android layouts unchanged because the stylesheet is loaded only when the Electron bridge exists;
- add source regressions for native-overlay options, absence of `frame:false`, desktop-only style loading, drag/no-drag regions and caption-control spacing;
- validate through root source/build checks plus Windows Desktop/First Run/Clean Launch before completion.

Source implementation now complete:
- the main Windows `BrowserWindow` uses `titleBarStyle:'hidden'` + native `titleBarOverlay:true` and explicitly does **not** use `frame:false`;
- the setup/recovery window retains its normal native title bar;
- `src/main.tsx` marks only Electron renderer sessions with `data-myfinhub-desktop="true"` and dynamically imports `desktop-titlebar.css`; the stylesheet is absent from the global web bundle entry;
- the existing topbar is the draggable region, all interactive descendants are no-drag, and the desktop-only geometry extends the topbar through the shell's top/right gutters while reserving space for native Windows caption buttons;
- the 960–980px collapsed-desktop range receives the matching 8px shell-gutter/native-control reserve without touching <=680 mobile rules;
- focused desktop source regressions lock the native overlay, setup-window exclusion, desktop-only style loading, drag/no-drag boundaries and integrated caption geometry.

Validation checkpoint: exact-head Windows Desktop #2744, Windows First Run #1295 and Windows Clean Launch #1296 already pass with the native-overlay source implementation, proving packaging/startup compatibility. The Windows Desktop packaged-app smoke is now strengthened to require a real main-window handle and exercise native maximize → restore → 1100×760 resize before teardown; source regression locks those host-state checks.

Additional validation is now staged without creating a new workflow: the existing Windows Desktop smoke requires real native maximize → restore → resize behavior, while a small `desktop-titlebar-qa.mjs` suite uses only the isolated `qa.html?desktop-titlebar=1` surface to load the same desktop CSS, verify top/right integration and caption-button action clearance at 1440px/960px, and persist light/dark screenshots for direct review. The production web entry never enables this QA query path.


Validation findings from exact head `db4636f0…`:
- **QA-DESKTOP-TITLEBAR-GUTTER — completed:** CI #3186 and #3190 passed the scrollbar-aware rendered title-bar suite at light/dark 1440px and compact 960px; the 15px browser scrollbar gutter is no longer misclassified as shell whitespace.
- **WIN-TITLEBAR-PROBE — completed:** Windows Desktop #2746 and exact-head #2750 passed the packaged Electron self-probe; BrowserWindow reported maximize/restore success and `1100x760` resize while ordinary launch/backend, NSIS, First Run and Clean Launch remained green.

Both findings are validation-layer follow-ups inside the accepted custom-title-bar item; neither changes the denominator or Android/backend scope.

Status: **Completed.** CI #3186 passed the desktop-titlebar rendered suite and direct assistant inspection of its three captures (light 1440, dark 1440, dark 960) found no material clipping, overlap, broken caption reserve or compact-shell regression. Windows Desktop #2746 independently passed the packaged Electron host-state probe with maximize=True, restore=True and resize=1100×760; First Run/Clean Launch and sibling Windows gates were green. No Android repository changes are required or were made because production renderer styling is gated by the Electron preload bridge.

### 8.49 CI #3178 / nested Settings direct-review follow-up — in progress

Direct review of CI #3178 and all 48 fresh nested Settings captures from the persisted `2026-10-03_085519` matrix produced three actionable follow-ups.

**QA-SAVINGS-CONTEXT — Savings functional harness followed a retired editor path**
- CI #3178 passed the full geometry/overflow suite, including FV-57, then timed out waiting for `#saving-editor-title` after selecting `Μεταφορά στην άκρη`.
- Source and existing rendered coverage confirm this is a harness mismatch, not a product regression: the accepted production flow intentionally routes manual Savings transfer through `.contextual-quick-modal` / `ContextualQuickAdd`.
- **Source-fixed:** the functional CRUD harness now waits for the contextual Savings title, reads the contextual account comboboxes, uses the real `Σχόλιο` field and submits through the contextual `Καταχώριση` action while retaining the same history/target/Reports semantic assertions.
- A narrow source regression locks the contextual modal contract and rejects the retired Savings-dialog path.
- **Completed on exact head `4252847a…`:** CI #3181 passed the repaired contextual Savings manual-transfer flow, including distinct accounts, history/target/report assertions.

**FV-58 — Account Management editor dark-theme contrast — completed**
- Fresh settled dark captures on desktop/tablet/mobile show the Account Management modal using a hardcoded near-white surface while headings/labels inherit dark-theme light ink, producing materially unreadable text.
- Root cause: `AccountManagementSettings.css` uses fixed white/light modal and segment backgrounds instead of semantic theme surfaces.
- **Source-fixed:** Account Management modal and neutral segmented/default-choice controls now use semantic elevated/control surfaces while preserving layout, focus, animation and account semantics.
- Focused source regression requires the semantic surface contract.
- **Completed:** Final Visual QA #92 artifact `11274439706` provides settled Account editor captures in both light and dark themes at desktop, tablet and 375×812 mobile. Direct assistant inspection of all six Account editor captures confirms semantic dark elevated/control surfaces, readable headings/labels/fields, preserved provider branding, contained footer actions and unchanged light-theme presentation. The focused source regression remains in place.

**FV-59 — Rules editor mobile dark header contrast**
- Fresh settled dark mobile capture shows the sticky Rules editor header as a light strip with dark-theme light text. Desktop/tablet Rules editor captures are correct.
- Root cause: the shared <=680px `.editor-dialog` mobile anatomy hardcodes light body/header/action-zone backgrounds.
- **Source-fixed:** the shared mobile `.editor-dialog` body, sticky header, drag indicator and sticky action zone now use semantic elevated/line tokens rather than hardcoded light surfaces.
- Focused source regression rejects the prior light-only mobile editor chrome.
- **Completed:** Final Visual QA #92 directly proves the repaired 375×812 dark Rules editor has dark semantic body/header/action surfaces with readable controls and no light-strip regression. Direct review of the matching dark tablet/desktop captures confirms larger breakpoints remain correct, and the light mobile comparator remains visually intact. The shared mobile semantic-surface source regression remains active.

**QA-SELFLOAN-PRESENTATION — self-loan transfer count includes hidden semantic mirror**
- CI #3179 passed the repaired Savings manual-transfer flow, then failed at the first self-loan transfer-count assertion.
- Direct source review confirms the product creates one finance event. Transactions deliberately renders the same current page into the visible desktop ledger and a hidden semantic table, and both representations expose `data-transaction-kind` / `data-transaction-source`.
- The self-loan harness counted both representations without the existing visibility filter already used by other CRUD assertions, so one transfer appeared as two DOM rows; the later two-transfer lifecycle assertion has the same defect.
- **Source-fixed:** both initial and lifecycle transfer counts now filter to the visible desktop transaction representation while retaining the exact note/kind/source/neutral-transfer checks.
- A narrow source regression requires visibility-aware counting for both assertions.
- **Completed on exact head `4252847a…`:** CI #3181 passed self-loan create, neutral initial transfer, partial return and forgiveness through the complete rendered lifecycle. No loan/domain/persistence behavior changed.

**QA-LENDING-PRIVACY-STATE — full-repayment assertion assumes visible privacy state**
- CI #3180 passed the repaired Savings and complete self-loan lifecycle proof, then reached Lending full repayment with the correct domain state: 3 history rows, 2 repayments, `settled:true` and repayment disabled.
- The assertion failed only because the QA app intentionally initializes `privacyVisible=false`, so the history summary rendered a masked balance instead of visible `0,00`.
- The following privacy step was also inverted: after clicking the toggle from the initial hidden state, the harness expected `aria-pressed=false` again instead of the actual revealed `true` state.
- **Source-fixed:** the harness now asserts the settled/disabled state while values are initially masked, reveals privacy and requires visible `0,00`, then hides privacy again and requires masked identity before capture.
- A focused source regression locks both `aria-pressed` transitions and the visible-zero proof.
- **Completed on exact head `4252847a…`:** CI #3181 passed the full Lending create/partial/full repayment/privacy flow. No Lending/domain/persistence behavior changed.

**QA-REPORTS-PERIOD-SYNTAX — Reports period-navigation harness does not parse**
- CI #3181 completed the full Completion functional CRUD suite, mutation-validation suite, geometry matrix, UI completion/runtime, Credit over-limit/statements, refresh/recovery and session runtime checks before failing when Node parsed `scripts/reports-visual-qa.mjs`.
- The newly added period-navigation CDP calls used double-quoted JavaScript strings containing unescaped double quotes inside `aria-label="…"` selectors at both previous-month and next-month actions, producing `SyntaxError: missing ) after argument list` before the Reports suite could execute.
- CI #3182 proved the new fail-fast preflight works: it stopped immediately before browser work and exposed one additional nested-quote parse error in the July-state reader that checks whether the next-month control is disabled.
- **Source-fixed:** previous-month click, July-state read and next-month click now all use syntax-safe template-literal CDP function strings; `run-rendered-qa.mjs` syntax-checks every rendered QA module before browser work.
- Focused source contracts cover all three period-navigation blocks plus the fail-fast syntax preflight.
- **Completed on exact head `703461c1…`:** CI #3183 passed the rendered-module syntax preflight and the complete Reports visual QA period-navigation/runtime suite. This QA harness defect is closed; no Reports product defect was found.

**QA-BUDGET-RULES-SEARCH — rule-application proof uses brittle label-only input lookup**
- CI #3183 passed Reports, Theme System and Action Center, then advanced into Budget/Rules through budget integration, Rules workspace creation/reorder/pause/edit/delete and the start of “rules affect only new matching transactions”.
- After navigating to Transactions, the harness found the correct route heading but its generic `setLabelInput` helper failed to resolve `Αναζήτηση συναλλαγών` because it only searches a visible wrapper `<label>` and then a nested native input.
- Product source exposes the search field directly and accessibly as `<AppTextInput aria-label="Αναζήτηση συναλλαγών" …>`; no product regression is indicated.
- **Source-fixed:** the Budget/Rules input helper now prefers a visible native `input`/`textarea` with an exact `aria-label`, then falls back to the existing visible wrapper-label lookup; the source contract locks that direct accessible-label path.
- **Completed on exact head `174ea8d7…`:** CI #3184 passed the complete Budget/Rules rendered suite, including the existing-vs-new matching transaction assertions. This evidence-harness defect is closed.

**QA-COMMAND-QUICKENTRY-SELECTOR — global Quick Entry proof throws inside browser selector evaluation**
- CI #3184 passed Budget/Rules, Settings tabs, Provider branding, normalized payment flows and shared primitive adoption, then failed in `command-palette-qa.mjs` immediately after the global `Ctrl+Shift+Space` Quick Entry shortcut had already opened successfully.
- The failing assertion uses an inline `document.querySelector` with unquoted attribute-value selectors to find the editable Quick Entry control; CDP reports a browser-side `Uncaught` exception before the assertion can return.
- The same block then attempts its direct-action proof through the mobile-only `Άνοιγμα γρήγορης καταχώρισης` control even though the route is still at desktop width; programmatic clicks on hidden controls are not valid evidence of the visible desktop action.
- **Source-fixed:** the editable-control assertion now uses syntax-safe quoted attribute selectors, the aria helper selects only a visible exact-label button, and the desktop direct-action proof invokes the visible `Γρήγορη προσθήκη`; the later mobile trigger coverage remains unchanged.
- Focused source contracts lock both the visible-control lookup and the syntax-safe Quick Entry selectors.
- **Completed in CI #3186:** the unified search/Command Palette rendered suite passed the real `Ctrl+Shift+Space` Quick Entry shortcut, visible desktop one-step action, mobile trigger, navigation/no-results/recents, ARIA/privacy and exact loan/Lending/recurring/scheduled actions. No Quick Entry or command-palette product defect was found.

The original QA-NESTED-ANIM timing defect and the two real product defects it exposed (FV-58/FV-59) are now proven resolved by the settled Final Visual QA #92 matrix and direct review above. Implementation batch S is closed. These follow-ups do not change the denominator. No Android repository changes are involved.

### 8.50 CI #3186 — closed `<details>` keyboard-order evidence follow-up — completed

Exact-head CI #3186 on `88095ca…` passed the full source/unit/build phase and all rendered suites before Keyboard/Semantic Accessibility reached the mobile Recurring route. The failure reported `document.activeElement === BODY` at Tab step 20 even though every previously reached real control had a visible focus indicator.

Direct source review shows this is a QA visibility-model defect, not a Recurring focus-style regression:
- the mobile Recurring action menu uses native closed `<details>` elements;
- the harness counted descendants of closed `<details>` as visible candidates from geometry/CSS alone, but native sequential keyboard navigation correctly excludes those descendants until the disclosure is opened;
- that inflated candidate count caused the sweep to continue after the last real focus target, where Chromium can move focus to `BODY` before wrapping.

**Source-fixed:** both semantic and Tab-order visibility helpers now exclude descendants of closed native `<details>` while still treating the direct `<summary>` as visible/focusable. The existing assertions for visible focus, positive `tabindex`, focus order, control naming, table semantics and modal traps remain unchanged for actual keyboard targets. A focused source regression locks the closed-details rule so this cannot be “fixed” later by weakening the accessibility gate.

Status: **Completed on exact head `7dce0860…`.** CI #3190 progressed through the closed-`<details>` mobile Recurring route and reached the later mobile Planning tab sweep, so the corrected native disclosure visibility model is now proven. This item does not change the denominator and does not modify product UI/domain behavior, backend/Supabase code or Android. Current counters remain **Implementations 12/24 completed · Sub-implementations 139/194 completed**.

### 8.51 CI #3188 — lazy-resource recovery focus timing follow-up — completed

CI #3188 passed source/type/unit/build and the rendered suites through runtime/error states, Credit, statements and in-place refresh. In the recovered-surface suite it successfully proved the ordinary PageErrorBoundary receives focus and recovers to Dashboard, then mounted the same safe boundary for the synthetic rejected lazy resource. The harness immediately combined focus and redaction into one assertion after only waiting for the boundary DOM node, while `PageErrorBoundary.componentDidCatch()` intentionally transfers focus on the next animation frame.

Direct source review therefore identifies a QA timing race rather than a product recovery regression: the same boundary/focus implementation had just passed in the preceding ordinary-crash case, and the rendered lazy boundary exposes only the fixed safe copy. **Source-fixed:** the lazy-resource path now waits explicitly for `document.activeElement === .workspace-error` before asserting that the raw missing-resource token is absent and the safe financial-data message is present. The redaction and focus requirements are both retained; they are no longer raced against each other. A source regression locks the dedicated lazy focus wait and rejects the former combined assertion.

Status: **Completed on exact head `7dce0860…`.** CI #3190 passed the full Recovered Surface QA, including ordinary PageErrorBoundary focus/recovery and the delayed lazy-resource focus/redaction path. No product UI/domain behavior, finance persistence, backend/Supabase code or Android code changed. Counters remain **Implementations 12/24 completed · Sub-implementations 139/194 completed**.

### 8.52 CI #3190 — decorative chart keyboard-focus follow-up — completed

Exact-head CI #3190 on `7dce0860…` passed the source/unit/build phase and every rendered suite through Receipt OCR, Ledger foundations, large-data boundaries and 404 accessibility. Keyboard/Semantic Accessibility then failed on **mobile Planning** at Tab step 18 because `document.activeElement` became a non-HTMLElement chart target.

**FV-60 — decorative Recharts remain keyboard-focusable under `aria-hidden`**
- Planning, Dashboard and Reports intentionally mark their visual chart hosts `aria-hidden="true"` and already provide accessible text/list/table alternatives.
- Recharts 3.10.1 enables its chart `accessibilityLayer` by default. That creates keyboard-focus behavior inside a subtree the product has explicitly declared decorative, which can move sequential focus onto SVG content that assistive technology should not encounter.
- The semantic audit also had a blind spot: it checked whether the `aria-hidden` root itself was focusable, but not its focusable descendants; its tab diagnostic also discarded focused SVG/other DOM `Element` targets by requiring `HTMLElement`.

**Source-fixed:**
- Planning `AreaChart`, the lazy Dashboard `PieChart`/`BarChart` implementations and all three Reports `ComposedChart` roots explicitly set `accessibilityLayer={false}` because their owning regions are decorative and have separate accessible alternatives.
- The keyboard/semantic audit now inspects focusable descendants under every `aria-hidden` ancestor and reports any focused DOM `Element`, including SVG, instead of returning `null`.
- Focused source regression locks both the decorative-chart contract and the strengthened audit.

Status: **Completed on exact head `eef0b761…`.** CI #3191 passed the complete desktop/mobile primary-route sweep, every Settings tab and all auth/error states without the former hidden Recharts/SVG focus target; the same accessibility suite advanced beyond FV-60 and failed later in the independent Command Palette focus-trap check. This is an accessibility-presentation correction only; finance/domain behavior, backend/Supabase behavior and the Android repository are unchanged. Counters remain **Implementations 12/24 completed · Sub-implementations 139/194 completed**.

### 8.53 Provider artwork replacement / cross-surface refresh proof — source-expanded, integrated proof pending

Direct review of the Settings account/provider metadata verification row after CI #3190 shows that account CRUD, IBAN/provider correction, provider editor/create flows, asset upload, reuse and semantic slot binding are already covered. One requirement was not yet explicit enough to close the cell: **replacement of an existing provider artwork binding and refresh of a real consumer surface using that replacement**.

The existing provider branding rendered suite is expanded without product changes:
- upload `qa-shared.svg` into the existing Piraeus **Βασικό λογότυπο** slot, which replaces the previously resolved production base-logo binding;
- close the editor and require the compact provider list to resolve a different loaded image source from the original production source;
- navigate through the real sidebar to Dashboard and require the Piraeus `BankBrandMark` consumer to resolve the exact same replacement source;
- persist a dedicated `provider-replaced-artwork-dashboard-dark-desktop` screenshot;
- navigate back to Settings/Accounts and continue the existing reopen/mobile/create/failure-recovery provider checks;
- source regression locks the replacement and cross-surface refresh assertions.

Status: **Completed on exact head `01c392b8…` / CI #3196.** The expanded Provider Branding suite printed `Provider branding task-flow QA passed` after the saved existing-provider replacement, refreshed provider-list source and Dashboard consumer-source equality checks. Account Metadata QA also passed on the same head. The overall CI job was later cancelled by the separate FV-62 teardown hang, so this closure is scoped to the already-completed provider/account suites and does not imply a green whole-CI result. No backend/API/Supabase or Android behavior changed.

Current counters after closing Settings account/provider metadata are **Implementations 12/24 completed · Sub-implementations 141/195 completed**; FV-62 is the newly accepted denominator item and remains proof-pending.


### 8.55 CI #3192 — provider replacement proof omitted save — source fix in progress

Exact-head CI #3192 on `4cc6a9fb…` passed the title-bar, Planning, Theme, Action Center, Settings tabs and Budget/Rules rendered suites before failing in the newly expanded provider cross-surface replacement proof.

**QA-PROVIDER-REPLACE-SAVE**
- The existing provider editor successfully uploads `qa-shared.svg`, assigns it to `Βασικό λογότυπο` and reuses it for `Βασικό λεκτικό σήμα`.
- The new proof then closed the editor with the header X and immediately asserted that the provider-list image source changed.
- Product behavior is correct: closing the editor without `Αποθήκευση` discards the unsaved assignment. The harness therefore asserted persisted replacement without executing the save action.
- Required remediation: submit the existing provider editor through its real `Αποθήκευση` action, wait for the editor to close and refreshed catalog to render, then compare the provider-list source and verify the same source on Dashboard before reopening Settings.
- Scope is provider rendered QA + source contract only; no provider-management/product mutation semantics, backend/Supabase behavior or Android code changes are required.

Source-fixed: the provider replacement proof now submits the real existing-provider `Αποθήκευση` action, waits for the successful-save editor close and only then compares the refreshed provider-list source and Dashboard consumer source. A focused source contract requires save-before-consumer verification.

Status: **source-fixed; exact-head rendered proof pending**. This is evidence-harness work inside the existing Settings account/provider cell and does not change the denominator.

### 8.54 CI #3191 — Command Palette focus-trap follow-up — source-fixed, proof pending

Exact-head CI #3191 on `eef0b761…` passed the complete route/settings/auth keyboard-semantic sweep, proving FV-60 resolved, then failed at **Command Palette focus trap step 2**.

**FV-61 — Command Palette modal focus can escape on sequential Tab**
- The Command Palette correctly opens with focus inside the dialog, but its result buttons intentionally use `tabIndex={-1}` because Arrow Up/Down + `aria-activedescendant` own result navigation.
- The shared `useModalFocus` helper currently treats every enabled button as a sequential focus target even when its effective `tabIndex` is negative, and only intercepts Tab at its computed first/last boundaries. That focus model disagrees with the browser's actual tab order and allows the second Tab to leave the dialog.
- Required remediation: make shared modal focusability honor effective `tabIndex >= 0`, prevent every Tab/Shift+Tab handled by the topmost modal, and explicitly cycle through its current sequential focus targets.
- Preserve Escape dismissal, nested/topmost modal ownership, preferred initial focus, dynamic error association and opener focus restoration.
- Scope is shared modal-focus infrastructure plus source/runtime accessibility regression. No Command Palette search/result semantics, finance/domain behavior, backend/Supabase behavior, packaging or Android code changes are required.

**Source-fixed:** `useModalFocus` now treats only effective `tabIndex >= 0` descendants as sequential focus targets, prevents every Tab/Shift+Tab handled by the topmost modal and explicitly cycles to the next/previous current target. This preserves the Command Palette's arrow-key/listbox result model while keeping its close button/search input inside a deterministic modal cycle. Focused source regressions lock the effective-tabindex filter and forward/backward cyclic arithmetic.

Status: **Completed on exact head `01c392b8…` / CI #3196.** The Command Palette rendered suite passed, and the later full Keyboard/Semantic Accessibility suite passed across all primary desktop/mobile routes, Settings/auth states and shared modal-focus contracts. The job-level cancellation occurred afterward in unrelated process teardown. This follow-up does not change the denominator.


### 8.56 CI #3196 — rendered-suite process teardown hang — source-fixed, proof pending

Exact-head CI #3196 on `01c392b8…` passed root/API source checks and every rendered suite assertion, including Provider Branding, Completion Functional CRUD, Large-data Boundaries, 404 Accessibility and Keyboard/Semantic Accessibility. The coordinator never printed its final all-suites completion line and the job hit the 30-minute workflow timeout roughly 20 minutes after the final assertions had completed.

**FV-62 — isolated Chromium child processes can outlive a completed suite**
- `large-data-boundaries-qa.mjs` and `not-found-accessibility-qa.mjs` printed their final PASS lines but ended with fire-and-forget `child.kill('SIGTERM')` cleanup.
- If Chromium does not exit promptly, the Node QA process retains the child-process handle; `run-rendered-qa.mjs` therefore keeps waiting even though the suite assertions are complete.
- The first remediation kept every assertion, threshold and browser requirement unchanged and added awaited cleanup to the two final suites, but CI #3200 proved other rendered harnesses still used fire-and-forget child teardown.
- The systemic remediation now loads one test-only ChildProcess guard into every coordinator-launched rendered suite. It preserves the script's requested SIGTERM, applies SIGKILL after 2 seconds only if the child remains alive, then unrefs the handle if necessary. A focused source regression requires the preload, bounded force-kill and unref contract.

Status: **source-fixed; exact-head coordinator proof pending.** CI #3200 and #3204 proved that browser-child escalation alone was insufficient: every rendered assertion passed, but the suite Node processes could still retain CDP/WebSocket/event-loop handles after their top-level QA modules had finished. The coordinator now launches every QA module through `qa-script-runner.mjs`; the wrapper awaits module evaluation (so assertions/finally complete), drains guarded child processes, then exits with the exact module success/failure code. This makes module completion—not incidental event-loop handle lifetime—the suite boundary. The child guard still preserves SIGTERM first and bounded SIGKILL/unref cleanup. Focused regressions lock the wrapper/import/drain/exit contract. No assertion, threshold, product UI/domain logic, backend/Supabase behavior, packaging semantics or Android repository code changed.


### 8.57 CI #3210 — Card Vault hard-reload metadata fixture mismatch — source-fixed, proof pending

Exact-head CI #3210 on `60f7c3c…` proved the rendered-suite completion wrapper is now terminating completed modules correctly, then failed inside the dedicated Card Vault runtime suite after the real `Page.reload` step.

**QA-CARD-VAULT-RELOAD-METADATA**
- The synthetic encrypted-secret backend was preloaded correctly across the hard reload, but the QA FinanceData fixture recreated `QA Debit` without its persisted `vaultRef` metadata.
- Product behavior was therefore correct: after reload, `CardDetailsDialog` saw a metadata-only card and intentionally did not issue the POST reveal request, so the harness timed out while waiting for server-secret fields that the product had no reason to request.
- The QA-only fix adds a scoped `card-vault=ready` fixture state that reloads the card with the persisted `vaultRef`/last4 metadata while the separate preload retains the synthetic server-vault secret. The suite now models both real persistence boundaries instead of assuming the in-memory pre-reload card object survives navigation.
- Focused source regression locks the query-state contract and persisted vault reference. No card-vault product behavior, FinanceData production schema, API/auth/Supabase behavior, packaging or Android code changed.

Status: **source-fixed; exact-head rendered proof pending.** Counters remain **Implementations 13/24 completed · Sub-implementations 143/195 completed** until the full save → reveal → hard reload → reveal → update → delete runtime sequence passes and is directly reviewed.


### 8.58 CI #3212 — Card Vault post-pass Chromium profile cleanup race — source-fixed, proof pending

Exact-head CI #3212 on `42207eb…` completed the entire Card Vault runtime contract successfully: invalid input stayed local, save/reveal succeeded, a real hard reload re-revealed the synthetic server secret, update succeeded, and explicit DELETE left the next editor empty. The suite then exited non-zero during `finally` because its profile deletion raced Chromium's process-exit completion and hit `ENOTEMPTY` under `Default`.

**FV-62/Card Vault teardown follow-up**
- The browser shutdown helper now sends SIGTERM first, escalates to SIGKILL after two seconds, and waits for the actual child exit event with a bounded 3.5-second fallback instead of resolving immediately when SIGKILL is sent.
- Profile deletion runs only after that shutdown wait plus a short settle interval, uses the existing bounded retry contract, and degrades a residual filesystem race to a cleanup warning because the coordinator also owns profile cleanup after module exit.
- Focused source regression locks the bounded post-SIGKILL wait and deferred-cleanup diagnostic. No rendered assertion, Card Vault product/API behavior, security boundary, persistence schema, package behavior or Android code changed.

Status: **source-fixed; exact-head coordinator proof pending.** The Card Vault functional cell has runtime assertion evidence from CI #3212, but counters remain **Implementations 13/24 completed · Sub-implementations 143/195 completed** until the coordinator itself completes successfully on the exact head.


### 8.59 CI #3213 — FV-62 coordinator and Card Vault runtime proof completed

Exact-head CI #3213 on `c9cee0c…` completed successfully with the full rendered coordinator enabled.

- `card-vault-runtime-qa.mjs` passed invalid-input isolation, save/reveal, real hard reload + reveal, update and explicit delete, then emitted `Rendered QA module completed`.
- Every subsequent rendered QA module also emitted its completion marker; the coordinator finished with `All rendered browser QA suites passed on primary Chromium`.
- Root/API checks, npm audits, CodeQL #3166, Cross-engine #2339, Performance #2374, Windows Desktop #2772, Windows First Run #1323 and Windows Clean Launch #1324 all passed on the same source head.
- Final Visual QA #97 also succeeded and persisted the refreshed 216-capture matrix in the follow-up screenshot-only commit `1960f1d…`.
- FV-62 is therefore completed. The 8.4 Card Vault functional cell is closed and the global checkpoint advances by exactly one accepted checklist item.

Status: **completed. Implementations 13/24 completed · Sub-implementations 144/195 completed.**


### 8.60 Focused 404 semantic dark-theme evidence — source-fixed, proof pending

Direct inspection of the focused 200%-equivalent 404 artifact found that the file named `not-found-dark-200pct.png` was still visually light. The product 404 itself was not at fault: the focused harness changed only `document.documentElement.dataset.theme='dark'`, while MyFinHub's semantic theme system requires `applyThemePreference('dark')` to update the root token set.

- The focused 404 QA now uses the real `src/lib/theme.ts` application path for both explicit Light and Dark states.
- Runtime assertions require persisted preference, resolved theme, color-scheme and distinct canvas/ink semantic tokens before the screenshots are accepted.
- The existing keyboard-order, visible-focus, 200%-equivalent containment and reduced-motion assertions remain unchanged.
- Source regression explicitly rejects the old dataset-only theme mutation.
- No product CSS/component, routing, finance, backend, Supabase, packaging or Android behavior changed.

Status: **completed on exact source head `74bdc0c…` / CI #3216.** The focused runtime suite passed, and direct assistant inspection confirms the Light/Dark 200%-equivalent captures use genuinely distinct semantic themes with contained layout and readable controls.


### 8.61 CI #3216 — exact-head Chromium + 404/readability verification completed

Source head `74bdc0c…` completed the full review-ready validation wave.

- CI #3216 passed root/API checks, the full primary-Chromium rendered coordinator and npm audits. Every rendered module completed; zero fallback activations were used.
- CodeQL #3169, Cross-engine #2342, Performance #2377, Windows Desktop #2775, Windows First Run #1326 and Windows Clean Launch #1327 all passed on the same source head.
- Final Visual QA #98 persisted the 216-capture matrix in screenshot-only commit `2f918176…`; its manifest records source SHA `74bdc0c89b6a97c4a5f98a4dac892148d7cc48a9`.
- Direct assistant inspection of the corrected focused 404 Light/Dark 200%-equivalent captures and keyboard/reduced-motion capture confirms semantic theme parity, visible interactive focus, containment and privacy safety.
- Reused current-product Large-text evidence plus exact-head Theme System/geometry runtime proof closes the 8.2 readability/theme/reduced-motion item.
- The 8.9 exact-head Chromium implementation is 9/9 complete. The 8.14 manual 404 review is complete; only the external Vercel/production-like unknown-HTTP-path deployment proof remains open in that section.
- A11Y-404-FOCUS, FV-55, FV-56 and FV-62 ledger states are reconciled to closed from current-head rendered/runtime evidence. No new product behavior or Android code is introduced by this checkpoint.

Checkpoint: **Implementations 14/24 completed · Sub-implementations 147/195 completed.**


### 8.62 Desktop host visual evidence expansion — source-implemented, proof pending

Direct evidence-gap reconciliation found that the existing Windows gates prove package/install/launch/native BrowserWindow behavior but do not produce host-surface screenshots for App Lock, in-app update states or startup recovery diagnostics. Those are real Windows-only product surfaces required by the still-open 8.2 Windows/Electron visual-review cell.

Source implementation in this batch:
- extend the existing QA-only desktop bridge fixture so the real `DesktopAppLockGate` can render deterministic locked/wrong-PIN/rate-limit states and the real Settings `DesktopUpdatePanel` can render available/downloading/ready/error states;
- add a scoped `desktop-lock` QA screen that wraps a protected workspace in the production `DesktopAppLockGate`; no production route/component behavior changes;
- add `desktop-host-visual-qa.mjs` to the rendered coordinator. It captures App Lock at the production 1440×930 main-window size and the native-probe 1100×760 size, Update Panel states at both sizes, and the real `desktop/setup.html` recovery/diagnostics UI at the production 760×840 setup-window size plus its 620px minimum width;
- the recovery proof injects only a QA bridge state before the real setup renderer executes, verifies the stable diagnostic code/progress, checks horizontal containment and rejects secret-shaped text in the captured surface;
- source regression locks coordinator inclusion, QA bridge scoping and the real recovery-page path.

Status: **completed for the Windows/Electron visual cell on source `41ff4d6a…` / CI #3224.** The suite passed and all 11 host captures were opened individually and directly reviewed. Existing Windows package/native-window gates remain authoritative for actual Electron host mechanics; no physical-device requirement was introduced.


### 8.63 Interaction/dialog visual evidence expansion — source-implemented, proof pending

Evidence inventory showed that several real runtime states were already asserted by `ui-ux-hardening-qa.mjs` but were not persisted for direct visual review. This left the existing 8.2 dialog/interactive-state cells uncloseable despite functional coverage.

Source implementation in this batch:
- persist the existing Dashboard persistence error, revision-conflict, loading and saving surfaces plus the safe page-error recovery surface;
- capture the existing real Refresh hover tooltip and a CDP mouse-down `:active` pressed state before release, without adding test-only CSS/classes;
- capture the real Quick Add focused dialog and owned date popover, plus the existing Savings, Cards bank picker, Credit purchase, Loans, Lending and Recurring editors while their existing containment/accessibility assertions are active;
- persist existing Savings/Lending/bank validation-error states after real invalid submits;
- add the real Desktop Update Panel `up-to-date` state as a clear success-state visual alongside available/downloading/ready/error host evidence.

Status: **source-implemented; rendered proof and direct screenshot inspection pending.** Counters remain **Implementations 14/24 completed · Sub-implementations 147/195 completed**. This expands evidence only; it does not alter shared control styling, validation semantics, finance behavior, backend/Supabase behavior or Android code.


### 8.64 Data-heavy visual state matrix expansion — source-implemented, proof pending

The existing route-wide hardening suite already exercised empty and extreme fixtures across every primary route, but it did not persist those states for direct visual review and it had no distinct minimal-data fixture. That prevented closure of the existing 8.2 empty/minimal/normal/dense/extreme-content review item.

Source implementation in this batch:
- add a QA-only `minimal` fixture that retains a bounded representative slice of seed/domain collections, one event per event kind (bounded to eight), one scheduled/recurring/loan/lending/budget/goal/rule/statement record where available, and one debit + one credit card; card/statement events are filtered to the retained IDs before kind sampling so the visual fixture remains relationally coherent; production IDs/domain logic remain unchanged;
- persist minimal, empty and extreme route captures for all twelve primary routes at desktop plus mobile/narrow-mobile sizes while retaining the existing overflow, accessible-name, touch-target and runtime-error assertions;
- keep the existing normal desktop/mobile captures, long Greek account name, Unicode/very-long note and large monetary-value extreme fixtures; the separate large-data suite remains authoritative for 1,500-event and 100-row history performance/density boundaries.

Status: **completed.** CI #3224 supplied the full minimal/empty/extreme + dense evidence set, and CI #3234 on `b7d2a160…` supplied the FV-63 exact-head recapture. Direct assistant review opened every invalidated 320px route frame individually after the fix. The 8.2 data-heavy visual sub-implementation is closed; product data, persistence and finance semantics are unchanged.


### 8.65 CI #3221 — dynamic dialog evidence source-regression mismatch — fixed, proof pending

Draft core CI #3221 on `a898ab95…` passed hygiene and 982/983 root tests, then stopped on one new source-contract assertion before build/rendered validation. The production/QA script was correct: dialog evidence filenames are emitted dynamically as `desktop-dialog-${page}` inside the existing six-page loop. The source regression incorrectly required the impossible literal `desktop-dialog-credit` string in source text.

- Correct the regression to lock the actual dynamic filename template rather than one runtime expansion.
- No product, fixture, visual assertion, finance, backend, Supabase, packaging or Android behavior changed.

Status: **completed.** The corrected source-contract assertion passed in draft CI #3223 and the full review-ready CI #3224.


### 8.66 FV-63 — ultra-narrow mobile header brand/action collision — source-fixed, proof pending

Direct assistant review of exact-head source `41ff4d6a…` evidence found a systemic 320px mobile-shell defect that the geometry suite had not detected: the full MyFinHub wordmark visibly collides with/is clipped beneath the Search action. It reproduces in Dashboard, Attention, Reports and Settings extreme 320px captures and therefore invalidates the narrowest evidence for the pending 8.2 data-heavy cell.

- Severity: **Medium**. Finance/security semantics are unaffected, but visible shared chrome overlap violates the no-clipping/no-overlap acceptance bar.
- The defect was recorded in `UI_UX_DEFECT_LEDGER.md` in commit `e17bf4b0…` before remediation.
- Systemic source fix: at `max-width:350px`, the mobile Dashboard brand control retains the canonical brand icon but hides only the visual wordmark copy; its full accessible button name remains unchanged.
- Regression: route-wide mobile hardening now measures the rendered `.brand-mark` right edge against `.top-actions` and fails on less than 2px separation, in addition to the existing overflow/touch-target/runtime checks.
- No route-specific CSS, screenshot patching, finance behavior, backend/Supabase behavior or Android code is changed.

Status: **completed on exact head `b7d2a160…` / CI #3234.** Full rendered QA, Cross-engine #2360, Performance #2395, Windows Desktop #2793, Windows First Run #1344 and Windows Clean Launch #1345 all passed; the refreshed 320px evidence was directly reinspected route-by-route. FV-63 is closed.


### 8.67 CI #3234 — FV-63 + interaction/data-state proof completed

Exact source head `b7d2a160…` completed the remediation validation wave.

- CI #3234 passed source/API checks, npm audits and the full primary-Chromium rendered coordinator with the new route-wide mobile header collision assertion active; no fallback browser activation occurred.
- Cross-engine #2360, Performance #2395, Windows Desktop #2793, Windows First Run #1344 and Windows Clean Launch #1345 all passed on the same source head.
- Direct assistant reinspection opened all twelve refreshed 320px extreme route captures individually. The previous MyFinHub wordmark/Search collision is absent everywhere; the ultra-narrow header retains the canonical icon and clear action separation.
- The full data-heavy visual matrix is now complete: minimal/empty/extreme were reviewed individually for all twelve routes, normal states were already covered by earlier direct route reviews, and the six current dense large-data captures were individually reviewed.
- The required interaction-state categories are also complete from direct review of shared/default, hover, keyboard-focus, pressed, selected, disabled, loading/saving, destructive, error, conflict and success evidence.
- The remaining 8.2 work is now only the exhaustive dialog/sheet/popover/picker/confirmation surface-state matrix. Source inventory confirms several destructive ConfirmDialog use-cases still lack direct captures, so that final cell is intentionally not credited yet.

Checkpoint: **Implementations 14/24 completed · Sub-implementations 150/195 completed.**


### 8.68 Exhaustive dialog/confirmation evidence expansion — source-implemented, proof pending

The final open 8.2 cell requires direct evidence for dialog/sheet/popover/picker/confirmation surfaces and applicable opening, focused/populated, validation, saving/success/failure states. Source inventory showed that shared `ConfirmDialog` is reused across destructive and recovery flows, while several existing rendered suites already execute those exact flows without persisting the open confirmation state.

This batch extends only those existing real flows:
- completion CRUD captures transaction delete, savings-goal delete, self-loan forgiveness, permanent debit/prepaid-card delete and account delete confirmations before the already-tested confirm action;
- Planning captures both non-destructive skip and destructive cancel confirmations;
- primitive-adoption captures dirty Quick Entry discard, MoneyEditDialog validation and credit-event delete confirmation;
- frontend QA captures total credit-card deletion and now mirrors the production persistence-recovery flow through the real shared `ConfirmDialog`, capturing it before explicit reload confirmation;
- receipt OCR opens the real local receipt delete confirmation and cancels it, proving the durable local draft remains;
- Settings opens the real remote-device revoke confirmation and JSON-import confirmation, then uses safe Cancel so no external/destructive mutation occurs;
- the six existing finance-dialog captures are split into immediate `opening` and delayed `settled` frames. The settled frame now requires computed opacity >= .99 and non-zero geometry, eliminating the previously ambiguous translucent Loans screenshot;
- source regressions lock all new evidence names plus the persistence-recovery parity contract.

Existing evidence remains authoritative for owned date/select popovers, account/provider pickers, Settings account create/edit modals, command palette, mobile-more sheet, Change History, taxonomy retirement, receipt inbox, Card details/profile and other already-rendered shared surfaces.

Status: **source-implemented; draft core CI, exact-head rendered proof and direct individual screenshot inspection pending.** Counters remain **Implementations 14/24 completed · Sub-implementations 150/195 completed**. No product finance semantics, backend/Supabase behavior, destructive external action or Android code changed.


### 8.69 FV-64/FV-65 — dialog contrast and evidence-targeting defects — recorded before fix

Direct individual review of CI #3255 / source `68417aba…` found two material blockers in the final 8.2 dialog-evidence cell.

**FV-64 — Medium, systemic shared dialog surface**
- Reproduction: open the mobile Credit card flow and capture either the shared MoneyEdit validation dialog or the shared credit-event destructive confirmation. The underlying dark-green/yellow card artwork remains visibly present through the dialog body, reducing text/background separation; desktop confirmation surfaces do not reproduce the issue.
- Affected matrix cells: 8.2 exhaustive dialogs, mobile Credit validation/destructive confirmations, shared `DialogShell` visual contract.
- Root cause classification: systemic shared component styling. `ConfirmDialog` and `MoneyEditDialog` depend on generic `quick-modal neo-raised` background semantics and do not own an explicit opaque semantic dialog surface in all lazy-loaded route combinations.

**FV-65 — Medium, Receipt Inbox delete-confirmation stacking**
- Reproduction: CI #3255 asserts the receipt delete alertdialog exists, yet `confirm-receipt-delete.png` shows only the Receipt Inbox. Source inspection confirms `.receipt-inbox-backdrop` is z-index 130 while the shared `.modal-backdrop` is z-index 100, so the nested sibling confirmation is visually behind the inbox.
- Affected matrix cells: 8.2 Receipt Inbox destructive confirmation and shared nested-modal stacking behavior.
- Root cause classification: product stacking contract local to Receipt Inbox composition; keep shared ConfirmDialog behavior unchanged and raise only the nested confirmation layer.

**FV-66 — Medium evidence blocker, Settings device-revoke failure capture**
- Reproduction: CI #3255 reaches the synthetic revoke failure and asserts the inline alert, but the harness cancels the dialog and then generic screenshot preparation scrolls Settings to the top; the saved `settings-device-revoke-failure-desktop.png` therefore omits the failure alert.
- Affected matrix cells: 8.2 device-revoke failure visual proof only; functional revoke failure/recovery semantics already pass.
- Root cause classification: QA evidence ordering/scroll targeting only. Preserve the failure alert in view and capture it without the generic scroll reset.

Status: **source-fixed; exact-head rendered recapture and direct review pending.** Counters remain **Implementations 14/24 completed · Sub-implementations 150/195 completed**; the only open 8.2 cell remains exhaustive dialog/sheet/popover/picker/confirmation coverage.


### 8.70 FV-64/FV-65/FV-66 remediation — source-fixed, proof pending

- **FV-64:** shared `ConfirmDialog` and `MoneyEditDialog` now own an explicit opaque semantic `var(--surface)` background with semantic border/text tokens. The mobile Credit rendered suite parses computed `backgroundColor` and requires alpha >= 0.99 before accepting MoneyEdit validation or destructive confirmation evidence.
- **FV-65:** the Receipt Inbox sibling confirmation backdrop now layers above the inbox (`140 > 130`), preserving the shared `ConfirmDialog`. Receipt OCR QA additionally hit-tests the alertdialog center and fails unless the dialog itself is topmost before capture.
- **FV-66:** after the synthetic device-revoke failure and safe cancel, Settings QA scrolls the real inline failure alert into view, verifies its text/geometry, and captures the current viewport without the generic top-of-page reset.
- Source regression locks all three shared contracts. Finance semantics, receipt persistence, device revocation behavior, backend/Supabase boundaries and Android code are unchanged.

Status: **completed on exact source head `7321c591…`.** Draft CI #3270 and CodeQL #3220 passed; the review-ready full wave then passed CI #3271, Performance #2432, Cross-engine #2397, Windows Desktop #2830, Windows First Run #1381 and Windows Clean Launch #1382. CI #3271 persisted artifact `11287584011` with 423 focused screenshots. Direct assistant inspection passed the four invalidated frames and every shared confirmation surface affected by FV-64. FV-64/FV-65/FV-66 are closed, 8.2 is **12/12**, and the checkpoint advances to **Implementations 15/24 completed · Sub-implementations 151/195 completed**.


### 8.71 Exhaustive dialog visual closure — completed

Exact source head `7321c591c426e91d4232e86ef456d1fa54f75810` completed the final open 8.2 visual sub-implementation.

- Supporting automation: CI #3271 full primary-Chromium rendered coordinator PASS, plus Performance #2432, Cross-engine #2397 and all three Windows gates PASS; CodeQL #3220 was already green on the same source head.
- Evidence artifact: CI #3271 `11287584011` (423 focused screenshots).
- Direct review: the responsible assistant opened the four previously invalid frames individually and re-opened the full shared-confirmation regression set affected by the common dialog-surface fix. No unresolved dialog/sheet/popover/picker/confirmation visual defect remains in the accepted evidence matrix.
- Scope discipline: this closure does not infer real auth/Supabase persistence from synthetic rendered evidence. Authentication/MFA/device-session real-stack proof and isolated-backend persistence remain open under 8.4/8.5/8.10/8.13.

Checkpoint: **Implementations 15/24 completed · Sub-implementations 151/195 completed**.


### 8.72 Vercel branded HTTP 404 — source-fixed, deployed proof pending

The production read-only probe previously returned Vercel's generic `text/plain` 404 despite `public/404.html`. Current Vercel documentation/schema confirms that rewrite definitions support `statusCode`, and filesystem resources take precedence before rewrites.

- Append a terminal `/(.*) -> /404.html` rewrite with `statusCode:404` after the existing Android/account/device/unknown-API compatibility rewrites.
- Preserve `/`, built assets and real function/static paths through Vercel filesystem precedence; preserve unknown `/api/*` JSON routing because the API catch-all remains earlier than the terminal web fallback.
- Add `tests/vercel-routing-contract.test.ts` to lock rewrite ordering, true 404 status and privacy-safe branded static document content.
- Extend `Production Smoke` so the first deployed production candidate must prove unknown path = HTTP 404, `text/html`, `404 · MYFINHUB` marker and privacy-safe Greek copy. This specifically distinguishes the intended app-owned 404 from the current platform-generic `text/plain` response.
- No production deployment is performed by this source batch; Git deployment remains `main`-only.

Status: **completed with real Vercel preview runtime proof.** Draft CI #3274 and CodeQL #3223 passed on validated routing source `154f722a…`. The owner-approved preview `dpl_CPjne4Gbd7xiE6CjTbsP8AjyE9qs` then proved branded HTML HTTP 404, root HTTP 200 and unknown-API JSON HTTP 404. No production alias/promotion occurred, and the one-off branch deployment enablement is removed immediately after proof.


### 8.73 CI #3273 — stale unknown-API last-rewrite assertion — fixed, proof pending

Draft CI #3273 on `0b623c96…` passed hygiene and the new Vercel 404 routing regression, then stopped in two older source-contract tests that assumed `/api/(.*)` must be the final rewrite. That assumption became stale when the intentional terminal branded web 404 fallback was appended.

- Keep the exact unknown-API JSON fallback unchanged.
- Update both tests to locate `/api/(.*)` explicitly and require it to precede the terminal `/(.*) -> /404.html` rewrite.
- Continue requiring the API health function to emit `API_NOT_FOUND` JSON and the local server to keep its `/api/{*splat}` JSON boundary.
- No routing/product/API behavior changed in this follow-up; only the regression contract now matches the accepted two-tier API-then-web fallback ordering.

Status: **test-maintenance fixed; draft core proof pending.** Counters remain **Implementations 15/24 completed · Sub-implementations 151/195 completed**.


### 8.74 Vercel preview runtime proof — completed

The owner explicitly approved a one-off Vercel preview because 8.14 could not be proven by source/local hosting alone and automatic non-main deployments are intentionally disabled.

- Validated functional routing source: `154f722a175a277357e4c549a219e416ca9547ad` with draft CI #3274 PASS and CodeQL #3223 PASS.
- Final Visual #102 persisted only screenshot evidence after that source; manifest provenance remains `154f722a…`.
- Temporary preview-enablement commit: `567b9b4ba3e912974515900ae0d45e1b4a6d0a36`, whose only functional difference is the one-off branch entry under `git.deploymentEnabled`.
- Vercel deployment: `dpl_CPjne4Gbd7xiE6CjTbsP8AjyE9qs`, state READY, `target:null`, branch `feat/476-completion-audit-hardening`; no production promotion/alias assignment was performed.
- Unknown web-path probe: HTTP 404 + `text/html; charset=utf-8` + `404 · MYFINHUB` + `Χάσαμε τη διαδρομή, όχι τα δεδομένα σου.` + privacy/security response headers.
- Root sanity probe: HTTP 200 HTML.
- Unknown API sanity probe: HTTP 404 JSON with `code: API_NOT_FOUND` and `cache-control: no-store`, proving the terminal branded web fallback does not steal the API error boundary.
- This closure commit removes the temporary feature-branch deployment enablement and restores the repo rule that only `main` deploys automatically.

Status: **8.14 = 10/10 completed.** Overall checkpoint advances to **Implementations 16/24 completed · Sub-implementations 152/195 completed**. Production `main` remains unchanged; the preview was verification-only.


### 8.75 FV-67 — local real-stack synthetic email rejected by GoTrue — recorded before fix

Real Stack E2E run #2 on head `3dd5821…` successfully booted Supabase CLI 2.119.0, applied the complete repository migration chain through `20261001220945_reject_cross_account_id_collisions`, started the MyFinHub API, and then failed at the first valid synthetic-password login with HTTP 422 `AUTH_REJECTED`.

- Reproduction: the harness creates its local-only owner as `myfinhub-real-stack-<nonce>@example.invalid`; invalid-password handling reaches the expected app boundary, but the valid-login path is rejected by current local GoTrue email validation before MFA enrollment can begin.
- Affected matrix cells: 8.4 Authentication/MFA/device-session real-stack proof and 8.10 isolated-backend proof. No production/Auth project or finance data is involved.
- Root cause classification: QA fixture/input defect, not a product authentication regression. The reserved `.invalid` domain is unsuitable for this GoTrue validation path even though the admin-create call accepts the synthetic record.
- Required remediation: keep a unique non-deliverable test identity but use a standards-valid `example.com` mailbox, still created through the local admin API with `email_confirm:true`; retain the existing wrong-password, MFA, session restoration, revocation and persistence assertions unchanged.

Status: **recorded; source fix pending.** Completion counters remain **Implementations 16/24 completed · Sub-implementations 152/195 completed** until the corrected isolated real-stack run passes and is directly reviewed.


### 8.76 FV-68 — real-stack auth/MFA failure lacks stage attribution — recorded before fix

Real Stack E2E run #4 on head `e74c54a…` disproved the FV-67 email-domain hypothesis: changing the synthetic owner from `example.invalid` to `example.com` did not move the failure. The local Supabase stack again booted, applied the full migration chain and brought the MyFinHub API to readiness, then the harness failed within the first auth/MFA sequence with HTTP 422 `AUTH_REJECTED`.

- Reproduction: run `Real Stack E2E` on the current branch. After `[real-stack] local Supabase + MyFinHub API ready`, the current harness emits only `Expected HTTP 200, received 422 (AUTH_REJECTED)` and therefore cannot distinguish valid password login/factor discovery from TOTP enrollment/verification.
- Affected matrix cells: 8.4 Authentication/MFA/device-session real-stack proof and 8.10 isolated-backend proof only.
- Root cause classification: QA observability/evidence blocker. The product may still be correct; the failing operation must be identified before any product/Auth configuration change is justified.
- Required remediation: add privacy-safe stage attribution around the synthetic real-stack auth/MFA sequence without logging passwords, TOTP secrets/codes, JWTs, cookies, keys or owner data; rerun the same isolated stack unchanged and use the first named failing stage to determine the actual defect.

Status: **recorded; diagnostic source fix pending.** FV-67's proposed email-domain remediation is not accepted as root cause. Completion counters remain **Implementations 16/24 completed · Sub-implementations 152/195 completed**.


### 8.77 FV-69 — local Supabase TOTP disabled by repository config — recorded before fix

Real Stack E2E #6 on exact head `a7f5fd3…` localized the 422 failure to **`mfa-enroll`**. Password rejection, valid password login, owner authorization and factor discovery all succeeded first. Current Supabase CLI config documentation defines `auth.mfa.totp.enroll_enabled` and `auth.mfa.totp.verify_enabled` with local defaults of `false`; this repository's `supabase/config.toml` has no `[auth.mfa.totp]` section.

- Reproduction: boot the repository with Supabase CLI 2.119.0 and execute the real-stack flow. The harness reaches `[real-stack] stage mfa-enroll` and receives HTTP 422 `AUTH_REJECTED`.
- Affected matrix cells: 8.4 real password + mandatory TOTP flow and 8.10 isolated real-stack proof.
- Root cause classification: local-development configuration parity defect. Hosted/product policy requires TOTP/AAL2, but the repository-defined local stack implicitly leaves TOTP enrollment and verification disabled under the current CLI defaults.
- Required remediation: explicitly enable TOTP enrollment and verification in `supabase/config.toml`, add a source regression lock for both flags, and rerun the unchanged synthetic local E2E. Do not weaken mandatory MFA, do not add another login path and do not touch production Supabase state.

Status: **recorded before fix; source remediation pending.** FV-68 observability work successfully identified the failing stage and is complete as diagnostic infrastructure. Completion counters remain **Implementations 16/24 completed · Sub-implementations 152/195 completed** until runtime proof passes.


### 8.78 FV-70 — active-device first-session bootstrap blocked by INSERT representation RLS — recorded before fix

Real Stack E2E #8 on exact head `5d72e0e…` proved the TOTP configuration fix: invalid password, valid password, TOTP enrollment, invalid TOTP and valid TOTP all completed. The next authenticated session bootstrap failed with HTTP 401 `DEVICE_ACCESS_REVOKED` before any finance mutation.

- Reproduction: after first successful AAL2 verification, call `/api/auth/session`. `ensureDeviceSessionAccess` finds no active registry row and inserts one with `Prefer: return=representation`.
- Affected matrix cells: 8.4 active-device lifecycle and 8.10 real-stack session/persistence proof.
- Root cause classification: backend/RLS bootstrap defect. The hardened registry SELECT policy intentionally requires the current session to already be active; an INSERT that requests a returned representation also needs the new row to satisfy SELECT visibility. Supabase/PostgREST documents this class of 403/RLS failure for INSERT+RETURNING when SELECT policy does not yet cover the row. The registry's INSERT policy is deliberately bootstrap-capable, but the requested representation reintroduces the pre-bootstrap SELECT dependency.
- Security-preserving remediation: bootstrap the row with `return=minimal`, synthesize the already-known non-secret registry record on success, and handle a primary-key race/conflict by re-reading the active row. If a conflicting row remains invisible after the retry, fail closed as `DEVICE_ACCESS_REVOKED`; never bypass RLS and never introduce a service-role server path.
- Regression requirement: unit coverage must prove minimal-return bootstrap, concurrent bootstrap recovery and revoked-session fail-closed behavior.

Status: **source-fixed on `89671b4…`; runtime proof pending.** Device bootstrap now uses `return=minimal`; a same-session insert conflict is re-read to recover a legitimate concurrent bootstrap, while a conflicting row that remains hidden fails closed as `DEVICE_ACCESS_REVOKED`. Unit regression coverage locks minimal-return, race recovery and revoked-session behavior. Real Stack E2E #10 (`37187090650`) is the active runtime proof. FV-69's local TOTP parity correction is already runtime-proven through successful AAL2 verification, but no completion counter advances until the remaining real-stack sequence is green. **Implementations 16/24 completed · Sub-implementations 152/195 completed**.


### 8.79 FV-71 — real-stack import fixture rejected by canonical validation — recorded before fix

Real Stack E2E #12 on exact head `871dbed…` proved the FV-70 device bootstrap remediation far enough to restore the authenticated AAL2 session. The sequence passed invalid password, valid password, TOTP enrollment, wrong TOTP, valid TOTP and first active-device bootstrap, then failed on the first full-document import with HTTP 400 `INVALID_DATA`.

- Reproduction: execute the isolated real-stack harness and reach the post-AAL2 import stage. The harness currently feeds the presentation-heavy `qaFinanceData()` visual fixture into the production import trust boundary.
- Affected matrix cells: 8.4 data-management/import flow, 8.5 persisted-state agreement and 8.10 real-stack persistence proof. Auth/MFA/device bootstrap reached the next stage successfully.
- Root cause classification: test-fixture/trust-boundary mismatch until the exact validation rule is attributed. Do not weaken `validateCompleteFinanceData` or production import validation to accommodate a visual QA fixture.
- Required remediation: introduce a small canonical synthetic real-stack finance fixture that itself passes the same complete production validator, keep it free of personal data, add a regression assertion for that validation contract, and add named stages for import/read/history/save/backup/device operations so later failures are attributable without exposing sensitive values.
- Independent-work rule: this fix is isolated to the real-stack harness/fixtures and must not change finance semantics, production API validation, Supabase production state or Android code.

Status: **recorded before fix; source remediation pending.** Completion counters remain **Implementations 16/24 completed · Sub-implementations 152/195 completed**.


### 8.80 Real-stack #14 closure + isolated recovery batch

Real Stack E2E #14 (`37188037513`) completed successfully on exact head `05b8138e3b6f632c515fb4aec5d249bfa25a7e24`, with CI #3292 and CodeQL #3241 also green. Direct log review confirms all 48 migrations applied and the runtime passed password/Auth, mandatory TOTP/AAL2, session restoration/logout, first-device bootstrap, real import/read/history/save, stale revision conflict, reload persistence, backup, direct relational database read-back, device list/revoke/revoke-others/stale-session and re-authentication.

This closes 3 cells in 8.4 and 2 cells in 8.10. The next isolated, non-production batch extends the same zero-cost stack with real history undo/redo, encrypted Card Vault CRUD and a backup → post-backup mutation → authenticated import recovery exercise. The recovery proof reads the immutable backup only inside the disposable local stack, verifies card-vault plaintext is excluded from FinanceData backup content, checks history/audit/database-health consistency after restoration and never touches production data or a paid service. Source is implemented; runtime credit is deferred until the new exact-head Real Stack E2E passes and is directly reviewed.

**Implementations 16/24 completed · Sub-implementations 157/195 completed**


### 8.81 FV-72 — real-stack direct DB revision assertion used a pre-undo/redo revision — recorded before fix

Real Stack E2E #15 on exact head `4ecbcc8555d0280b0e5b579f9f9b67a44952e161` passed the newly added history undo/redo and encrypted Card Vault write/read stages, then failed immediately after manual backup at the direct database revision check.

- Reproduction: the harness saves mutable state, captures `persisted` before history movement, performs undo and redo (each correctly advancing the canonical revision), creates a backup, then compares `rheomiq_app_state.revision` against the earlier `persisted.body.revision`.
- Affected matrix cells: only the new 8.16 backup/recovery proof and supporting 8.5 direct persisted-state agreement evidence. Product persistence, history and vault behavior reached their expected runtime stages before the faulty assertion.
- Root cause classification: test-harness assertion defect. The expected revision must be the post-redo canonical revision; backup creation itself is revision-neutral.
- Required remediation: compare the direct database row against `redone.body.revision`, add an explicit `direct-db-read` stage and a source regression preventing the stale pre-history comparison. Do not change finance RPCs, history semantics, Card Vault behavior or production state.

Status: **recorded before fix; remediation pending.** No completion counter advances from the failed run. **Implementations 16/24 completed · Sub-implementations 157/195 completed**.


### 8.82 Real-stack #17 recovery closure + forward-only migration rehearsal source

Real Stack E2E #17 (`37190515689`) completed successfully on exact head `3a4a39a74a874d8fabaa060bd096041bac73ac4f`; CI #3295 and CodeQL #3244 are also green. Direct log review confirms the full 48-migration replay and every named stage through backup restoration, Card Vault separation, device revocation/re-authentication and logout passed. FV-72 is therefore runtime-closed.

This closes two 8.16 cells: current migration-chain rehearsal/parity and real backup → mutation → authenticated restore/recovery. The next source batch adds an executable synthetic partial-migration roll-forward rehearsal inside the same disposable local database. It creates only `public.myfinhub_migration_recovery_probe`, preserves one synthetic sentinel, applies idempotent corrective SQL, verifies RLS/grant/policy posture and confirms the Supabase migration ledger count is unchanged. The probe is dropped afterward. It does not call `db reset --linked`, does not use `migration repair`, and never touches production. The 8.16 roll-forward cell remains unchecked until this new exact-head runtime passes.

**Implementations 16/24 completed · Sub-implementations 159/195 completed**


### 8.83 Real-stack #18 forward-recovery closure

Real Stack E2E #18 (`37190958551`) completed successfully on exact head `65cb3c61817140ed6d68dece9b064d1e85c2c47e`; CI #3296 and CodeQL #3245 are green on the same head. Direct log review confirms both the complete real-stack finance/auth/backup-recovery sequence and the local-only forward migration-recovery rehearsal passed. The rehearsal preserved synthetic sentinel data, verified final RLS/grants/policy posture, passed an idempotent second roll-forward execution and proved the migration ledger was not rewritten.

This closes the partial/interrupted-migration recovery cell in 8.16. The only remaining 8.16 cell is coherent release identity/stop-ship evidence for an actual release candidate. Branch/PR evidence remains supporting evidence only; canonical develop/main work is still tracked separately.

**Implementations 16/24 completed · Sub-implementations 160/195 completed**


### 8.84 Actual-browser real-stack mutation proof — source integrated, runtime proof pending

The next zero-cost proof batch now drives the **real production-built MyFinHub UI** in headless Chromium against the same local MyFinHub API and disposable Supabase stack used by Real Stack E2E. This is not the synthetic `qa.html` surface and does not intercept `fetch`.

- Source helper `scripts/real-stack-browser-e2e.ts` signs in through the real Login/MFA screens using the synthetic local owner, then exercises modern transaction create → hard reload → edit → hard reload → delete → hard reload → durable undo, plus legacy override → hard reload → tombstone delete → hard reload → durable undo.
- The main real-stack harness now starts the built application with `--serve-dist` and invokes the browser proof only after the existing API/RLS/device lifecycle assertions, so the browser session cannot perturb the earlier two-device count assertions.
- The workflow builds the application before the proof and uploads the focused browser screenshots for direct assistant review. Browser/API failures and runtime exceptions remain fail-closed.
- No production project credential, production finance data, paid Supabase branch or Vercel deployment is used.

Status: **source integrated; exact-head Real Stack runtime + screenshot review pending.** No checklist credit is taken yet. **Implementations 16/24 completed · Sub-implementations 160/195 completed**.


### 8.85 FV-73 — actual-browser amount helper only searched `aria-label` — recorded before fix

Real Stack E2E #21 (`37193647499`) on exact head `db8348d31d9d587ba0a498bf18de1eac18a01bd7` passed the complete API/Auth/RLS setup and the real browser login + MFA challenge, then failed at the first modern Quick Entry mutation with `Missing field Ποσό`.

- Reproduction: the actual-browser helper opens the real Quick Entry modal, selects `Έξοδο` and then calls `setByLabel('Ποσό', ...)`. The helper currently resolves only visible `input,textarea` nodes whose `aria-label` equals the requested label.
- Root cause classification: QA-harness selector defect, not a product form/accessibility defect. The real Quick Entry amount control is correctly associated through visible `<label><span>Ποσό</span>…</label>` markup and the existing rendered functional harness already resolves both direct `aria-label` controls and wrapper-label controls.
- Affected matrix cells: pending 8.4 modern/legacy transaction closure, 8.10 browser→real API→real Supabase proof and supporting 8.13 direct evidence. No finance mutation was accepted after the failing browser stage.
- Required remediation: make the actual-browser `setByLabel` follow the same accessible-label fallback used by the established functional harness (visible direct `aria-label`, then visible label wrapper / associated control), add a source regression for that contract, and rerun the exact same real-stack flow. Product Quick Entry code, validation and persistence semantics must remain unchanged.

Status: **closed.** Real Stack E2E #23 on exact head `1bd6acc57821236b45590d9c3e8505e415142e94` passed the real browser Login/MFA and modern/legacy mutation sequence after the selector remediation; CI #3301 and CodeQL #3250 are green on the same head. Both uploaded browser captures were opened individually at full useful resolution and show the expected persisted rows without clipping, stale state or mismatched detail values. FV-73 is closed.


### 8.86 Real Stack #23 actual-browser closure

Real Stack E2E #23 (`37193995386`) completed successfully on exact head `1bd6acc57821236b45590d9c3e8505e415142e94`; CI #3301 and CodeQL #3250 are green on the same head. Direct log review confirms the existing Auth/RLS/import/history/vault/device/recovery sequence remained green and the new real-browser sequence passed Login/MFA, modern create→reload→edit→reload→delete→reload→Undo→reload, and legacy override→reload→tombstone→reload→Undo→reload.

The uploaded artifact `11299913456` contains exactly two focused captures. Both were opened individually at full resolution. `modern-transaction-persisted.png` shows the restored €13.45 edited expense, matching row/details/account/date and recomputed Transactions summary. `legacy-transaction-persisted.png` shows the restored €101.25 seed override, matching row/details/account/date. No visible clipping, overlap, stale row duplication or details mismatch was found.

This closes the 8.4 modern and legacy transaction cells. The 8.10 full browser→real API→real Supabase **mutation matrix** remains open because this proof intentionally covers the transaction domain only; broader product-domain browser mutations must not be inferred from these two flows. The previously stale 8.4 section tally is reconciled to its actual checked cells.

**Implementations 16/24 completed · Sub-implementations 162/195 completed**


### 8.87 Actual-browser real-stack credit lifecycle source — runtime proof pending

The next zero-cost browser→real-stack slice extends the synthetic fixture with a custom `qa-bank` account/provider identity and a configured `qa-credit-card` (no real institution or finance data). The actual browser opens the real Credit workspace, creates a €25.50 card purchase, requires a persisted statement association after hard reload, pays the same statement through the real shared payment modal, and hard-reloads again to verify the statement is paid, the payment row is present and used credit returns to zero.

Focused screenshots `credit-purchase-persisted.png` and `credit-payment-persisted.png` are uploaded by the existing Real Stack artifact step. The 8.4 Credit cell is now closed by Real Stack #28 plus direct screenshot/log review. The broader 8.10 mutation-matrix cell remains open because representative browser→real-stack coverage is still incomplete across product domains.

**Implementations 16/24 completed · Sub-implementations 162/195 completed**


### 8.88 FV-74 — actual-browser Chromium bootstrap flake on credit head — recorded before fix

Real Stack E2E #25 (`37194701939`) on exact head `cd59d50611a4d279b374e2728d897d18c1009240` passed the complete API/Auth/RLS/import/history/vault/device sequence, then failed before the actual-browser UI opened with `Timed out waiting for Chromium.` The browser credit flow itself did not execute.

- CI #3303 and CodeQL #3252 are green on the same head, so the source/fixture batch is syntactically and statically valid.
- Root cause classification: browser bootstrap infrastructure/harness defect. The current real-stack browser helper has a single fixed-port, single-attempt Chromium launch with ignored stdout/stderr, while the repository's established rendered-QA coordinator already treats CDP bootstrap as a retryable infrastructure failure and captures launch diagnostics.
- Required remediation: bring the real-stack browser launcher up to the same repository standard: capture browser diagnostics, fail fast if the process exits before CDP is ready, retry once with a clean profile and distinct fixed CDP port, and terminate each failed attempt before retry. Product code, finance fixtures and credit semantics must remain unchanged.
- Affected matrix cells: only the pending actual-browser credit proof and broader 8.10 browser→real-stack evidence. Existing #23 modern/legacy closure remains valid.

Status: **closed.** Real Stack E2E #28 on exact head `044d7206f1742e4589acaaa75743f7cd8c676cea` passed; Chromium exposed CDP on attempt 1, the complete real-browser credit lifecycle passed, migration recovery also remained green, and CI #3306 + CodeQL #3255 are green on the same head. FV-74 is closed.


### 8.89 Real Stack #28 credit closure + Data Management browser source

Real Stack E2E #28 (`37195612812`) completed successfully on exact head `044d7206f1742e4589acaaa75743f7cd8c676cea`; CI #3306 and CodeQL #3255 are green. Direct log review confirms the full API/Auth/RLS/history/vault/device/recovery path plus actual-browser modern, legacy and credit flows all passed. Chromium bootstrap hardening was exercised successfully on the first attempt.

Artifact `11301196365` was downloaded. The two new Credit captures were opened individually at full useful resolution: the purchase state shows €25.50 used, €274.50 available and €25.50 next payment; the paid state shows €0.00 used, €300.00 available and the persisted €25.50 purchase row. No material clipping, stale duplicate or mismatched balance was found. This closes the 8.4 Credit cell.

The next zero-cost source slice extends the same real browser with the Settings Data tab: real `/api/backup` success plus observed JSON download, rejected invalid import with revision preservation, valid synthetic import through the real confirmation boundary, hard-reload persistence on Dashboard and a server-backed Change History import point. Existing real-stack revision-conflict/history API proof and directly reviewed rendered conflict UI remain part of the combined Data Management evidence. No Data Management completion credit is taken until the new exact-head run and screenshot review pass.

**Implementations 16/24 completed · Sub-implementations 163/195 completed**


### 8.90 Real Stack #29 Data Management closure

Real Stack E2E #29 (`37196371045`) completed successfully on exact head `7d56b752488d330ef7881fee82c85b1ff0224e81`; CI #3307 and CodeQL #3256 are green on the same head. The run preserved the complete API/Auth/RLS/history/vault/device/recovery sequence and additionally passed the real-browser Settings Data backup/export, invalid-import rejection with revision preservation, valid import, hard-reload persistence and server-backed import-history checks.

Artifact `11300858918` was downloaded and `data-management-import-history-persisted.png` was opened individually at full useful resolution. The Change History dialog shows `Εισαγωγή δεδομένων` as the current state, surrounding credit/transaction history entries with timestamps, and the explicit footer statement that file import remains separate and is not automatically included in Undo/Redo. The dialog is contained, readable and free of material clipping/overlap.

This closes the last 8.4 cell. Section 8.4 is now **24/24**, advancing the overall completion checkpoint to **Implementations 17/24 completed · Sub-implementations 164/195 completed**. The remaining work is concentrated in 8.5 persisted-state agreement, 8.10 broader real-stack/canonical-tree proof, 8.11–8.13 closeout/manual ledgers and the final 8.16 coherent release-identity/stop-ship proof.


### 8.91 Multi-domain actual-browser real-stack proof — runtime closed

The next coherent zero-cost batch extends the already proven production-built browser → real local API/Supabase path across five additional persistence domains without changing product code. The canonical synthetic fixture gains a dedicated `qa-savings` account so Savings can exercise a real current→savings transfer.

- Savings: create a personal goal, hard-reload it, create a real savings transfer with the canonical current/savings route, hard-reload and require both UI + API persistence.
- Loans: create a new installment obligation through the real editor, require API persistence, hard-reload and require the active loan row.
- Lending: create a receivable, hard-reload, record a partial repayment through the real contextual flow, hard-reload again and require the persisted repayment/person state.
- Recurring: create a recurring obligation, hard-reload, pause it, hard-reload and require the paused row in inactive history.
- Settings accounts: create a temporary custom cash account, hard-reload, then delete through the real destructive confirmation, hard-reload and require absence from both API state and UI.

Real Stack E2E #31 (`37197482164`) is green on exact head `72e559008a7d2657e865aea7b83009e682c04432`; CI #3309 and CodeQL #3258 are green on the same head. The real browser completed every stage above with same-origin API read-back and hard reload. Artifact `11300514998` was downloaded and the five new persistence captures were opened individually: Savings shows the €20 transfer plus goal/progress, Loans shows `Real Browser Loan` with €120 balance / 3 remaining installments, Lending shows the €42 lend + €12 partial repayment / €30 receivable, Recurring shows the paused €19.90 obligation in inactive history, and Settings remains visually contained around the temporary-account lifecycle. The account create/delete assertions themselves are runtime DOM + `/api/data` proofs because the focused screenshot does not place the temporary row in the visible viewport. These are accepted supporting real-stack persistence checks for 8.5/8.10, but the broader 8.10 every-domain matrix is still open.

**Implementations 17/24 completed · Sub-implementations 164/195 completed**


### 8.92 Planning, Budgets and Rules actual-browser proof — runtime closed

Real Stack E2E #32 (`37202963311`) is green on exact head `569fc011e0b76596d844bff138279f053a5e6c00`; CI #3310 and CodeQL #3259 are green on the same head.

- Planning: the real browser created `Real Browser Scheduled`, hard-reloaded the pending item, completed it into a €30 actual event, hard-reloaded again and required the completed scheduled history + persisted event state.
- Budgets: the real Reports UI created an October overall budget of €777, required real `/api/data` persistence, hard-reloaded and required the budget row in the UI.
- Rules: the real Settings UI created `Real Browser Rule`, hard-reloaded it, created a matching Quick Entry transaction and required the server-persisted category to be `Rule Applied`, then hard-reloaded the transaction row.
- Artifact `11303338775` was downloaded and `planning-domain-persisted.png`, `budget-domain-persisted.png` and `rule-domain-persisted.png` were opened individually. All three are readable and contained with no material clipping/overlap.
- The job log ends with the actual-browser hard-reload PASS plus the real-stack import/mutable-persistence/revision-conflict/history/backup direct-DB PASS.

These are accepted supporting real-stack persistence checks for 8.5/8.10. The every-domain mutation matrix remains open, so counters do not advance yet.

**Implementations 17/24 completed · Sub-implementations 164/195 completed**

### 8.93 Cards, Taxonomy and icon-preference actual-browser source — runtime closed

The next zero-cost batch extends the same production-built browser path without production data, hosted branches or provider migrations:

- Cards: create a synthetic debit card, persist real encrypted card details through the local card-vault API, hard-reload, archive, hard-reload, restore, hard-reload, then permanently delete and hard-reload absence.
- Taxonomy: create two expense categories, create and move a subcategory between stable identities, retire the now dependency-free source category, and require the transformed tree after hard reload.
- Icons: assign a Phosphor icon to the surviving synthetic category, require the persisted `settings.categoryIcons` value and hard-reload the rendered assignment.
- Focused screenshots are emitted for restored-card, taxonomy and icon-preference persisted states. Source regression coverage locks these stages and the no-fetch-interception real-app boundary.

Runtime proof is closed by Real Stack E2E #37 on exact implementation head `80a873d9dd66d841cc8b50e662a9e175090a61d9`, with CI #3318 and CodeQL #3267 green and artifact `11304847206` directly inspected. Cards receives reusable real-stack lifecycle credit; Taxonomy and Icons keep only their still-unproven blocker/manual/control-state obligations. The broad 8.5/8.10 every-domain cells remain open.

**Implementations 17/24 completed · Sub-implementations 164/196 completed**

### 8.94 Real Stack #34 taxonomy harness parse failure — FV-75 source-fixed, runtime proof pending

Real Stack E2E #34 on the post-merge-visual-plan head failed before any browser/product assertion because esbuild could not parse the new taxonomy helper: a quoted `querySelector` attribute selector accidentally terminated the surrounding TypeScript string at the `CSS.escape(id)` interpolation. CI and CodeQL on the same head were green, so this is classified as a QA harness syntax defect rather than a product/UI/backend failure.

FV-75 was recorded before remediation. The harness now locates the taxonomy card by iterating the already-scoped card nodes and comparing the stable `data-category-id` attribute directly, avoiding nested selector-string interpolation. The narrow source regression requires the parse-safe attribute comparison and rejects reintroduction of `CSS.escape(id)` in this browser harness.

Status: **closed.** The parse-safe taxonomy selector is exercised successfully by Real Stack E2E #37; no product behavior, finance semantics, persistence schema, Supabase policy, visual styling or Android code changed. Counters remain **Implementations 17/24 completed · Sub-implementations 164/196 completed**.


### 8.95 Real Stack #35 Cards archive selector mismatch — FV-76 source-fixed, runtime proof pending

Real Stack E2E #35 on exact head `89f203630ca13f444814fe9f8b0ee8aca646ef0c` passed CI #3315 and CodeQL #3264, compiled the prior taxonomy fix, started the disposable local Supabase/API stack, completed Auth/TOTP/session/import/history/revision/Card Vault/device proof and every previously accepted browser stage through Rules, then stopped at the first new Cards archive action with `Missing aria control Αρχειοθέτηση κάρτας Real Browser Lifecycle Card`.

- Severity: QA-only blocker for the pending Cards/Taxonomy/Icons proof; no product/runtime/security/data regression was exercised.
- Root cause: the harness invented a nickname-qualified archive aria-label, while each `InteractivePaymentCard` correctly exposes the generic `aria-label="Αρχειοθέτηση κάρτας"`. Multiple active cards mean the control must be scoped through the visible card carrying `Real Browser Lifecycle Card`.
- Remediation: locate the intended visible card first, click that card's generic archive button, retain the existing keyboard-confirmation and hard-reload assertions, and lock the selector contract with a source regression that rejects the nonexistent qualified label.
- Scope: harness + regression only. No product UI, card semantics, vault behavior, Supabase schema/policies, visual styling, release behavior or Android code changes.

Status: **closed.** The scoped generic archive control, keyboard confirmation, archive/restore/delete persistence and hard-reload assertions pass in Real Stack E2E #37. Counters remain **Implementations 17/24 completed · Sub-implementations 164/196 completed**.


### 8.96 Real Stack #36 runtime PASS; CI selector-source encoding normalization

Real Stack E2E #36 (`37205971347`) completed successfully on exact head `ff857e8c5f1a4238dc56059c2b030faaab75d045`. The disposable local Supabase/API stack, actual browser flow, Cards lifecycle, Taxonomy move/retire, persisted icon preference, all previously accepted real-browser stages and forward-only migration recovery passed. This establishes that the scoped Cards archive interaction is runtime-correct.

CI #3317 on the same head failed only in the narrow source-contract regression because the raw TypeScript browser-eval selector was written with three literal backslashes around the attribute quotes instead of the repository-standard single escaped quote. CodeQL #3266 is green. The mismatch is QA source encoding only; no product/runtime/API/database/security behavior failed.

Remediation: normalize only the raw selector representation in `scripts/real-stack-browser-e2e.ts` to `button[aria-label=\"Αρχειοθέτηση κάρτας\"]`. The existing regression remained unchanged and passed in CI #3318; Real Stack E2E #37 and CodeQL #3267 are green on the same implementation head, and the three focused screenshots were directly inspected.

**Implementations 17/24 completed · Sub-implementations 164/196 completed**


### 8.97 Real Stack #37 Cards/Taxonomy/Icons exact-head closure

Real Stack E2E #37 (`37206514550`) completed successfully on exact implementation head `80a873d9dd66d841cc8b50e662a9e175090a61d9`; CI #3318 and CodeQL #3267 are green on the same head. The real browser passed the complete Auth/TOTP/session/import/history/revision/Card Vault/device sequence plus modern/legacy transactions, Credit, Savings, Loans, Lending, Recurring, Planning, Budgets, Rules, Cards, Taxonomy, Icons, Accounts and Data Management across hard reload. Forward-only migration recovery also passed.

Artifact `11304847206` was downloaded and the new focused evidence was opened individually:
- `cards-lifecycle-persisted.png`: `Real Browser Lifecycle Card` is restored after hard reload with the secure-details suffix visible; the subsequent runtime path archives it again, permanently deletes it and proves absence after reload. The focused capture is readable and contained; the horizontally scrollable card rail is visible by design and no material clipping/overlap is present.
- `taxonomy-domain-persisted.png`: `Real Browser Target` contains `Real Browser Sub` after moving the subcategory and retiring the source category, with the transformed tree still present after hard reload. The layout is readable and contained.
- `icon-preference-persisted.png`: Phosphor remains the active family and `Real Browser Target` retains its custom Phosphor assignment after hard reload. The layout is readable and contained.

Traceability disposition: Cards moves from Partial to Reusable for its real-stack lifecycle gap. Taxonomy remains Partial because blocker/manual destructive states are still outstanding beyond the proven create/move/retire persistence path. Icons/preferences remains Partial because every control state and 200% zoom are still outstanding beyond the proven persisted assignment. Sections 8.5 and 8.10 therefore remain **8/9** and **2/8** respectively; no broad every-domain cell is inferred from this batch.

Next zero-cost real-stack target: real provider creation + Supabase Storage asset upload + binding/reuse + hard reload/read-back, plus an isolated provider upload/registration failure-cleanup case against the disposable local backend only. No production data, paid hosted branch, provider production mutation or Android implementation is included.

**Implementations 17/24 completed · Sub-implementations 164/196 completed**

### 8.98 Provider Storage actual-browser + cleanup proof — source implemented, runtime pending

The next zero-cost real-stack batch uses only the disposable local Supabase/API stack and synthetic provider identity `real-browser-provider`.

- Actual browser: Settings → Accounts creates `Real Browser Provider`, uploads one safe SVG through the real provider binary API into Supabase Storage, reuses that single asset for both required universal logo and wordmark slots, saves through the real provider/binding RPCs, hard-reloads, requires API read-back of one asset + two bindings, reopens the branding editor and captures the persisted one-asset/two-slot state.
- Direct backend read-back after the browser flow requires the provider row, active asset metadata, both universal bindings, exactly one Storage object and clean database health.
- Failure cleanup: a real binary upload is sent for a deliberately nonexistent synthetic provider. Storage accepts the owner+AAL2 provider-scoped path, the registration RPC then rejects `INVALID_PROVIDER_ID`, the API returns controlled `INVALID_PROVIDER_DATA`, and the harness requires the temporary Storage object to be deleted with no metadata residue.
- This path uses no fetch interception, production provider mutation, production finance data, hosted Supabase branch, paid service or Android code.
- Focused evidence: `provider-storage-persisted.png`.

Status: **source implemented; exact-head CI/CodeQL/Real Stack runtime proof pending.** Do not credit the Providers/assets traceability row or the broad 8.5/8.10 cells until the exact-head real-stack run passes and the screenshot/log/storage evidence is directly inspected.

**Implementations 17/24 completed · Sub-implementations 164/197 completed**

### 8.99 Real Stack #41 provider catalog loopback URL filtering — FV-77 source-fixed, runtime proof pending

Real Stack E2E #41 on exact head `7669f7f504d4852dc837a8a8d1fe52c53368ce18` passed CI #3322 and CodeQL #3271. The real registration-failure cleanup stage completed, and the actual browser successfully created the synthetic provider, uploaded one SVG through the real Storage path, reused it for the required logo/wordmark bindings and passed direct `/api/account-metadata?resource=financial-providers` read-back before reload. The first runtime failure occurred only after hard reload: `Timed out waiting for provider after hard reload`.

- Root cause: `financialProviderClient.parseProvider()` accepted only `https://` provider asset URLs. The disposable local Supabase stack correctly exposes Storage as `http://127.0.0.1:<port>`, so the client discarded the otherwise valid provider record when rebuilding the catalog after reload.
- Classification: shared client validation defect limited to local/integration environments; production HTTPS provider assets remain valid. The fix must not permit arbitrary insecure HTTP.
- Remediation: centralize provider-asset URL validation so HTTPS remains universally accepted while HTTP is allowed only for exact loopback hosts (`127.0.0.1`, `localhost`, `[::1]`). Apply the helper consistently to asset, logo and wordmark URLs.
- Regression: direct unit coverage requires production HTTPS and loopback HTTP acceptance while rejecting ordinary HTTP, `javascript:` and malformed URLs.
- Scope: provider client parser + regression only. No finance semantics, provider persistence schema, Supabase policies, production provider data, Storage write rules, Android code or release behavior changed.

Status: **source-fixed; exact-head CI/CodeQL/Real Stack proof pending.** Counters remain **Implementations 17/24 completed · Sub-implementations 164/197 completed**.
