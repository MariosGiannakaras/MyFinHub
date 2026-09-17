# Stage 5 Batch 4 — Named canonical app-control layer

## Scope

This bounded batch replaces the final coherent numeric root owner with a semantic filename while preserving the exact CSS bytes and cascade position.

- Rename `src/styles/part57.css` to `src/styles/app-controls.css` by reusing the exact existing blob.
- Keep the file as the final import in `src/styles/root-compat.css`, immediately after `part46.css`.
- Preserve the existing `.app-control`, compact-density, shared focus-visible, option-level and mobile control rules byte-for-byte.
- Update focused source guards only to follow the named owner.
- Leave mixed legacy files such as `part1.css` and `part30.css` numeric until a later bounded re-layering can give them accurate ownership boundaries.

## Out of scope

No selector, declaration, specificity, media query, token, import ordering, workspace-tail ownership, runtime theme styling, finance/domain behavior, auth, persistence, API, database, Windows packaging, release or deployment change is part of this batch.

## Validation contract

The root ownership guard must preserve `part1.css` through `part46.css` in the exact existing order and require `app-controls.css` in the former `part57.css` terminal position. Existing Loans and Quick Entry approved-target guards must continue to verify the same root/workspace boundaries. Required CI, CodeQL, cross-engine, performance and Windows Desktop gates plus fresh rendered visual evidence must pass before merge to `develop`.
