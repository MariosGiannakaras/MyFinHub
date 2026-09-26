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

- uses a dependency-free conservative lexical analyzer aligned with the proven runtime-cycle parser; no parser/compiler API or new dependency is required;
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


## Analyzer implementation correction

The first two PR heads failed before baseline collection because the installed TypeScript 7 package does not expose the legacy JavaScript compiler parser API used by older compiler-API tooling. The existing CLI typecheck remains valid, but an in-process `createSourceFile` dependency is not available.

Batch 3 therefore keeps the original no-dependency constraint and switches the export baseline to a conservative lexical analyzer derived from the already-proven cycle-parser approach. Comments and string bodies are masked for export declaration discovery; import/re-export module strings remain available for relative-edge resolution. The analyzer intentionally prefers false negatives over false positives and remains report-only.


## Fixture hardening

The dependency-free analyzer's first self-test run rejected the initial line-only export boundary assumption: the synthetic fixture placed multiple export declarations on one physical line, while the parser recognized only the first declaration. Export discovery now also recognizes semicolon and closing-brace statement boundaries, preserving the conservative top-level bias while covering compact source formatting.
