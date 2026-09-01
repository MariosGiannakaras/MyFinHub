# MyFinHub Phase-1 desktop redesign implementation rules

These rules are the durable operating contract for the resumable UI Implementation Engineer. Root `AGENTS.md`, repository security/finance invariants and the latest explicit owner instruction remain higher-priority where applicable.

## Protected exclusion

GitHub issue #266 is completely outside this workflow. Do not open, inspect, quote, summarize, comment on, modify, relabel, close, reopen or use it for redesign tracking. Use checked-in repository instructions instead.

## Recovery before implementation

Before changing a redesign surface, recover the authoritative GitHub state: applicable `AGENTS.md`, current `develop` head, redesign status/docs, active issue, implementation branch, PR, recent commits, checks and persisted approved target. If work is already in progress, resume the existing branch/PR from its latest pushed checkpoint. Do not create duplicate issues, branches or PRs and do not restart from `develop` unless repository state proves no implementation exists.

Keep meaningful work recoverable. Commit and push coherent milestones, maintain a continuation checkpoint in the active PR, and do not leave substantial completed work only in an ephemeral runtime.

## Approved target contract

The exact owner-approved image controls the intended desktop presentation: hierarchy, section order, geometry, relative proportions, data density, table/list/chart composition, action placement, spacing, typography hierarchy, icon treatment, surfaces and status styling.

It is not a literal data fixture or branding template. Dynamic amounts, dates, account/category names and other real application values may differ. Existing MyFinHub branding and product identity remain authoritative unless the owner explicitly changes them.

Use representative deterministic QA data when the target demonstrates a dense supported state. Never hard-code screenshot values into production UI merely to reproduce the image.

## Functional parity and canonical finance logic

Visual fidelity is not sufficient. Preserve current routes, actions, forms, validation, loading/empty/error states, accessibility, keyboard behavior, responsive regression safety, persistence/auth/security boundaries and finance semantics.

Before completion, audit every visible interactive control. Its label/icon must truthfully describe the handler or route/state change it invokes, with required context such as account/category/date passed correctly.

For balances, flows, categories, statements, loans, recurring/scheduled lifecycle, savings and other finance concepts, reuse canonical repository domain functions/selectors where they exist. Do not recreate simplified accounting or analytics inside a page component to make reference values match.

A redesign must not silently change database schema, migrations, API/persistence contracts, authentication/security behavior or accounting semantics.

## New or reference-only UI elements

A reference may include a control or affordance whose backend/product capability does not yet exist. It may be represented in the UI when needed for the approved composition, but it must not be wired to an unrelated or misleading handler, must not claim unsupported analytical meaning, and must not silently introduce backend/schema/persistence behavior. A disabled/non-operative presentation is acceptable only when its state is clear to the user.

New finance/category icons must use the shared icon registry and persisted Settings preference system rather than page-specific hard-coded icon logic.

## Tests and CI discipline

Do not weaken or remove behavioral regression tests because markup/layout changed. Adapt selectors/DOM expectations while preserving the behavioral assertion.

Run the narrowest relevant source/unit/rendered checks before broader validation whenever tooling permits. Batch coherent fixes before pushing so CI is used as a verification gate rather than a trial-and-error loop. Never use false-positive assertions simply to make CI green.

## Approved ↔ Actual loop

For each new or resumed surface: inspect the exact Approved target, inspect current implementation state, implement only the remaining work, render a fresh desktop Actual, compare region-by-region, fix material differences, rerender and recheck. One visual pass is not sufficient by default.

Final verification requires both:

1. Approved ↔ Actual visual verification.
2. `develop` ↔ implementation functional-parity verification.

A surface is not complete while either has material failures.

## Delivery and completion

The active PR continuation checkpoint must keep this concise structure:

- Surface
- Approved target
- State
- Last completed
- Next action
- Validation
- Approved ↔ Actual

A surface reaches `VERIFIED` only after the exact target has been inspected, implementation and functional parity are complete, representative QA exists, a fresh final Actual has been visually inspected, relevant tests/checks pass, redesign docs/status are synchronized, changes are pushed, the PR is merged into `develop` when permitted, and the resulting `develop` state is verified.

Do not promote `develop` to `main`, release or deploy without separate explicit owner authorization.