# Stage 6 Batch 1 — Low-noise code-hygiene baseline

## Verified base

- `develop@dcca883b8c267e0e77be48bcf7379bd979e2cd68`
- Stage-5 final post-merge barrier: CI `36205978753` ✅, CodeQL `36205978766` ✅, Windows Desktop `36205978767` ✅.

## Scope

Establish a dependency-free hygiene baseline using the TypeScript toolchain already in the repository:

1. `tsconfig.hygiene.app.json` enables `noUnusedLocals` for application TypeScript/TSX.
2. `tsconfig.hygiene.node.json` enables the same low-noise diagnostic for server/API production TypeScript without pulling tests into the hygiene compile.
3. `scripts/code-hygiene.mjs` builds a conservative repository import graph with a dependency-free lexical module scanner and checks:
   - conservative definitely-unused named runtime value exports in referenced modules;
   - runtime dependency-cycle strongly connected components;
   - relative static imports/re-exports plus literal dynamic imports / CommonJS require;
   - type-only edges are excluded from runtime-cycle findings.
4. `scripts/run-code-hygiene.mjs` runs both compiler and graph checks even if one category fails, so the first validation cycle exposes the whole baseline instead of serial failures.
5. `docs/code-health/code-hygiene-baseline.json` is the only accepted-debt ledger. It starts empty; CI findings must be reviewed before any entry is added.
6. Root `npm run check` now includes `npm run hygiene` before tests/build.

## Noise controls

- No ESLint/Prettier/Knip or other new dependency is added in this batch. TypeScript 7.0 does not expose the legacy in-process compiler API, so the graph check intentionally does not depend on it.
- No formatter or mass source rewrite is introduced.
- `noUnusedParameters` stays disabled to avoid callback/interface churn.
- Type/interface exports, default exports, platform entrypoints and completely unreferenced modules are not classified as unused named runtime exports; whole-module dead-code cleanup remains a Stage-7 concern.
- Namespace/dynamic imports conservatively mark a module's named exports as used.
- Existing debt may be baselined only after review; new/stale baseline drift fails the check.

## Next validation

Use one CI cycle to inventory current unused-local/import diagnostics, unused exports, and runtime cycle groups. Fix low-risk real debt directly; baseline only intentional or nontrivial pre-existing debt. Then require the normal exact-head gates before merge.
