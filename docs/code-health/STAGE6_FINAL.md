# Stage 6 Finalization — Consolidated hygiene enforcement

## Verified base

- `develop@f913a282dbca0935c8bfe98a921904382d8868cc`
- Post-merge CI `36244331980` ✅
- CodeQL `36244332108` ✅
- Windows Desktop `36244331955` ✅
- Windows First Run `36244331957` ✅
- Windows Clean Launch `36244331936` ✅

## Why this is one large batch

The owner explicitly prefers coherent work to be grouped before CI. This final Stage-6 batch therefore consumes the complete measured export baseline and the remaining hygiene items before opening a PR, so required Actions run once for the finished change rather than once per small cleanup.

## Export-debt closure

Batch 3 measured exactly 151 conservative findings across 181 candidate modules.

The finalization classification is exhaustive:

- **120 internal-only symbols:** keep the implementation but remove the unnecessary module export. This narrows module APIs without runtime behavior change.
- **24 confirmed dead findings:** remove 17 dead declarations from live modules plus 5 dead modules that contained the remaining 7 findings.
- **7 analyzer/runtime cases:** keep the exports and fix the analyzer boundary instead:
  - `server/index.ts::default` is the server runtime entrypoint;
  - five `src/lib/theme.ts` exports are consumed through the QA runtime's root-absolute dynamic import from an `.mjs` rendered-QA script;
  - `src/qaApprovedDashboardFixture.ts::qaFinanceData` is consumed through the `qa.html` import map that remaps `/src/qaFixture.ts`.

After those three classes, the expected conservative unused-export finding count is zero. The final analyzer also scans JavaScript/MJS/CJS consumers so rendered-QA runtime imports participate in the graph, while the HTML import-map-owned approved Dashboard fixture is explicitly framework-owned.

The first exact-head CI attempt exposed a second-order local cleanup in `src/lib/localCvvVault.ts`: removing the already-dead local CVV write API left `encryptLocalCvvValue`, `requestPersistentStorage`, and `IV_BYTES` unreachable. Those internal-only remnants are removed in the same Stage-6 finalization rather than starting another cleanup batch.

## Enforcement

`scripts/unused-exports.mjs` replaces the report-only command.

It remains dependency-free and conservative, but now also:
- strips query/hash suffixes before module resolution;
- resolves approved root-absolute repository module specifiers as well as relative specifiers;
- treats `server/index.ts` default as framework/runtime-owned;
- keeps the existing API framework export exemptions;
- includes fixtures for relative imports, namespace imports, query-suffixed imports, root-absolute dynamic imports, API entrypoints, and the server entrypoint;
- exits non-zero on any conservative unused-export finding.

Existing blocking cycle and TypeScript unused-local/import checks are unchanged.

## Formatting

`scripts/format-hygiene.mjs` adds deliberately low-noise formatting enforcement:
- source-code roots only;
- no formatter or autofix dependency;
- no mass reformat;
- blocks trailing whitespace in TypeScript/JavaScript/CSS source;
- carries a deterministic self-test.

## Dependency and audit review

No dependency upgrade is bundled into code hygiene.

Current policy remains:
- root CI: `npm audit --audit-level=high`;
- API CI: `npm audit --prefix api --audit-level=high`;
- Desktop: `desktop:check` begins with `npm audit --audit-level=high`;
- major dependency upgrades require explicit compatibility review per `AGENTS.md`.

This keeps severity gates intact and avoids mixing upgrade risk into a behavior-preserving cleanup.

## Guardrails

- No finance/accounting semantic changes.
- No auth/MFA/RLS/security-policy changes.
- No persistence, API contract, database or migration changes.
- No UI redesign or visual target change.
- No Windows packaging behavior change.
- No new npm dependency.
- No `main`, release, deploy, production migration or production-data action.

## Validation

Open the PR only after the complete batch is committed. Run one exact-head CI / CodeQL / Cross-engine / Performance / Windows cycle for the full finalization. If green, squash-merge only to `develop` and verify the exact merge before Stage 7.


## Exact-head analyzer correction

The second CI attempt passed dependency-cycle and TypeScript unused-symbol enforcement with zero findings, then surfaced seven export-analyzer findings. Six were runtime consumers outside the original TypeScript-only consumer scan (five theme exports via `scripts/theme-system-qa.mjs` plus the approved Dashboard fixture owned by the `qa.html` import map); the seventh, `formatCategoryTree`, became genuinely dead after removal of the obsolete `CategoryTreeEditor`. The analyzer now scans JS/MJS/CJS consumers, explicitly preserves the import-map-owned fixture, and the dead formatter helper is removed.
