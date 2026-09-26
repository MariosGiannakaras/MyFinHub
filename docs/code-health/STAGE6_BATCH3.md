# Stage 6 Batch 3 — Conservative unused-export baseline

## Verified base

- `develop@9903288525917907e2883bb89b1240ebb6be8fb7`
- Post-merge CI `36240315073` ✅
- CodeQL `36240315077` ✅
- Windows Desktop `36240315093` ✅
- Windows First Run `36240315082` ✅
- Windows Clean Launch `36240315114` ✅

## Goal

Measure repository-local unused export debt without deleting or suppressing anything before classification.

## Analyzer contract

`scripts/unused-exports-report.mjs`:

- uses the already-installed TypeScript parser for syntax-safe import/export discovery; no new dependency is added;
- treats `src/`, `server/`, and `api/` as candidate export owners;
- treats app/server/API/tests/scripts/desktop TypeScript plus `vite.config.ts` as possible consumers;
- resolves only relative repository-local module specifiers, including runtime `.js/.mjs/.cjs` specifiers that map back to TypeScript source;
- tracks named/default imports and re-exports;
- treats namespace imports, literal dynamic imports, `require()`, import types, and star/namespace re-exports as using the full target export surface, intentionally preferring false negatives over false positives;
- excludes `.d.ts` ambient declarations;
- exempts framework-owned API exports `default`, `config`, `runtime`, and `maxDuration` because file-based serverless entrypoints can consume them without a repository import edge;
- contains a deterministic built-in fixture covering named/default/type imports, namespace conservatism, and API entrypoint exemptions;
- reports findings only in this batch and always leaves enforcement unchanged.

## Guardrails

- No production export is removed in Batch 3.
- No formatter/autofix or package-lock churn.
- No weakening of the existing blocking unused-local/import or dependency-cycle gates.
- No finance/accounting, auth/MFA/RLS, persistence, route/API contract, database, Windows, release, deploy, migration, or production-data behavior change.
- A reported export is not considered dead merely because the analyzer lists it; each candidate must be classified against runtime/framework/source contracts before any later removal.

## Validation

Run one exact-head required CI cycle for the complete report-only baseline. Capture the exact `Unused-export baseline` output from the CI hygiene step, then classify high-confidence findings into a later bounded cleanup/enforcement checkpoint.


## First-head correction

The first PR head `c5fe13ea33d053d7d78ae320046eee7fe315cc40` reached the new export analyzer after the existing cycle and unused-symbol gates passed, but TypeScript 7 exposed the parser API through the package default export under Node 22's `createRequire` interop. The analyzer stopped before producing a baseline.

The follow-up normalizes the package namespace/default shape before accessing the parser. No analyzer scope, source code, package dependency, or existing hygiene gate changed.
