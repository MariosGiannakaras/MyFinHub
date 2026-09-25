# Stage 5 Batch 10 — Bulk named root CSS owners

## Verified base

- `develop@87f7e329c2bee5031e6250530f5bf273e135d2c1`
- Batch-9 post-merge integration: CI `36115788288` ✅, CodeQL `36115788300` ✅, Windows Desktop `36115788226` ✅.

## Scope

This batch deliberately groups 27 coherent root compatibility owners into one ownership-only delivery so the repository does not spend a full CI cycle on each small rename. Every CSS move reuses the exact existing blob and stays in the exact existing root import slot.

| Slot | Existing file | Named owner | Exact blob |
| ---: | --- | --- | --- |
| 6 | `part6.css` | `authentication-surfaces.css` | `2870f1b07ac2e6943226891610bec002369787ca` |
| 7 | `part7.css` | `mobile-overflow-navigation.css` | `77e6396fccdb62b290a242d374ef5264a399d033` |
| 8 | `part8.css` | `frontend-audit-hardening.css` | `b936ef2a64c69e28b3208ba4d24a3999372c9fd2` |
| 10 | `part10.css` | `semantic-color-contrast.css` | `17d1efd94ded1cfee75fa8579b0d6ca952e84f1d` |
| 12 | `part12.css` | `reporting-period-technical-settings.css` | `68fbf8a8e2a35c7022579667a177b687efe91cc6` |
| 14 | `part14.css` | `savings-workflows.css` | `c44720603c2c9f16a7fc59703d9ec3b939a1a528` |
| 15 | `part15.css` | `recurring-operations-workspace.css` | `1bd4bdae713e29d2bb28e7fa4973023b0d8222ee` |
| 17 | `part17.css` | `interaction-state-motion.css` | `bb565843ce58a1a0911075eeab63b48a811f5810` |
| 18 | `part18.css` | `payment-cards-workspace.css` | `60fe475a57c1da984f8cc168dbed2d626c87c2c8` |
| 19 | `part19.css` | `finance-icons-account-brands.css` | `4db02157dff1ffa5df4c4182d937485e39f72cfe` |
| 20 | `part20.css` | `mobile-finance-presentations.css` | `0bb89dd4ee7e2e3781a17e5da20ebbd254ae9f23` |
| 21 | `part21.css` | `mobile-app-shell-redesign.css` | `0892a65bf9d174d9093c3e88d5c5216cd8f0bb77` |
| 22 | `part22.css` | `mobile-finance-domain-workspaces.css` | `264f35a2e1a0b449c409c62d16ac7857bb5553a6` |
| 23 | `part23.css` | `mobile-reports-settings-editors.css` | `61893aac83bccc92624f1bc9165161579cac4c44` |
| 24 | `part24.css` | `credit-loans-workspaces.css` | `28e1e370bef995458aa218defb4bdd326d632388` |
| 25 | `part25.css` | `owned-entry-controls.css` | `001f3208097a55c0c96959d8657d4b34e21f7a99` |
| 26 | `part26.css` | `interactive-card-system.css` | `6c68e4c7818b908fdeee7bac12aa9c44cc16b0bc` |
| 27 | `part27.css` | `credit-card-status-security.css` | `b6391d5e791c7d8acd51cef71db1aa1c629a18d5` |
| 28 | `part28.css` | `desktop-update-panel.css` | `0fe0dd82b4361505fb7a1169c435bad98abb308e` |
| 29 | `part29.css` | `cards-v15-workspace.css` | `40584871f77a596efe59aa1a43cae1ec80d9abdc` |
| 30 | `part30.css` | `shared-ui-hardening-foundations.css` | `952e6419f30bb30147b0c7212d53d8193fffc267` |
| 34 | `part34.css` | `reports-dashboard-layout.css` | `cdcd2a1b0a11163c47ae3b5f9512e5068ea8caa1` |
| 37 | `part37.css` | `planning-workspace.css` | `ffbe772b8898ccf8e0ae8b32fa232d3bd9bdea85` |
| 38 | `part38.css` | `attention-workspace.css` | `f50ed8e7a91485070cca09ef931f9a2805c5c5b2` |
| 39 | `part39.css` | `budget-rules-workspace.css` | `e1c46e72c4eabeeab1843532ab519d7342cee9b9` |
| 40 | `part40.css` | `command-palette-quick-action.css` | `85879761b76fe98489f99f53faf4733f26bd6814` |
| 44 | `part44.css` | `receipt-inbox-workspace.css` | `f37d5ca83d82ce3e452d76a0e2eaaefeb94dd5eb` |

## Direct-reference updates included before the first push

The preflight search found and updates these stale-path risks in the same atomic commit, without changing their assertions:

- `tests/owned-controls-source.test.ts`: `part25.css -> owned-entry-controls.css`;
- `tests/shared-ui-adoption-source.test.ts`: `part30.css -> shared-ui-hardening-foundations.css`;
- `tests/time-aware-source.test.ts`: `part37.css -> planning-workspace.css`;
- `tests/release-readiness-source.test.ts`: `part40.css -> command-palette-quick-action.css`;
- `docs/ANALYTICS_HARDENING_PROPOSAL.md` and `docs/UI_UX_AUDIT_EVIDENCE.md`: `part34.css -> reports-dashboard-layout.css`;
- `tests/css-ownership-source.test.ts`: preserve the complete 47-entry root sequence and substitute all named slots semantically.

## Deliberate exclusions

The remaining numeric/root-workspace files are not bulk-renamed when their ownership is genuinely mixed or foundational. They require later splitting/re-layering rather than cosmetic naming: `part1.css`–`part5.css`, `part9.css`, `part11.css`, `part13.css`, `part16.css`, `part31.css`, `part33.css`, `part35.css`, `part41.css`, `part42.css`, `part43.css`, `part46.css`, `part47.css`, and `part53.css`.

## Invariants

- No CSS bytes change for any of the 27 renamed files.
- No root import slot or cascade order changes.
- No selector, declaration, specificity, media query, theme token or load-budget change.
- No behavioral assertion is removed or weakened.
- No finance/accounting, auth/MFA/RLS/security, persistence, API/database, Desktop/Windows or release behavior change.

## Validation economy

Create the branch directly at the single final implementation commit. Open the PR non-draft so there is no separate ready-for-review Performance run. Require one exact-head CI, CodeQL, Cross-engine, Performance and Windows Desktop cycle, inspect fresh representative desktop/mobile evidence across affected surfaces, then squash-merge only to `develop`. After merge, require exact-merge CI + CodeQL + Windows 3/3 before another write batch.
