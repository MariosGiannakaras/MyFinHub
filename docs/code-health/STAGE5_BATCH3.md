# Stage 5 Batch 3 — Named root CSS compatibility owner

## Scope

This bounded batch names the existing root/login numeric CSS import sequence without changing its cascade or any CSS rule.

- `src/styles.css` imports one named `src/styles/root-compat.css` entrypoint.
- `root-compat.css` preserves the exact existing order: `part1.css` through `part46.css`, then `part57.css`.
- `workspace-compat.css`, `part47.css`, the late workspace chain, and runtime theme injection remain unchanged.
- No existing CSS declaration, selector, specificity, media query, theme token, route, finance/domain behavior, API, persistence, auth, Windows packaging, release or deployment behavior changes in this batch.

## Validation contract

`tests/css-ownership-source.test.ts` requires the root entrypoint to point only to `root-compat.css`, requires `root-compat.css` to retain the exact former root sequence, and retains the existing late-workspace/tail ownership assertions.

The batch must pass the repository-required CI, CodeQL, cross-engine, performance and Windows Desktop gates and fresh rendered visual evidence before merge to `develop`.
