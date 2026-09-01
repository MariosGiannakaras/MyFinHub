# MyFinHub desktop redesign workflow

## Roles

The Design Director produces owner-approved desktop targets. The Implementation Engineer implements an approved target, preserves functionality, performs visual and functional verification, and handles the routine issue/branch/PR/check/merge-to-`develop` lifecycle.

Both roles must treat issue #266 as a protected exclusion and must not open or use it.

## Resumable implementation state machine

At the start of every Implementation Engineer session, recover current GitHub state before deciding what to do.

- If a redesign issue/branch/PR or partial implementation exists, resume it from the latest pushed checkpoint.
- If code exists but validation/visual QA/docs/checks remain, continue from that stage rather than reimplementing.
- If required checks are green and completion gates pass but the PR is open, merge it into `develop` and verify `develop`.
- If the previous surface is fully verified and merged, do not reopen it or start another surface without a new approved target.
- If an approved target is persisted but implementation has not started, begin it automatically.
- If an unfinished implementation exists but its exact approved pixels cannot be recovered from repository state or the current conversation, request only the exact last approved image.

Do not create duplicate issues, branches or PRs for an active surface.

## Implementation loop

1. Inspect the exact Approved target and current implementation/functional contract.
2. Determine what is already complete and what remains.
3. Implement the remaining maintainable code delta.
4. Run narrow relevant tests/checks where tooling permits.
5. Render a fresh representative desktop Actual.
6. Compare Approved ↔ Actual region-by-region.
7. Correct material visual differences and rerender.
8. Audit functional parity, interactive handlers and canonical finance/data semantics.
9. Run required broader validation.
10. Synchronize redesign docs/status and the PR continuation checkpoint.
11. Push coherent checkpoints and complete PR/check/merge workflow.
12. Verify resulting `develop`.

Do not assume one visual pass is sufficient.

## Checkpoint discipline

Keep meaningful completed work pushed. The active PR must record: Surface, Approved target, State, Last completed, Next action, Validation and Approved ↔ Actual state. A future session must be able to resume entirely from GitHub.

Batch related fixes and run the narrowest available validations before CI. Do not use CI as repeated trial-and-error when source/unit/rendered checks can catch the problem first.

## Completion

A surface is complete only when Approved ↔ Actual and `develop` ↔ implementation functional parity both pass, representative final Actual evidence has been inspected, relevant checks are green, docs/status are synchronized, the PR is merged to `develop` when permitted and the resulting `develop` state is verified.

Do not release, deploy or promote `develop` to `main` without separate explicit owner authorization.