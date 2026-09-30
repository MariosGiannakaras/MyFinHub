# MyFinHub completion audit and implementation plan

Status: audit complete, implementation pending  
Tracker: #476  
Target branch: `feat/476-completion-audit-hardening`  
Integration target: `develop`  
Release target: none — `main` remains release-only

## 1. Audit scope and evidence

This plan is based on the actual current product/repository state, not on the older redesign specification.

Visual evidence inspected:

- the persistent v1.3.0 final archive: 63 PNGs covering 12 routed pages, 6 additional Settings states and 3 authentication states across desktop/tablet/mobile;
- the post-v1.3 app-wide design-system QA from #439 / CI artifact `11004599074`, containing 240 PNGs plus 29 QA manifests (269 artifacts total);
- full-page desktop/mobile captures for Dashboard, Transactions, Savings, Cards, Credit, Loans, Lending, Recurring, Planning, Attention, Reports and Settings;
- focused captures for account metadata, action center, AppShell, auth, branding, budgets, categories, command palette, owned controls, core flows, credit statements, icons, ledger semantics, obligations, payments, receipts/OCR, recovery states, taxonomy, theme/light/dark/tablet and transaction scanability.

Repository/source audit covered the routed pages, AppShell, Quick Entry/contextual payment flows, persistence/history, card vault, account metadata, device sessions and current regression suites.

Live Supabase audit covered:

- all public tables and columns;
- 29 applied canonical migrations;
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

## 4. Backend/API/database implementation plan

### 4.1 Active-device security migration

Add one additive migration that:

1. keeps device-session INSERT as the bootstrap exception: owner + AAL2 + JWT session id + not revoked;
2. changes device-session SELECT and UPDATE to require the current request session itself to be active;
3. changes `rheomiq_card_secrets` CRUD policies to require:
   - row owner = `auth.uid()`;
   - `rheomiq_is_owner_aal2()`, which includes active-device status;
4. changes `rheomiq_account_metadata` SELECT/INSERT/UPDATE the same way;
5. updates `rheomiq_upsert_account_metadata` to use the canonical active-device owner+AAL2 predicate;
6. preserves service-role behavior where explicitly required by existing functions;
7. does not alter finance data, card ciphertext, account metadata values or history.

Acceptance:
- a revoked AAL2 session cannot read/write finance state, card vault, account metadata or enumerate/revoke other sessions through direct Data API/RPC access;
- a fresh AAL2 session can still bootstrap its own device row;
- the current active session can list/revoke other devices;
- no unrevocation path is introduced.

### 4.2 RLS performance cleanup

- rewrite the INSERT policy JWT helper to a cached scalar subquery form accepted by the current Supabase advisor;
- rerun security/performance advisors after the migration;
- do not drop informational unused indexes in this batch.

### 4.3 API consistency

- ensure card-vault/account-metadata/device endpoints consistently translate revoked-device failures into the same user-facing session-expired/revoked handling already used by finance endpoints;
- keep same-origin mutation checks;
- keep bearer support only where native clients require it;
- do not expose service-role credentials to clients.

### 4.4 Auth configuration

External project configuration:
- enable leaked-password protection if available on the current Supabase plan;
- keep email/password + TOTP only;
- do not add social OAuth, magic links or phone auth.

### 4.5 PostgreSQL upgrade readiness

Before a future 17.11 infrastructure upgrade:
- rerun the official Supabase detection queries;
- current audit result: `pgcrypto` installed, no `ltree`, no `btree_gist`, no custom operators detected;
- MyFinHub does not use pgcrypto PGP functions for the card vault, so no re-encryption task is currently indicated.

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
