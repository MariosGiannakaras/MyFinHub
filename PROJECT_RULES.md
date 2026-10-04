# MyFinHub — instruction discovery and precedence

**Read before changing this repository.**

1. Read `AGENTS.md`. It is the canonical version-controlled repository execution contract for implementation behavior, Git/PR workflow, validation cadence, progress tracking, safety boundaries, and delivery discipline.
2. Read GitHub issue **#266 — `META: Durable MyFinHub owner/product decisions — NEVER CLOSE`** for durable owner/product decisions only; it is not a task tracker or permanent "base chat" role definition.
3. Inspect live open issues/PRs and CI to determine the active workstream. Remember: `main` is release/production, `develop` is routine integration, and an active task branch may contain newer task state.
4. Read the relevant task issue and the explicit current checkpoint in its branch-owned plan/status. For current counters and pending work, prefer that checkpoint over stale issue/PR summary text.
5. Read any owner-supplied canonical/reference artifact relevant to the task. Concept images define visual direction, not independent finance/behavior semantics.
6. Continue from current implementation state; do not restart completed work or wholesale-merge stale overlapping branches.

## Precedence

For repository work, apply instructions in this order:

1. explicit current-task owner instruction;
2. `AGENTS.md` for repository execution and technical safety rules;
3. durable owner/product decisions in issue #266;
4. task-specific issue/plan/status documentation.

More-specific safety constraints remain binding unless the owner explicitly supersedes them.

## Source-of-truth discipline

Do not duplicate the full standing instruction set in this file or in issue #266. Keep repository execution mechanics in `AGENTS.md`, durable owner/product decisions in #266, and changing implementation state in the relevant issue/PR/branch plan/`STATUS.md`. Production `main`, integration `develop`, task branches and design references are different evidence layers; never collapse them into one source of truth.
