# Stage 5 Batch 1 — explicit legacy CSS tail ownership

This bounded checkpoint records the first Stage-5 CSS ownership migration for issue #357.

## Verified base

- `develop@d0e267790612c625b352a484cb2d79e00d4e0e42`
- tree `3612f712e6f7f72ed25794a7290e75863459320e`
- Stage 4 is complete. Its Batch-4 post-merge integration barrier is green: CI `34784419600`, CodeQL `34784419544`, Windows Desktop `34784419514`.

## Problem

The Phase-1 late compatibility tail previously reached the application through unrelated domain components:

- `AccountIban` imported `part47.css`, `part50.css` and `part52.css`;
- `AccountMetadataSettings` imported `part47.css`;
- `BankBrandMark` imported `part53.css`.

`part47.css` is itself the transitive loader for `part48`, `part49`, `part50`, `part51`, `part54`, `part55`, `part56` and the approved Loans/Credit/Lending/Recurring/Planning/Attention target styles. These rules are global workspace compatibility presentation, not component-local ownership.

## Final Batch-1 ownership

The existing root/login CSS budget remains unchanged: `src/styles.css` still owns `part1.css` through `part46.css`, followed by `part57.css`.

The late compatibility tail now has one explicit workspace owner:

- `WorkspaceStyles` lazily imports `WorkspaceStyleLayer` behind the existing `PageSkeleton` fallback;
- `WorkspaceStyleLayer` imports `part47.css`, `part50.css`, `part52.css`, `part53.css` in the preserved order;
- the successful `PageErrorBoundary` path wraps its workspace children in `WorkspaceStyles`;
- `AccountIban`, `AccountMetadataSettings` and `BankBrandMark` no longer load global stylesheets as component side effects.

This keeps the late compatibility bundle out of the root/login CSS path while making workspace ownership explicit. The direct `part50.css` import is intentionally retained even though `part47.css` also reaches it transitively; removing that compatibility redundancy belongs to a later bounded Stage-5 batch after parity evidence.

No CSS declaration, selector, media query or approved-target stylesheet is edited in this batch.

## Guards

`tests/css-ownership-source.test.ts` verifies the root CSS budget, the lazy workspace owner, the preserved late-tail order, removal of domain-component stylesheet side effects, and the unchanged `part47.css` transitive approved-style chain.

The existing Loans and Quick Entry approved-target source guards were updated only to follow the same late styles through `WorkspaceStyles` / `WorkspaceStyleLayer`; their approved-style requirements remain intact.

## Validation checkpoint

- validated source head `b0c80826aca293187a4a12363959a21e3d89069b`, tree `2029c945b9fda887c05a02eded00e142dec6ca4e`;
- source-head CI `34811328535`, CodeQL `34811328637`, Cross-engine `34811328712`, Performance `34811328558`, Windows Desktop `34811328529` all passed;
- fresh rendered artifact `10335195734`, digest `sha256:fc211bff7a9fd23e3f77caeae249c38adee397910fadbcd8ea817775ed613293`;
- representative fresh evidence inspected for Loans desktop, Settings desktop, Recurring mobile and shared-control/mobile shell parity;
- Visual-QA bot commit `b88c61db345f925703fa11b08f356b70d6fca300` was verified to affect generated evidence only; fast-forward cleanup `3ab0b135022fc42fad3f4e87b7d47438db82e209` restored the exact validated source tree without force-pushing.

## Boundaries

No finance/accounting, auth/security, API, persistence, routing, database, Windows packaging, release, deploy or production-data behavior is changed. `main` remains untouched.
