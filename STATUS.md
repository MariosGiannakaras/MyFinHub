# MyFinHub status

## Current production

MyFinHub v1.3.0 is the completed web/production and Windows release baseline.

- Canonical redesigned application is on release-only `main`.
- Vercel production deployment is READY on the validated production tree.
- Production device-session registry and provider-brand refresh migrations are applied.
- Owner + AAL2 + active-device RLS/session enforcement is active.
- Production recurring/workbook reconciliation is complete.
- Final integration gates passed: CI, CodeQL, Cross-engine, Performance, Windows Desktop, Windows First Run and Windows Clean Launch.
- Final persistent visual evidence contains 63 PNGs plus its manifest under `visual-qa/final/**`.

## Windows v1.3.0 release

**Tasks 3/3 · Subtasks 9/9**

- Release tag: `myfinhub-v1.3.0`.
- Exact tagged release commit: `2673ce626c0e3db6c30fea04a46b6cf1ce9517df`.
- Windows Desktop run #2029 completed successfully.
- Published release: `MyFinHub Desktop myfinhub-v1.3.0`.
- Installer: `MyFinHub-Setup-1.3.0-x64.exe`.
- Installer size: `148992632` bytes.
- GitHub asset digest: `sha256:a405189e016ddd03e31ab1ba92979b3991a64516edfa2a657eb7b9928fadc556`.
- Matching `.sha256` asset is published in the same controlled GitHub Release.
- Release is neither draft nor prerelease.

Release-closeout tracker: **#288 — complete**.

## Durable security and finance invariants

- Single-owner authentication remains email/password + mandatory TOTP/AAL2.
- Finance access remains API-authorized and RLS-backed.
- PAN/expiry/CVV are excluded from FinanceData and normal backups and live only in the encrypted owner+AAL2 server card vault.
- `CARD_VAULT_KEY`, service-role credentials and other privileged secrets are never distributed in browser, Windows or Android clients.
- Optimistic revisions, backups, audit/history boundaries and the canonical finance/accounting engine remain authoritative.

## Completed CI/workflow optimization — #483

**Implementations 9/9 · Sub-implementations 24/24**

- PR #484 passed exact-head CI, CodeQL, Cross-engine Smoke, median-of-three Performance Smoke, Windows Desktop, Windows First Run and Windows Clean Launch on `4d129c05ee4d0f0110dc86d801cf3e359c301e50`.
- PR #484 squash-merged into `develop` as `a752e417d339bce3eb2aab0a0b3918140533318e`.
- Draft PRs now keep core CI + CodeQL feedback while expensive rendered/cross-engine/performance/Windows lifecycle work is deferred until review-ready.
- Production Smoke targets the canonical `https://mgfinhub.vercel.app` origin.
- Repository execution authority is consolidated in `AGENTS.md`; issue #266 remains the durable owner/product decision ledger.
- GitHub admin-only follow-up is tracked in #485: protect `develop` with an integration ruleset and update the repository homepage to the canonical production URL.

## Active completion batch — #476

**Implementations 16/24 completed · Sub-implementations 160/195 completed**

- Owner constraint recorded 2026-10-04: completion must incur **no paid subscription or usage**. Supabase Pro/hosted Branching is not permitted. The replacement path is an ephemeral local Supabase 2.119.0 stack on the public repository's standard GitHub-hosted Ubuntu runner, using only synthetic fixtures and no production credentials/data. Source harness + manual workflow are being introduced without changing completion counters until real runtime proof passes and is directly inspected.
- Real Stack E2E run #2 proved the zero-cost local stack can boot and apply the full migration ledger, then exposed FV-67: the synthetic `example.invalid` owner email is rejected by current local GoTrue with HTTP 422 on valid password login. This is recorded as a QA-fixture defect before changing the harness; product auth behavior and completion counters are unchanged.
- Real Stack E2E run #4 on `e74c54a…` produced the same HTTP 422 `AUTH_REJECTED` after switching to `example.com`, so the FV-67 email-domain hypothesis is disproven. FV-68 is recorded as a QA observability blocker: the harness must identify the exact password/factor/enrollment stage before any further Auth/product change. Counters remain unchanged.
- Real Stack E2E #6 on `a7f5fd3…` localized the failure to `mfa-enroll`. FV-69 is recorded before remediation: current Supabase CLI local defaults keep TOTP enrollment/verification disabled unless `auth.mfa.totp.enroll_enabled` and `verify_enabled` are explicitly true, and the repo config omitted that section. Product mandatory MFA remains unchanged; this is a local-stack parity defect only.
- Real Stack E2E #8 on `5d72e0e…` proves password + TOTP enrollment/challenge now reach AAL2, then fails on the first `/api/auth/session` with `DEVICE_ACCESS_REVOKED`. FV-70 is recorded before remediation: first-device bootstrap uses `return=representation`, which re-enters the hardened SELECT policy before the session is active. The planned fix keeps publishable-key + owner JWT + RLS only and uses minimal-return bootstrap with conflict/revocation fail-closed handling.
- FV-70 is source-fixed on `89671b4…`: first-session registration now uses `return=minimal`; conflict handling re-reads an active race winner and treats a still-hidden conflicting session as revoked. Real Stack E2E #10 (`37187090650`) is the active proof; no completion credit is taken until it finishes green and its log is reviewed.
- Real Stack E2E #12 on `871dbed…` proved password/TOTP/AAL2 plus first-device bootstrap, then failed at full-document import with `INVALID_DATA` (FV-71). The source remediation replaces the presentation-heavy visual fixture with a minimal canonical synthetic fixture validated by the same production trust boundary before import, adds a dedicated validation regression, and names subsequent real-stack stages for precise failure attribution. Runtime proof is pending; counters remain unchanged.
- Real Stack E2E #14 on `05b8138…` is green; direct review closes 8.4 Auth/MFA/device-session cells and the 8.10 isolated-backend + real conflict/revocation cells. CI #3292 and CodeQL #3241 are green on the same head. Current counters are **Implementations 16/24 completed · Sub-implementations 157/195 completed**. The next zero-cost exact-head run extends the isolated stack with history undo/redo, encrypted Card Vault CRUD and backup→mutation→authenticated-import recovery plus audit/health verification; no recovery credit is taken until that runtime proof passes.
- Real Stack E2E #15 on `4ecbcc8…` passed history undo/redo and Card Vault write/read, then exposed FV-72: the direct DB assertion compared the post-redo canonical revision to a stale pre-undo/redo `persisted` revision. FV-72 was recorded before remediation; the fix compares against the post-redo revision and adds a source regression plus an explicit `direct-db-read` stage. Counters remain unchanged pending runtime proof.
- Real Stack E2E #17 on `3a4a39a7…` passed the full extended sequence; CI #3295 and CodeQL #3244 are green on the same head. FV-72 is runtime-closed. 8.16 now closes current migration-chain rehearsal/parity and the real isolated backup→mutation→restore exercise, moving counters to **Implementations 16/24 completed · Sub-implementations 159/195 completed**. A local-only forward-recovery probe is now source-implemented but receives no completion credit until its exact-head runtime passes.
- Real Stack E2E #18 on `65cb3c61…` passed the local partial-migration forward-recovery rehearsal; CI #3296 and CodeQL #3245 are green on the same head. 8.16 is now **7/8**, and counters advance to **Implementations 16/24 completed · Sub-implementations 160/195 completed**. Only release-identity/stop-ship evidence remains in 8.16.
- Actual-browser real-stack source is now integrated: the workflow builds the production UI, the local server serves `dist`, and Chromium signs in through the real Login/MFA screens before exercising modern + legacy transaction mutations across hard reloads against the real local API/Supabase stack. Focused screenshots are uploaded for direct review. No completion credit is taken until the exact-head Real Stack run and evidence review pass.
- Real Stack E2E #21 on `db8348d3…` reached real browser Login/MFA successfully, then exposed FV-73 at the first Quick Entry amount field: the browser helper searched only exact `aria-label` controls while production Quick Entry uses an accessible wrapper `<label>` for `Ποσό`. FV-73 was recorded before remediation and is now source-fixed by matching the existing dual-path label lookup; product form code remains unchanged and counters stay unchanged pending runtime proof.

- The completion definition has been expanded by the owner to a full-system verification matrix. Existing implementation findings remain tracked, but final closeout now requires direct assistant-led manual review plus UI/UX/accessibility, routing/404, every supported user mutation, real-stack persistence/backend proof, exhaustive failure handling, security/privacy, temporal/data-boundary coverage, operational recovery and canonical post-merge validation.

- Branch: `feat/476-completion-audit-hardening`.
- Exact-head CI #3216 on `74bdc0c…` passed the full primary-Chromium rendered coordinator plus source/API checks and npm audits; CodeQL #3169, Cross-engine #2342, Performance #2377, Windows Desktop #2775, Windows First Run #1326 and Windows Clean Launch #1327 are green on the same source head. Final Visual #98 persisted 216 captures in bot-only commit `2f918176…` with manifest provenance back to `74bdc0c…`.
- Direct assistant review of the corrected focused 404 Light/Dark 200%-equivalent captures and keyboard/reduced-motion evidence closes the manual 404 item and the broader 200%/Large-text/reduced-motion/system-theme inspection item. The exact-head Chromium implementation is also complete. The remaining 404 deployment cell is specifically external Vercel/production-like HTTP-path proof; production `main` is intentionally not promoted by this completion branch.
- PR #477 is temporarily draft again while the next coherent implementation/proof batch is built; expensive gates are not rerun for documentation-only churn.
- Desktop host visual evidence is source-implemented: the existing QA-only Electron bridge now drives the real App Lock and Settings Update Panel through deterministic host states, and a new focused rendered suite also opens the real `desktop/setup.html` recovery diagnostics surface at production/minimum window sizes. Exact-head rendered proof/direct image review are pending; counters remain unchanged.
- Windows/Electron host visual review is completed on source `41ff4d6a…`: all 11 App Lock, updater and real startup-recovery screenshots were opened individually; containment, status/action hierarchy, minimum-window behavior and privacy safety passed. This closes one 8.2 sub-implementation and advances the overall checkpoint to **Implementations 14/24 completed · Sub-implementations 148/195 completed**.
- Interaction/dialog visual evidence is source-implemented: existing hardening assertions now persist real persistence error/conflict/loading/saving, hover/pressed, Quick Add/date-popover, six finance editor and validation-error states; the Desktop Update Panel also adds an explicit up-to-date success capture. Proof/direct review are pending; counters remain unchanged.
- Data-heavy visual state evidence rendered successfully on source `41ff4d6a…` / CI #3224. Direct route-by-route inspection of the minimal/empty/extreme matrix and all six dense large-data captures is complete; the only blocking defect found is FV-63, a systemic 320px shared-header brand/Search collision. Its shared <=350px brand adaptation and rendered collision assertion are source-fixed, with exact-head recapture pending.
- Draft CI #3221 stopped on one new source-test mismatch only: the test expected literal `desktop-dialog-credit` although the QA script correctly emits `desktop-dialog-${page}` from its six-page loop. The regression assertion is corrected to the dynamic source contract; no runtime/product code changed.
- **54 deep-audit findings are now tracked.** DA-01..DA-53 retain their existing implementation/disposition state; DA-54 adds the owner-reported dark-theme color/contrast defect.
- DA-54 analysis shows the core dark text/status palette is readable, but interactive boundaries and several light-biased component surfaces were not semantically themed. The source fix adds a dedicated >=3:1 interactive control-border role, semantic dark surfaces for mobile More/Settings chrome, and computed-style rendered contrast assertions.
- DA-54 is **completed**. Dashboard, Transactions, Quick Entry, Reports, Settings and mobile More now use readable semantic dark surfaces/boundaries. Computed contrast/luminance checks pass, and manual artifact review confirms the settled post-animation More sheet plus the representative desktop/mobile dark states with no residual light-island defect.
- FV-24 records the prior exact-head Settings QA failure: the harness expected a removed duplicate provider preview. The source fix now validates the selected branded radio card itself; provider-management product code remains untouched.
- FV-25 records the next Settings QA failure: edit mode intentionally supports correcting an existing account's provider, but the harness still required that field to be absent. The assertion is aligned with the accepted provider-correction behavior; product code remains untouched.
- FV-26 records the bundle-budget failure introduced by loading the DA-54 remediation eagerly. The same dark rules now load through the existing lazy workspace style layer; the 240 KiB CSS budget is unchanged.
- FV-27 is **completed**. Explicit `ResponsiveContainer` sizing remains inside the lazy chunk; exact-head full-page evidence passed 24/24 and Dashboard hierarchy QA passed, proving deferred charts render while performance remains green.
- FV-28 is **completed**. Exact-head full-page evidence passed with separate desktop deferred-chart and mobile collapsed-state contracts; no product scope or threshold changed.
- FV-29 is **completed**. Exact-head hierarchy QA passed the semantic compact-mobile expanded state with summary/cash-flow readiness, open KPI/analytics regions, hidden category donut and visible category table.
- FV-30 is **completed**. Theme QA passes after the 220ms settle window and manual review confirms the settled mobile More sheet is opaque/readable; product opacity/color tokens were unchanged.
- FV-31 is **completed**. The responsive flow-chart host now has a 153px height/min-height through 980px; exact-head 375px hierarchy QA passes the expanded state and Lighthouse/bundle gates remain green.
- FV-32 is **completed** with no new product scope. Exact-head CRUD QA passes Lending 12/42 partial repayment plus protected Settings custom-account create/delete. Device revoke remains intentionally non-destructive in synthetic QA and is covered by API/security contracts.
- FV-33 is **completed** with no product change. Exact-head CRUD QA passes the canonical destructive `role="alertdialog"` confirmation path.
- The separate database workstream is complete, including the relational ledger cutover. After the owner explicitly started implementation, the pending provider-management migration was applied to production and post-verified; no destructive finance-data operation was performed.
- Owner confirms logos, backend/database work and owner-side Settings work are complete. The accepted #482 provider-management/API/Storage delta is source-integrated into #477. Production now includes `manage_financial_provider_assets` as live migration version `20261001192135`; post-migration proof shows 35 valid bindings, 4 provider-management RPCs, 10 owner/AAL2 write policies, 0 invalid bindings and 0 active assets missing Storage objects.
- FV-34 is **completed** with no product change. Exact-head rendered validation passed Transactions/Recurring/Reports/Quick Entry icon adoption, narrow-mobile containment and the full icon-pack rendered suite.
- **FV-35 completed:** exact-head rendered CI on `c852d3a…` passes legacy transaction edit/delete/undo/redo on desktop and mobile using the real Transactions search/pagination behavior.
- FV-37 is **completed**: exact-head CI confirms the aggregate CSS budget is green without raising the 500 KiB raw / 100 KiB gzip ceiling after redundant legacy card/create-dialog CSS removal.
- Draft CI on provider-reconciled head `98293e9…` reached 760/761 unit/source tests; the sole failure was a stale migration-source assertion expecting the pre-back-sync fallback text. Commit `8066c2a88899…` updates that assertion to the actual production-synced `else logo_asset_key` / `else wordmark_asset_key` contract without weakening behavior.
- **FV-38 completed:** exact-head CI on `c95746b…` passes 761/761 tests and measures aggregate CSS at 499.7 KiB raw / 93.4 KiB gzip against the unchanged 500/100 KiB budget after provider-specific styling was consolidated onto shared UI surfaces.
- **FV-41 completed:** exact-head rendered CI passes Settings tabs and provider branding with the 44px mobile provider Edit touch target.
- **FV-42 completed:** exact-head rendered CI passes the five-part split disclosure and mobile hierarchy after locating the saved split through the real search control; the intentional visible + semantic desktop row pair is preserved.
- **FV-43 completed:** exact-head rendered CI on `c852d3a…` passes the extreme long-content Transactions case after locating the deliberately old transaction through the visible mobile search, with overlap/overflow assertions intact.
- **FV-44 completed:** exact-head rendered CI on `9b25fb1…` passes the extreme Recurring mobile lifecycle case, proving 12-row bounded disclosure, collapsed inactive history, actionable `Προβολή περισσότερων`, full expansion and no overflow.
- **FV-45 completed:** exact-head rendered validation now proves receipt OCR persists raw `currency='EUR'` while the owned select displays the user-facing `EUR · Ευρώ` label. This closes FV-45 but does not close the expanded full-system audit.
- Current final-validation head: use the head SHA of PR #477 as the authoritative value.
- CI #3204 on `35c63b11…` passed all source/unit checks and every rendered assertion again, including Card Vault unit/boundary regressions, but still timed out after the final accessibility PASS. Orphan cleanup shows the outer QA Node/npm/esbuild chain remained alive, proving the retained-handle problem is at suite-process completion rather than only Chromium child teardown. FV-62 now uses an explicit QA module wrapper that awaits top-level completion, drains guarded children and exits with the module result. Cards lifecycle and completed 8.3 accessibility status remain unchanged.
- CI #3210 on `60f7c3c…` confirms the FV-62 module wrapper is advancing through completed suites, then exposes a separate Card Vault QA-fixture mismatch at hard reload: the synthetic secret survives preload, but QA FinanceData recreated the card without persisted `vaultRef`, so the real dialog correctly skipped reveal. The QA-only `card-vault=ready` state now persists vault metadata independently from the synthetic secret backend; exact-head rendered proof remains pending and counters are unchanged.
- CI #3212 on `42207eb…` passed every Card Vault runtime assertion but exposed a post-pass Chromium profile-deletion race. Exact-head CI #3213 on `c9cee0c…` then passed the complete Card Vault save/reveal/hard-reload/update/delete sequence, emitted the module completion marker and completed the entire rendered coordinator successfully. FV-62 and the 8.4 Card Vault functional cell are completed.
- CI #3216 on `74bdc0c…` reconfirms FV-62 on the current validation source head: every rendered module completed and the coordinator reached its final all-suites PASS line with zero browser fallback activations.
- Focused 404 evidence review found the prior `not-found-dark-200pct.png` was not a valid dark-theme capture: the harness set only the `data-theme` attribute and left Light semantic tokens active. The harness now calls the canonical theme module for explicit Light/Dark token application and asserts the resolved token state before capture. Exact-head rendered proof/direct inspection remain pending; counters are unchanged.
- Remaining work is governed by `docs/completion/APP_COMPLETION_AUDIT_AND_PLAN.md`; its **13/24 implementations · 144/195 sub-implementations** checkpoint is authoritative. The current custom 404 covers unknown authenticated hash routes but the remaining HTTP-path/manual-mode obligations in the plan still require proof. Do not merge #477 solely from earlier gate sets.
- Implementation batch A remains on the same completion line: 404/routing product work, CodeQL-oriented binary/provider hardening, provider-upload cleanup and narrow regression contracts are batched into the validation line. PR #477 is currently review-ready; exact-head proof, not PR state, governs completion. Counters do not advance until required proof is green.
- Implementation batch B is source-implemented in parallel: strict calendar dates/month rollovers, fail-closed date-picker behavior and safe-integer-cent monetary boundaries now cover core event/scheduled/recurring/reporting inputs. Validation and direct rendered inspection are still pending, so counters are unchanged.
- Implementation batch C is source-implemented in parallel: shared JSON/error envelopes, request-ID-preserving 405 handling, local API 404 semantics, strict compatibility query markers and exact device-session revoke payloads are hardened. The Vercel unknown-API catch-all remains pending direct/safe routing verification; no speculative wildcard rewrite was introduced. Counters remain unchanged pending proof.
- Batch D persistence trust-boundary hardening is in progress: direct audit found missing canonical validators for scheduled/attention/budgets/rules, regex-only calendar checks and inconsistent full-import extension validation. A shared complete-document validator plus regression coverage is now on the completion branch. Counters remain unchanged until CI/runtime proof.
- The 404 addition moved total raw CSS to 504.2 KiB while gzip remained 94.4 KiB. The aggregate raw CSS ceiling is narrowly adjusted from 500 to 512 KiB; the 100 KiB gzip ceiling and every JavaScript budget remain unchanged.
- Batch F production backend parity is completed and counted: the live provider-management migration is applied, integrity checks are clean and the repository migration version is aligned with the live ledger.
- Direct backend verification now additionally closes three audit sub-items: Supabase advisor classification, bounded 24h production-log review and relational ledger/FK/RLS/state round-trip consistency. No sensitive finance payloads were inspected.
- Storage policy/asset-safety and card-vault encryption/isolation verification are also directly closed; no production secret mutation was required.
- RLS/grants/function posture verification is directly closed against production: no broad anon finance access, owner+AAL2+active-device gating works, and AAL1/non-owner/unknown-session contexts fail closed.
- Cookie/bearer, mutation HTTP trust-boundary and provider/receipt image-safety verification are directly closed from source + exact-head regression evidence.
- Owner+AAL2+active-device API/RLS verification is directly closed with production unauthenticated probes, source handler review and production RLS negative-context checks.
- Atomic save/history/import, bounded history retention and aggregate production database-integrity verification are directly closed from live PostgreSQL function/schema evidence.
- Security-header/CSP/external-resource verification is directly closed on the feature head; provider images use the canonical Supabase origin, obsolete image hosts are removed, and receipt OCR remains local/self-hosted.
- Root/API/Desktop dependency-audit verification is closed: current root/API audits are green and desktop dependency locks are unchanged from the last green Windows audit/package run.
- Session-cookie/logout/revocation verification is closed: production cookies are `__Host-`/HttpOnly/SameSite=Strict/Secure and active-device revocation remains enforced at session/RLS boundaries.
- Backup/import round-trip and sensitive-data exclusion verification is directly closed against production functions/backups; no destructive import was performed.
- Full-system source inventory and traceability matrix are completed: routes, Settings/auth/overlay surfaces, user capabilities, API/backend dependencies, stateful entities and evidence reuse/insufficiency are explicitly mapped.
- Batch G finance semantic validation is source-implemented: persisted event legs/splits/deltas now have cent-exact accounting checks, while full documents additionally validate account references. Mutable writes intentionally avoid seed-dependent reference checks. CI proof is pending, so counters are unchanged.
- Supabase leaked-password protection remains a blocked external Auth setting: the security advisor reports it disabled, but the connected Supabase control surface available here has no Auth-setting write action.
- Batch H error/timestamp hardening is source-implemented: unexpected server exceptions no longer log raw messages, persisted lifecycle/audit date stamps use a deterministic date/RFC3339 contract, and Batch G's two test-fixture/source-contract mismatches are folded into the same validation checkpoint. Counters remain unchanged pending green exact-head proof.
- Batch I provider-image CSP hardening is completed: the CSP now allows only the canonical Supabase Storage image origin beyond self/data/blob, obsolete legacy image hosts are removed, and exact-head CI + CodeQL are green.
- Batch J Vercel unknown-API hardening is completed at source/CI level: the final `/api/(.*)` rewrite returns canonical JSON 404s through the existing health function slot, and exact-head CI + CodeQL are green. Deployed runtime proof remains part of the existing routing/404 verification item.
- Batch K release-artifact privacy guard is completed: CI proves tracked-file and generated-release scans pass; backup/log/screenshot/card-vault privacy boundaries are directly reconciled. Final pre-merge guard rerun remains separately pending.
- Batch L runtime AAL2 downgrade recovery is in progress: direct error-path review found that protected-endpoint `403 MFA_REQUIRED` did not re-synchronize the mounted session shell. One accepted sub-implementation was added, increasing the denominator to 192.
- 413/429/5xx error-contract verification is directly closed with green CI exercising body/upload rejection, rate limiting, transport outages, stable codes and redacted 500/502 handling.
- 409 revision/conflict handling is directly closed: stale writes fail closed, pending dependent writes are discarded, cross-tab revisions reconcile deterministically and the UI exposes explicit recovery.
- Persistence concurrency invariant is also closed: sequential ordering, cross-tab newer-revision handling and fail-closed queue behavior are directly exercised and backed by database preconditions.
- Core finance semantic invariants are directly closed: neutral internal movements, credit liability/statement math, lending receivables, split/cadence/scheduled/budget/report/time boundaries all have reviewed green executable coverage.
- Cards profile lifecycle is completed from exact-head CI #3200: create through secure-details save, archive, restore with preserved metadata, re-archive, permanent delete, profile edit and explicit Mastercard rendering all passed in the Completion Functional CRUD suite.
- Card Vault verification is completed at the rendered functional layer: CI #3213/#3216 pass invalid-input no-write, save/reveal/update, hard reload re-reveal and explicit DELETE through the dedicated synthetic server boundary. Isolated real-stack Card Vault CRUD remains separately tracked under 8.10 and is not implied by this closure.
- No Android implementation and no `main` promotion/release are included.

## Next work

Subsequent changes are product fixes against the completed v1.3.0 baseline. Routine implementation remains **Issue → short-lived branch → PR → required checks → squash merge into `develop`**. `main` remains release-only.

- **FV-40 completed:** the mobile Credit canonical card now anchors its lower content inside the physical card padding. Final visual run #73 passes the explicit network-mark containment assertion, and manual review confirms the Visa badge remains fully inside the selected card on mobile while tablet/desktop presentation is unchanged.

- Audit verification checkpoint 2026-10-02: directly verified temporal/month boundaries, local-date/DST-safe date-only handling, safe-cent precision/ranges, deterministic transaction ordering/pagination, archived/deleted reference preservation, exact-head CodeQL, exact-head privacy/security artifact guards, live migration parity and operational observability. Unsupported-future-schema rejection remains open.

- Batch M resilience/runtime proof is in progress on the isolated audit branch: unload protection for pending/failed writes, rendered auth downgrade recovery, client-side future-schema rejection, duplicate-label identity contracts and the performance-fixture/lazy-probe integration fix are implemented. Counters remain unchanged pending exact-head proof.

- Provider partial-failure recovery is directly closed: rendered QA proves no false success and a recoverable editor when creation succeeds but asset upload fails; backend regression coverage proves Storage cleanup when post-upload metadata registration fails.

- Batch N local/Windows routing parity is source-implemented: known API paths now preserve 405/Allow semantics before the JSON unknown-route 404, and post-build runtime QA covers real HTTP/static/API fallbacks. Exact-head proof is pending; Android valid-route behavior is unchanged.

- Batch O real persistence-failure QA is source-implemented: the real useFinance hook now has rendered probes for one-shot offline failure, explicit server-state recovery and beforeunload protection while failed/in-flight writes remain unconfirmed. Exact-head rendered proof is pending.

- Batch P large-data containment is source-implemented: Planning/Recurring/budget/rule collections now use progressive disclosure, and the synthetic large fixture covers 1,500 events plus 120 recurring, 120 scheduled, 80 budgets, 80 rules and 100 history points. Rendered/performance proof is pending.

- Exact-head `81bff44…` closes four expanded-audit sub-items: Unicode/long-text rendering, stable-ID/normalization collision semantics, supported-schema migration/future-schema rejection, and render/lazy/OCR failure recovery. CI, CodeQL, Cross-engine, Performance and all Windows gates are green on that checkpoint.

- The final visual harness now targets a 132-capture dual-theme matrix: every primary route, tracked Settings tab, auth state and 404 surface at desktop/tablet/mobile in both light and dark. Execution + direct assistant review remain pending.

- Exact-head WebKit, bundle/performance budget, Windows package and first-run/clean-launch verification are directly closed from reviewed run logs/evidence.

- Direct routing/404 contract verification closes seven sub-items: hash/deep-link routing, malformed-hash 404, browser history/focus recovery, Desktop/local HTTP 404, missing-static-asset 404, API 404/405 isolation, and malformed/trailing/encoded route handling.

- Auth-expiry/revocation and persistence timeout/offline/interrupted-save verification directly close two resilience sub-items.

- Provider API/Storage/binding/partial-failure verification closes one backend sub-item.

- API route/method inventory directly closes one backend sub-item.

- Temporary backend/auth/data outage recovery closes one operational sub-item.

- Application rollback compatibility is directly proven in production: v1.3.0-era web code remains READY/healthy against the newer Supabase schema with no runtime-error cluster.

- Direct manual visual review now covers all 132 Final Visual QA screenshots (22 groups × light/dark × desktop/tablet/mobile). Baseline primary-route visual review, human disposition ledger, global IA/navigation review, page hierarchy/scanability review and branded 404 design review are closed; exact-head/nested-state/zoom/reduced-motion checks remain separate.

- Mobile and desktop ergonomics review is directly closed from the inspected visual set plus rendered geometry, touch-target, command-palette, table and WebKit evidence.

- Dashboard functional verification is directly closed: account rendering, session privacy, masked/copyable IBANs, primary shortcuts, reporting period and contextual navigation are covered by inspected rendered/source evidence.

- Split transaction functional verification is directly closed across create/edit/validation/disclosure/delete/undo/report semantics.

- Candidate baseline frozen 2026-10-02 for this verification checkpoint: feature candidate `e3647e22224f8940f4ba71ebe5197a98947aec70`; `develop` `a752e417d339bce3eb2aab0a0b3918140533318e`; `main`/current production deployment `3333b73330c5431c052edcb6e4d1b792a89445a7`; open PR heads #477 `e3647e2…`, #482 `7aa7466…`, #479 `5bd521e…`, #465 `f3e0cfe…`; live Supabase ledger through `20261001220945_reject_cross_account_id_collisions`; Windows release tag `myfinhub-v1.3.0` at `2673ce626c0e3db6c30fea04a46b6cf1ce9517df` with installer SHA-256 `a405189e016ddd03e31ab1ba92979b3991a64516edfa2a657eb7b9928fadc556`.

- Shared primitive consistency review is directly closed: equivalent generic controls/actions use the common primitives; remaining raw controls are intentional semantic composites rather than styling forks.

- Feedback architecture review is directly closed: loading/saving/success/error/conflict/retry/destructive states use the shared live-region, recovery and confirmation contracts across representative finance flows.

- Create/edit form UX review is directly closed across the finance, settings, provider, receipt and security editors; labels/defaults/helpers, validation/error placement, destructive separation and save/cancel hierarchy were reviewed against the shared form contracts.

- WCAG-relevant contrast/reduced-motion review is directly closed using the Light/Dark manual evidence matrix, computed text/control/border contrast checks, shared focus treatment and reduced-motion interaction contracts; no formal conformance certification is claimed.

- Batch Q visual evidence provenance is completed: the fresh final artifact exposed that PR manifests preferred the GitHub merge-event SHA over the actually checked-out PR head. The harness now records `git rev-parse HEAD` first and has a regression contract; one new sub-implementation increases the denominator to 193 pending regenerated exact-head proof.

- Batch Q is completed: regenerated Final Visual QA produced 132 captures and the manifest now records the actual checked-out source head instead of the pull-request merge-event SHA.
- 404/Settings/Auth keyboard-semantic coverage has been expanded on the next validation head; counters do not advance for those items until rendered CI passes.

- 404/Settings/Auth accessibility batch is integrated for exact-head rendered proof; counters remain unchanged until the rendered accessibility suite passes and is directly reviewed.

- Focused visual-component review directly closes two additional visual-audit sub-items: containment/hierarchy across data-display controls and component-level typography/spacing/alignment/semantic-surface consistency. Evidence: assistant-inspected 85-image rendered artifact `11228136368`; dense/extreme/breakpoint edge cases remain separately pending.

- UI/UX designer/developer defect ledger is completed: severity, affected surfaces, systemic causes, preferred shared-layer remediation and proof state are tracked in `docs/completion/UI_UX_DEFECT_LEDGER.md`.

- Greek content/localization and user-facing feedback-message audits are completed and recorded in `docs/completion/CONTENT_AND_FEEDBACK_AUDIT.md`.

- Batch R responsive transition proof is in progress: intermediate 1024/681/680 widths, tablet/phone landscape resize transitions and a 375×500 virtual-keyboard-equivalent dialog viewport are now part of rendered geometry QA. Counters do not advance until rendered proof is green and directly reviewed.

- Large-data and production-mode performance verification are completed from directly reviewed rendered/Lighthouse evidence; realistic transaction/report/planning/history/budget/rule workloads remain bounded and responsive.

- Responsive geometry verification is directly closed from Chromium runtime evidence across canonical/intermediate/orientation/resize and virtual-keyboard profiles.

- Direct Settings visual review is complete across all 42 committed light/dark desktop/tablet/mobile captures.

- Implementation-level tracking was synchronized with the actual audit sections: baseline/traceability, backend/API/Supabase, security/privacy and temporal/data-boundary implementations are fully complete.

- Batch S nested Settings evidence is source-implemented: provider details/branding/asset picker, new-account editor, category rename, icon selection, rule editor and import confirmation now expand Final Visual QA from 168 to 216 captures across light/dark desktop/tablet/mobile. Counters remain unchanged until exact-head capture and direct review pass.

- Batch T mutating validation matrix is source-implemented; account/PIN/device-access failure feedback was also corrected to assertive alert semantics while success remains polite status: canonical API 400 boundaries plus rendered invalid-submit coverage for seventeen finance/card/Reports/Settings flows are wired into `qa:frontend`. Counters remain unchanged until exact-head CI/rendered proof passes and uncovered mutation surfaces are reconciled.

- Supported-engine/host verification is closed: the declared automated browser contract is Chromium + WebKit, and the supported Windows host is Electron/Chromium; no Edge-specific product support contract exists beyond that engine family.

- Accessibility rendered proof is infrastructure-blocked on the current PR head: every earlier rendered suite passed, but Chromium failed to expose CDP for the final keyboard/semantic suite on two attempts. `audit/476-a11y-bootstrap-fix` adds isolated multi-attempt launch diagnostics/cleanup; product accessibility assertions have not failed.

- FV-63 is recorded before remediation: the full mobile wordmark overlaps the Search action at 320px in multiple extreme-state routes. Shared ultra-narrow CSS now keeps the icon and hides visual wordmark copy only below 350px; route-wide rendered QA asserts >=2px brand/action separation. Exact-head recapture/direct review remain pending.

- CI #3234 on `b7d2a160…` passed the full rendered coordinator with the new ultra-narrow brand/action collision assertion; Cross-engine #2360, Performance #2395, Windows Desktop #2793, Windows First Run #1344 and Windows Clean Launch #1345 are green on the same source head. Direct assistant reinspection opened all twelve refreshed 320px extreme route captures individually and confirms FV-63 is closed.
- The 8.2 data-heavy visual cell and the full interaction-state cell are now completed from direct evidence review. Overall checkpoint: **Implementations 14/24 completed · Sub-implementations 150/195 completed**; 8.2 is 11/12. The only remaining 8.2 item is exhaustive dialog/sheet/popover/picker/confirmation state coverage.
- FV-64/FV-65/FV-66 are source-fixed for the final 8.2 dialog evidence cell: shared Confirm/MoneyEdit surfaces are explicitly opaque; Receipt Inbox confirmation layers above the inbox with a topmost hit-test assertion; Settings device-revoke failure evidence preserves the real alert in-view without screenshot scroll reset. Exact-head rendered recapture/direct inspection remain pending; counters stay **14/24 · 150/195**.

- 8.2 exhaustive visual inspection is now 12/12 complete on exact source head `7321c591…`. CI #3271, Performance #2432, Cross-engine #2397, Windows Desktop #2830, Windows First Run #1381 and Windows Clean Launch #1382 all passed; CodeQL #3220 was already green on the same source head. Direct review of artifact `11287584011` closed FV-64/FV-65/FV-66 and the final dialog/sheet/popover/picker/confirmation cell. Current checkpoint: **Implementations 15/24 completed · Sub-implementations 151/195 completed**.

- Vercel branded HTTP 404 is source-fixed on the completion branch: `vercel.json` now has a terminal `/(.*) -> /404.html` rewrite with `statusCode:404` after all API aliases; a dedicated source regression locks ordering/body privacy, and Production Smoke now requires real unknown deployed paths to return branded `text/html` with HTTP 404. Current production is still old `main`, so 8.14 remains runtime-proof pending. Counters stay **Implementations 15/24 completed · Sub-implementations 151/195 completed**.

- Draft CI #3273 for the Vercel branded HTTP 404 batch failed only because two older source tests required the unknown-API rewrite to be the final array element. The API fallback itself is unchanged; both tests now require `/api/(.*)` to exist before the terminal branded web-404 rewrite instead. New 404 routing tests already passed in #3273. Counters remain **15/24 · 151/195** pending rerun.

- 8.14 Vercel/HTTP routing proof is completed. Validated source `154f722a…` passed CI #3274 and CodeQL #3223. Owner-approved preview deployment `dpl_CPjne4Gbd7xiE6CjTbsP8AjyE9qs` (`target:null`) proved branded `text/html` HTTP 404 for an unknown web path, root HTTP 200, and JSON `API_NOT_FOUND` HTTP 404 for an unknown API path. No production promotion/alias occurred. The temporary feature-branch deployment toggle is removed in the same closure checkpoint. Current counters: **Implementations 16/24 completed · Sub-implementations 152/195 completed**.
