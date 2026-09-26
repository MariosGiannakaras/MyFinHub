# Stage 6 Batch 1 — Low-noise static hygiene baseline

## Verified base

- `develop@dcca883b8c267e0e77be48bcf7379bd979e2cd68`
- Stage-5 post-merge CI `36205978753` ✅, CodeQL `36205978766` ✅, Windows Desktop `36205978767` ✅.

## Scope

Add a dependency-free hygiene layer on top of the existing TypeScript toolchain:

1. `scripts/dependency-cycles.mjs`
   - scans TypeScript modules in `src/`, `server/`, and `api/`;
   - uses a conservative import/export statement parser with built-in sanity fixtures;
   - follows runtime-relevant relative imports, re-exports and literal dynamic imports;
   - resolves source `.ts/.tsx` targets including runtime `.js` specifiers;
   - excludes fully type-only import/export edges so type relationships cannot create false runtime cycles;
   - fails deterministically on runtime dependency cycles.
2. `scripts/unused-symbols-report.mjs`
   - runs the existing TypeScript compiler with `noUnusedLocals`;
   - reports TS6133/TS6192/TS6196 diagnostics across app, node/server/tests and API configs;
   - deduplicates the same source diagnostic emitted by multiple tsconfigs;
   - remains report-only for this first baseline so existing debt is measured before enforcement.
3. Package scripts:
   - `hygiene:cycles`
   - `hygiene:unused:report`
   - `hygiene`
4. CI runs `npm run hygiene` before the existing full `npm run check`.

## Baseline evidence

The first exact-head CI observed three unique existing unused-symbol findings: `BookOpen` in `FinanceIcon.tsx`, `currentAccountIds` in `forecast.ts`, and `AppSelectInput` in `CreditCardPage.tsx`. They stay report-only in Batch 1 because at least one is intentionally protected by an existing shared-control source contract.

## Guardrails

- No formatter, autofix, source reformat or mass cleanup.
- No production-source cleanup is required to satisfy the cycle checker; type-only edges are modeled correctly instead.
- No new npm dependency or package-lock churn.
- Existing tests, build, security guard and audit severity remain unchanged.
- Unused findings are not suppressed or auto-removed in this batch.
- No finance/accounting, auth/MFA/RLS, persistence, API contract, release, deploy or production-data behavior change.

## Validation

Require the runtime cycle check to be green and capture the exact deduplicated unused-symbol baseline from CI. Only findings demonstrated to be low-noise and not protected by behavior/source contracts should become blocking in the next Stage-6 checkpoint.


## Integration

PR #415 merged to `develop@5ab3ef121502aa4e2dff2f18038acf1d6f8adb7c`.

Post-merge exact-SHA integration gates are green:
- CI `36235115168`
- CodeQL `36235115151`
- Windows Desktop `36235115048`
- Windows First Run `36235115060`
- Windows Clean Launch `36235115124`

The measured baseline remained exactly three unique findings. Batch 2 owns their classification and the transition from report-only diagnostics to blocking enforcement.
