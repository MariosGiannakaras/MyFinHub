# Stage 5 Batch 10 — Bulk semantic root ownership

## Verified base

- `develop@87f7e329c2bee5031e6250530f5bf273e135d2c1`
- Batch-9 post-merge: CI `36115788288` ✅, CodeQL `36115788300` ✅, Windows Desktop `36115788226` ✅.

## Scope

This bulk batch deliberately replaces many small rename PRs with one coherent validation cycle. The following root stylesheets are renamed without changing their blob bytes or root-cascade positions:

- `part6.css -> auth-session-shell.css` — exact blob `2870f1b07ac2e6943226891610bec002369787ca`;
- `part7.css -> mobile-more-navigation.css` — exact blob `77e6396fccdb62b290a242d374ef5264a399d033`;
- `part8.css -> frontend-audit-remediation.css` — exact blob `b936ef2a64c69e28b3208ba4d24a3999372c9fd2`;
- `part10.css -> semantic-color-contrast.css` — exact blob `17d1efd94ded1cfee75fa8579b0d6ca952e84f1d`;
- `part11.css -> account-shell-privacy-states.css` — exact blob `45786bfe0c0ba7387a82c330970a6f8b8707dd55`;
- `part13.css -> taxonomy-filter-controls.css` — exact blob `ced68e73aae7fc4234e516cdf24c344f392c9e10`;
- `part14.css -> savings-workflow-history.css` — exact blob `c44720603c2c9f16a7fc59703d9ec3b939a1a528`;
- `part15.css -> recurring-operations-workspace.css` — exact blob `1bd4bdae713e29d2bb28e7fa4973023b0d8222ee`;
- `part17.css -> interaction-motion-states.css` — exact blob `bb565843ce58a1a0911075eeab63b48a811f5810`;
- `part18.css -> cards-bank-stack-base.css` — exact blob `60fe475a57c1da984f8cc168dbed2d626c87c2c8`;
- `part19.css -> finance-icons-account-marks.css` — exact blob `4db02157dff1ffa5df4c4182d937485e39f72cfe`;
- `part20.css -> mobile-finance-presentations.css` — exact blob `0bb89dd4ee7e2e3781a17e5da20ebbd254ae9f23`;
- `part21.css -> mobile-app-shell.css` — exact blob `0892a65bf9d174d9093c3e88d5c5216cd8f0bb77`;
- `part22.css -> mobile-finance-domain-layouts.css` — exact blob `264f35a2e1a0b449c409c62d16ac7857bb5553a6`;
- `part23.css -> mobile-reports-settings-editors.css` — exact blob `61893aac83bccc92624f1bc9165161579cac4c44`;
- `part24.css -> credit-loans-workspaces.css` — exact blob `28e1e370bef995458aa218defb4bdd326d632388`;
- `part25.css -> owned-entry-popovers.css` — exact blob `001f3208097a55c0c96959d8657d4b34e21f7a99`;
- `part28.css -> desktop-update-panel.css` — exact blob `0fe0dd82b4361505fb7a1169c435bad98abb308e`;
- `part30.css -> ui-hardening-foundations.css` — exact blob `952e6419f30bb30147b0c7212d53d8193fffc267`;
- `part31.css -> visual-polish-overrides.css` — exact blob `b161568b0ec759d88fa3a7596a970721f89ed5e2`;
- `part34.css -> reports-dashboard.css` — exact blob `cdcd2a1b0a11163c47ae3b5f9512e5068ea8caa1`;
- `part37.css -> planning-forecast-workspace.css` — exact blob `ffbe772b8898ccf8e0ae8b32fa232d3bd9bdea85`;
- `part38.css -> attention-contextual-actions.css` — exact blob `f50ed8e7a91485070cca09ef931f9a2805c5c5b2`;
- `part39.css -> budget-rule-settings.css` — exact blob `e1c46e72c4eabeeab1843532ab519d7342cee9b9`;
- `part40.css -> command-palette-contextual-entry.css` — exact blob `85879761b76fe98489f99f53faf4733f26bd6814`;
- `part44.css -> receipt-inbox.css` — exact blob `f37d5ca83d82ce3e452d76a0e2eaaefeb94dd5eb`;

## Source guards updated in the same atomic commit

- `tests/css-ownership-source.test.ts`: preserves the full 47-entry root sequence and substitutes semantic paths only at renamed slots.
- `tests/owned-controls-source.test.ts`: follows `owned-entry-popovers.css`.
- `tests/shared-ui-adoption-source.test.ts`: follows `ui-hardening-foundations.css`.
- `tests/time-aware-source.test.ts`: follows `planning-forecast-workspace.css`.
- `tests/release-readiness-source.test.ts`: follows `command-palette-contextual-entry.css`.

## Deliberate exclusions

Mixed owners are not given misleading whole-file names. This batch leaves `part5.css`, `part9.css`, `part12.css`, `part16.css`, `part27.css`, `part33.css`, `part35.css`, `part41.css`, `part42.css`, `part43.css`, `part46.css`, `part47.css`, and `part53.css` for later split/re-layering. Large base/card layers `part1.css`–`part4.css`, `part26.css`, and `part29.css` are also deferred for deliberate ownership work.

## Invariants

- No CSS declaration, selector, specificity, media query or theme-token change.
- No root import reorder and no root/login load-budget change.
- No test weakening.
- No finance/accounting, auth/MFA/RLS, persistence, route/API/database, Windows packaging, release, deploy or production-data change.

## Validation

Run one exact-head CI / CodeQL / Cross-engine / Performance / Windows set for the complete batch, then inspect representative fresh desktop/mobile evidence before merge. After squash merge to `develop`, require exact-merge CI + CodeQL + Windows 3/3.
