import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const read=(path:string)=>readFileSync(path,'utf8');
const ci=read('.github/workflows/ci.yml');
const real=read('.github/workflows/real-stack-e2e.yml');
const backup=read('.github/workflows/desktop-backup-focused-qa.yml');
const codeql=read('.github/workflows/codeql.yml');

describe('#649 whole-implementation CI workflow cost and safety cadence',()=>{
  it('derives current progress from unique original roadmap IDs rather than accumulated checkpoint increments',()=>{
    const plan=read('docs/audits/WHOLE_APP_REMEDIATION_649_PLAN.md');
    const status=read('docs/audits/ISSUE_649_BULK_IMPLEMENTATION_STATUS.md');
    const frozen=read('docs/audits/WHOLE_APP_PHASE1_132_DISPOSITIONS_649.md');
    const start=plan.indexOf('## Code work packages and explicit sub-implementations');
    const end=plan.indexOf('## Evidence and release acceptance — separate from code implementation counters',start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const checklist=plan.slice(start,end);
    const entries=[...checklist.matchAll(/^- \[([ x])\] \*\*(I\d\d\.\d\d)\*\*/gm)];
    const original=[...frozen.matchAll(/^\| (I\d\d\.\d\d) \|/gm)].map(m=>m[1]);
    expect(original).toHaveLength(132);
    expect(new Set(original).size).toBe(132);
    expect(entries.map(m=>m[2]).sort()).toEqual(original.sort());
    const groups=[...checklist.matchAll(/^### (I\d\d)\. .+ — (\d+)\/(\d+)$/gm)];
    expect(groups).toHaveLength(23);
    expect(new Set(groups.map(m=>m[1])).size).toBe(23);
    let complete=0;
    for(const [,id,n,d] of groups){
      const rows=entries.filter(m=>m[2].startsWith(id+'.'));
      expect(rows.length,id).toBe(Number(d));
      expect(rows.filter(m=>m[1]==='x').length,id).toBe(Number(n));
      if(n===d)complete++;
    }
    const accepted=entries.filter(m=>m[1]==='x').length;
    const expected='Implementations '+complete+'/23 completed · Sub-implementations '+accepted+'/132 completed';
    expect(plan.match(/Implementations \d+\/23 completed · Sub-implementations \d+\/132 completed/)?.[0]).toBe(expected);
    expect(status.match(/Implementations \d+\/23 completed · Sub-implementations \d+\/132 completed/)?.[0]).toBe(expected);
  });

  it('allows a single credit-stack browser suite to cover post-restack secret copy cancellation',()=>{
    const focused=read('.github/workflows/fb-focused-rendered-qa.yml');
    expect(focused).toContain("contains(github.event.pull_request.body, '<!-- run-649-credit-copy-stale-qa -->')");
    expect(focused).toContain("'credit-stack-remediation' ||");
    expect(focused).toContain('node "scripts/$suite-qa.mjs"');
  });


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
  it('preserves direct protected-PR CodeQL compatibility alongside scheduled and reusable scans',()=>{
    expect(codeql).toContain('workflow_call:');
    expect(codeql).toContain('schedule:');
    expect(codeql).toMatch(/^  pull_request:\n    branches: \[main, develop\]$/m);
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
    expect(real).toContain('supabase_2.119.0_linux_amd64.tar.gz');
    expect(real).toContain('sha256sum --check --strict');
    expect(real).toContain('"$MYFINHUB_QA_SUPABASE_CLI" start');
    expect(real).toContain('if [ -n "${MYFINHUB_QA_SUPABASE_CLI:-}" ]; then');
    expect(real).toContain('"$MYFINHUB_QA_SUPABASE_CLI" stop --no-backup');
    expect(real).not.toContain('npx --yes supabase@');
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
