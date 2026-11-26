# #666 — Greek receipt QR import

Issue: [#666](https://github.com/MariosGiannakaras/MyFinHub/issues/666). Integration: active Draft [#654](https://github.com/MariosGiannakaras/MyFinHub/pull/654), branch `fix/649-bulk-remediation`. Separate acceptance checklist; does not change #649's denominators. Owner requested the feature in the combined remediation batch.

## Implementation checklist

- [x] Strict fiscal-register QR parser and classification: exact AADE HTTPS prefix, bounded SIG grammar, date/time/positive integer cents, stable fiscal identifier, malformed/ambiguous/product/link distinction. Source: [AADE A.1135/2023](https://www.aade.gr/sites/default/files/2023-09/a_1135_2023.pdf), FEK B 5368, p.60487.
- [x] Same-origin image decoder, pinned zxing-wasm reader, lazy worker and local emitted WASM, bounded dimensions/time/result count and cancellation; no external CDN. Synthetic valid/conflicting/invalid/provider/EAN image fixtures and actual decoder unit tests written.
- [x] QR-first scan before local OCR, source evidence and explicit review, foreign-currency handling, duplicate warning and unchanged canonical finance handoff. OCR and manual fallback preserved; normalized evidence stays in the existing local receipt draft. No raw payload persistence or uploads.
- [x] Supported Web browser live camera flow, explicit activation, video-only permission and track/worker cleanup; same-origin camera policy with microphone still denied. Existing Electron media denial retained, local file/OCR fallback supported. No new native integration.
- [x] Initial parser, image, source-contract and real browser regression coverage prepared; actual QR-only/multi/link/malformed/product fixtures, QR/OCR disagreement, responsive review and pre-save no-write assertions added to receipt QA.
- [ ] Execute mandatory ordinary CI including clean npm install, typecheck/tests, lint, dependency/security and hard bundle budgets; inspect actual results. Dependency/lock entries are pinned from matching upstream metadata; local registry unavailable here.
- [ ] Run consolidated focused browser QA and inspect desktop/mobile/keyboard evidence; cover live camera permission denial/cancel and QR-specific duplicate and explicit save/cancel, including finance receipt protection, local draft durability and offline failure paths. Correct any defects; retain established acceptance gates.
- [ ] Reconcile acceptance with the issue, final review-head gates and designated integration PR. Issue stays open until evidence establishes completion.

## Provider URLs and safety

[AADE A.1112/2025](https://www.aade.gr/sites/default/files/2025-07/a_1112_2025.pdf) describes electronic-invoicing provider receipt QR references. No universal verified, authorized public retrieval API has been established. The feature identifies an external receipt link without opening it or transmitting it; local OCR/manual review remain the safe fallback. A QR is evidence, not authentication. Conflicting evidence requires explicit owner choice; canonical receipt save remains the only finance write boundary. No provider scraping, third-party network decoder, raw QR storage, automatic receipt booking or Android changes.

## Checkpoint

2026-11-27: parent `79891c0` CI #45912676309 passed hygiene and CodeQL; all 11 QR tests (including 5 actual WASM fixture decodes) passed. Six outdated source guards and stale desktop linked root manifest metadata failed, repaired together. Full build, rendered QA and real-stack acceptance remain pending; no completion claim.

2026-11-27: exact parent `5f2999a` CI #45912099725 failed solely at unused exports (two private parser type aliases); CodeQL, install, cycles and unused-symbol checks passed, tests/build not reached. Remove those exports, restore camera trigger focus on close, clarify duplicate-only messaging, and prepare browser media-denial/late-stream cleanup, duplicate guard, cancel/reopen and explicit QR save assertions in the existing suite. No rendered or functional PASS claimed; acceptance remains open. All opt-ins OFF until mandatory CI is clean.

Prepared in the 2026-11-27 combined shell/Savings/receipt batch based on `786b161`. Previous ordinary CI passed; the current candidate has only syntax preflight, not a claimed green build. Keep Draft and optional QA opt-ins off during implementation; on ordinary green use `run-649-shell-savings-receipt-batch-qa` and Real Stack together on the coherent head. Inspect evidence, repair the full set of failures and update this checklist before acceptance. No production or hosted financial operations.
