# Stage 6 Batch 2 — Blocking unused-symbol enforcement

## Verified base

- `develop@5ab3ef121502aa4e2dff2f18038acf1d6f8adb7c`
- Post-merge CI `36235115168` ✅
- CodeQL `36235115151` ✅
- Windows Desktop `36235115048` ✅
- Windows First Run `36235115060` ✅
- Windows Clean Launch `36235115124` ✅

## Classification

Batch 1 measured three unique TypeScript `noUnusedLocals` findings:

1. `BookOpen` in `src/components/FinanceIcon.tsx`
   - unused icon import;
   - no registry key points to it;
   - safe import-only removal.
2. `currentAccountIds` in `src/lib/forecast.ts`
   - dead private helper;
   - the live forecast path already derives its account-id set directly from `allAccounts(data)`;
   - safe helper-only removal with no forecast semantic change.
3. `AppSelectInput` in `src/pages/CreditCardPage.tsx`
   - unused import retained only because `tests/shared-ui-source.test.ts` searched for the token;
   - the page's actual taxonomy selector is `CategorySelectInput`;
   - remove the sentinel import and make the source contract assert the real owned control instead.

## Scope

- Replace the report-only unused-symbol script with a blocking check.
- Keep the exact TypeScript configs from Batch 1: app, node/server/tests and API.
- Continue deduplicating TS6133 / TS6192 / TS6196 across configs.
- Fail closed on unexpected TypeScript diagnostics rather than hiding them behind the hygiene layer.
- Keep runtime dependency-cycle enforcement unchanged.
- Do not add dependencies, formatter/autofix behavior, finance logic changes, UI behavior changes, API/database changes, release/deploy work, or broad dead-export deletion.

## Validation strategy

Before one exact-head CI cycle:
- verify the three classified symbols are absent;
- verify the Credit-card shared-control test checks `AppDateInput` + `CategorySelectInput` and rejects a sentinel `AppSelectInput` import;
- verify package scripts no longer reference the report-only command;
- exercise the unused-symbol script parser against deterministic synthetic compiler output for zero findings, duplicate findings, and unexpected diagnostics;
- inspect the final diff/scope against `develop`.

Unused-export debt is intentionally left for the next bounded Stage-6 checkpoint because converting that class to blocking safely requires its own conservative baseline rather than speculative bulk deletion.
