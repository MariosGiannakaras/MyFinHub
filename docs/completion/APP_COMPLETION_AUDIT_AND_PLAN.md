# MyFinHub completion audit and implementation plan

Status: expanded completion audit reopened; implementation in progress  
Tracker: #476  
Target branch: `feat/476-completion-audit-hardening`  
Integration target: `develop`  
Release target: none — `main` remains release-only

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

No product code, database schema or production data was changed during this audit.

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

### Temporary database freeze

**2026-09-30:** Supabase/database work is intentionally paused because the database is being modified in a separate chat. Until the user explicitly lifts this freeze, this branch must not query, mutate, migrate, reconcile, backfill or validate the live database. Repo/application work may continue. Any DB-related finding stays tracked as pending and must be reconciled later against the then-current live schema/data before final validation.

## 2B. Live deep-audit findings tracker

The following findings were discovered after the expanded audit was reopened. They are tracked here even when the implementation fix has already landed, so the repository preserves the defect history and the validation obligation.

| ID | Area | Finding | Severity | Status / required proof |
| --- | --- | --- | --- | --- |
| DA-01 | Financial-provider assets / Supabase | `rheomiq_financial_provider_assets` originally held canonical metadata/hashes while binary `content` was 0 bytes. The Storage bucket is empty and runtime rendering still uses bundled assets, not DB `content`. | P0 data-integrity / source-of-truth | **Partially recovered, still open.** Piraeus wordmark was exact-hash backfilled (7,989 bytes). Payzy and Viva were deliberately promoted to exact repository-canonical PNGs with binary/hash/MIME/dimensions updated atomically. Piraeus logo/alternate wordmark, Alpha and Revolut historical rows remain 0-byte pending original binaries or an explicit canonical-replacement decision. See `PROVIDER_ASSET_RECOVERY.md`. |
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
| DA-15 | Settings mobile fixed chrome | Source scan initially suggested a Quick Entry / sticky Save-bar overlap because legacy CSS still defined `.settings-draft-actions`. Full markup audit showed that class has no production component and Settings is auto-save. | Audit false positive / dead CSS | **Disproved and cleaned up.** Quick Entry remains available on Settings; orphan sticky-action CSS/selectors were removed. No product overlap fix is claimed for this item. |
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
Tracking rule for this batch: every new material defect found during the remaining deep audit must be added to this table (or a page-specific section below) before the batch is considered complete. A defect is not “closed” merely because source code changed; rendered/runtime proof remains required where noted.

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
1. finish the deep functional pass across remaining edit/save/delete/payment/settings flows;
2. run the current-branch rendered suite including card-vault, icon-family, OCR and geometry checks;
3. manually inspect fresh screenshots for every relevant page/state/viewport/theme, not just manifests;
4. fix every visual or functional defect found;
5. reconcile the branch with the current `develop`;
6. run the exact-final-head CI/CodeQL/Cross-engine/Performance/Windows wave only after the implementation/audit batch is complete;
7. squash-merge to `develop` only after the expanded audit and exact-head validation are green.

No `main` promotion/release is part of this work.
