# Stage 6 Batch 1 — Low-noise static hygiene baseline

## Verified base

- `develop@dcca883b8c267e0e77be48bcf7379bd979e2cd68`
- Stage-5 post-merge CI `36205978753` ✅, CodeQL `36205978766` ✅, Windows Desktop `36205978767` ✅.

## Scope

Add a dependency-free hygiene layer using the TypeScript compiler already present in the repository:

1. `scripts/dependency-cycles.mjs`
   - scans TypeScript modules in `src/`, `server/`, and `api/`;
   - follows relative static imports, re-exports and literal dynamic imports;
   - resolves source `.ts/.tsx` targets including runtime `.js` specifiers;
   - fails deterministically on dependency cycles.
2. `scripts/unused-imports-report.mjs`
   - uses the TypeScript compiler API with `noUnusedLocals`;
   - reports import-only TS6133/TS6192/TS6196 diagnostics across app, node/server/tests and API configs;
   - remains report-only for this first baseline so existing debt is measured before enforcement.
3. Package scripts:
   - `hygiene:cycles`
   - `hygiene:unused:report`
   - `hygiene`
4. CI runs `npm run hygiene` before the existing full `npm run check`.

## Guardrails

- No formatter, autofix, source reformat or mass cleanup.
- No new npm dependency or package-lock churn.
- Existing tests, build, security guard and audit severity remain unchanged.
- Unused findings are not suppressed or auto-removed in this batch.
- No finance/accounting, auth/MFA/RLS, persistence, API contract, release, deploy or production-data behavior change.

## Validation

Require the cycle check to be green and capture the exact unused-import baseline from CI. Only findings demonstrated to be low-noise should become blocking in the next Stage-6 checkpoint.
