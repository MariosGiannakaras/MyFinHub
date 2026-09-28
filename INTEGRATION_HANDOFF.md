# MyFinHub integration handoff

This file is the repository entrypoint for issue #429.

**Start here:** [docs/integration/START_HERE.md](docs/integration/START_HERE.md)

The current integration objective is to make `develop` the canonical application and prepare it for safe production promotion without relying on any prior chat memory.

Do not implement from conversation recollection. Recover context from the repository in this order:

1. `AGENTS.md`
2. `docs/integration/START_HERE.md`
3. `docs/integration/DECISIONS.md`
4. `docs/integration/PROGRESS.md`
5. `docs/integration/IMPLEMENTATION_PLAN.md`
6. `docs/integration/RELEASE_CHECKLIST.md`
7. GitHub issue #429 and the active PR/branch/check state

Any chat or agent that stops before completion must update `docs/integration/PROGRESS.md` before handing off.
