import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(path,'utf8');
const ci=read('.github/workflows/ci.yml');
const real=read('.github/workflows/real-stack-e2e.yml');
const backup=read('.github/workflows/desktop-backup-focused-qa.yml');
const codeql=read('.github/workflows/codeql.yml');

describe('#649 whole-implementation CI workflow cost and safety cadence',()=>{
  it('selects exactly two existing card clipboard suites for one Draft focused QA opt-in',()=>{
    const focused=read('.github/workflows/fb-focused-rendered-qa.yml');
    expect(focused).toContain("contains(github.event.pull_request.body, '<!-- run-649-card-copy-qa -->')");
    expect(focused).toContain("'cards-remediation credit-stack-remediation'");
    expect(focused).toContain("github.event.pull_request.head.repo.full_name == github.repository");
  });


  it('runs only the settings-tabs Chromium suite when the Settings Data focused marker is enabled',()=>{
    const focused=read('.github/workflows/fb-focused-rendered-qa.yml');
    expect(focused).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(focused).toContain("contains(github.event.pull_request.body, '<!-- run-649-settings-data-qa -->') ||");
    expect(focused).toContain("contains(github.event.pull_request.body, '<!-- run-649-settings-data-qa -->') &&\n          'settings-tabs' ||");
    expect(focused).toContain('node "scripts/$suite-qa.mjs"');
    expect(focused).toContain('Upload focused screenshots and all suite logs');
  });

  it('preserves a mandatory develop/main validate + reusable CodeQL source and release gates',()=>{
    expect(ci).toContain('name: validate');
    expect(ci).toContain("branches: [main, develop]");
    expect(ci).toContain('npm run check');
    expect(ci).toContain('Local PostgreSQL shared PIN and RLS smoke');
    expect(ci).toContain('uses: ./.github/workflows/codeql.yml');
    expect(ci).toContain('Unified required gate');
    expect(ci).toContain('require_success codeql "$CODEQL"');
    expect(ci).toContain('require_success validate "$VALIDATE"');
    expect(ci).toContain('require_success webkit "$WEBKIT"');
    expect(ci).toContain('require_success windows "$WINDOWS"');
  });
  it('avoids a second PR-triggered standalone CodeQL while preserving scheduled and reusable scans',()=>{
    expect(codeql).toContain('workflow_call:');
    expect(codeql).toContain('schedule:');
    expect(codeql).not.toMatch(/^\s*pull_request:/m);
    expect(codeql).toContain('github/codeql-action/analyze');
  });
  it('requires real Supabase/Storage/Chromium proof on non-draft review heads but opts into costly draft checks',()=>{
    expect(real).toContain('ready_for_review');
    expect(real).toContain('workflow_dispatch:');
    expect(real).toContain("github.event.pull_request.draft == false");
    expect(real).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(real).toContain('<!-- run-real-stack-e2e -->');
    expect(real).toContain('npm run qa:real-stack');
    expect(real).toContain('npm run qa:migration-recovery');
    expect(real).toContain('supabase@2.119.0 stop --no-backup');
    expect(real).not.toMatch(/secrets\./);
  });
  it('requires actual backup rendering, failing visual assertions and artifact capture on review',()=>{
    expect(backup).toContain('ready_for_review');
    expect(backup).toContain("github.event.pull_request.draft == false");
    expect(backup).toContain("github.event.pull_request.head.repo.full_name == github.repository");
    expect(backup).toContain('<!-- run-desktop-backup-focused-qa -->');
    expect(backup).toContain('node scripts/desktop-backup-rendered-qa.mjs');
    expect(backup).toContain("grep -q 'Desktop backup Chromium CDP bootstrap failed'");
    expect(backup).toContain('Upload focused PNG evidence');
    const script=read('scripts/desktop-backup-rendered-qa.mjs');
    expect(script).toContain('seed:{accounts:[],months:[],transactions:[]');
    expect(script).toContain('state:{settings:{},events:[]}');
    expect(script).toContain('destructive restore confirmation with validated JSON preview');
    expect(script).toContain('desktop-backup-restore-diagnostic-desktop.png');
  });
});
