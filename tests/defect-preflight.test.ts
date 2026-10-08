import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildReport, globMatches, validateRegistry } from '../scripts/defect-preflight.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const registry=JSON.parse(readFileSync(path.join(root,'quality/defect-patterns.json'),'utf8'));
const cli=path.join(root,'scripts/defect-preflight.mjs');
const run=(...args:string[])=>spawnSync(process.execPath,[cli,...args],{cwd:root,encoding:'utf8'});

describe('curated defect intelligence and read-only preflight',()=>{
  it('accepts verified registry entries with real guards',()=>{
    expect(validateRegistry(registry,root)).toEqual([]);
    expect(registry.patterns.map((p:{id:string})=>p.id)).toEqual(['FP-001','FP-002','FP-003','FP-004']);
    const result=run('--check-registry');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('4 patterns');
  });

  it('rejects unverified evidence, duplicate IDs, and missing or unsafe guards',()=>{
    const duplicate=structuredClone(registry);
    duplicate.patterns[1].id=duplicate.patterns[0].id;
    expect(validateRegistry(duplicate,root).join(' ')).toContain('duplicates');

    const missing=structuredClone(registry);
    missing.patterns[0].guards=['tests/not-a-real-regression.test.ts'];
    expect(validateRegistry(missing,root).join(' ')).toContain('missing test guard');

    const invalid=structuredClone(registry);
    invalid.patterns[0].guards=['not-in-tests.js'];
    expect(validateRegistry(invalid,root).join(' ')).toContain('invalid test guard');

    const evidence=structuredClone(registry);
    evidence.patterns[0].evidence=['https://example.invalid/unsupported'];
    expect(validateRegistry(evidence,root).join(' ')).toContain('invalid evidence URL');
  });

  it('supports directory-aware globs and exact paths without matching unrelated files',()=>{
    expect(globMatches('.github/workflows/**','.github/workflows/ci.yml')).toBe(true);
    expect(globMatches('supabase/migrations/**','supabase/migrations/20260101_change.sql')).toBe(true);
    expect(globMatches('src/**/lending.ts','src/lib/lending.ts')).toBe(true);
    expect(globMatches('src/components/*.tsx','src/components/AppInputShell.tsx')).toBe(true);
    expect(globMatches('src/components/*.tsx','src/components/nested/AppInputShell.tsx')).toBe(false);
    expect(globMatches('src/components/*.tsx','src/pages/LendingPage.tsx')).toBe(false);
  });

  it('orders critical incidents first and deduplicates paths and focused tests',()=>{
    const report=buildReport(registry,['src/lib/lending.ts','server/deviceSessionRegistry.ts','src/lib/lending.ts','README.md']);
    expect(report.matches.map((p:{id:string})=>p.id)).toEqual(['FP-001','FP-002']);
    expect(report.changedFiles).toHaveLength(3);
    expect(report.suggestedCommands).toHaveLength(1);
    expect(report.suggestedCommands[0]).toContain('tests/device-access.test.ts');
    expect(report.suggestedCommands[0]).toContain('tests/lending-history.test.ts');
    expect(buildReport(registry,['README.md']).matches).toEqual([]);
  });

  it('returns deterministic machine-readable matches without running tests',()=>{
    const output=run('--files','src/components/AppTextInput.tsx','server/deviceSessionRegistry.ts','--json');
    expect(output.status).toBe(0);
    const report=JSON.parse(output.stdout);
    expect(report.matches.map((p:{id:string})=>p.id)).toEqual(['FP-001','FP-003']);
    expect(report.suggestedCommands).toHaveLength(1);
    expect(report.suggestedCommands[0]).toContain('npx vitest run');
  });

  it('runs advisory risk matching automatically in core CI without replacing its gates',()=>{
    const ci=readFileSync(path.join(root,'.github/workflows/ci.yml'),'utf8');
    expect(ci).toContain('fetch-depth: 2');
    expect(ci).toContain('npm run defects:preflight -- --base HEAD^1');
    expect(ci).toContain('npm run check');
    expect(ci).toContain('npm audit --audit-level=high');
  });

  it('rejects conflicting argument modes and invalid explicit paths',()=>{
    expect(run('--files').status).toBe(1);
    expect(run('--base','develop','--working').status).toBe(1);
    const invalid=run('--files','../outside');
    expect(invalid.status).toBe(1);
    expect(invalid.stderr).toContain('repository-relative');
  });
});
