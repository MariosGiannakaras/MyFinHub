import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dateWindows, failureStepGroup, inventory, renderSummary, splitWindow } from '../scripts/historical-defect-miner.mjs';

const run=(id:number,date='2026-09-02',name='CI')=>({
  id,name,conclusion:'failure',created_at:date+'T10:00:00Z',
  head_sha:'a'.repeat(40),html_url:'https://github.com/MariosGiannakaras/MyFinHub/actions/runs/'+id,
});

describe('historical defect mining inventory',()=>{
  it('creates disjoint UTC windows across month boundaries and handles leap dates',()=>{
    expect(dateWindows('2026-09-28','2026-10-03',3)).toEqual([
      {since:'2026-09-28',until:'2026-09-30'},
      {since:'2026-10-01',until:'2026-10-03'},
    ]);
    expect(splitWindow({since:'2026-09-01',until:'2026-09-07'})).toEqual([
      {since:'2026-09-01',until:'2026-09-03'},
      {since:'2026-09-04',until:'2026-09-07'},
    ]);
    expect(dateWindows('2028-02-28','2028-03-01',1)).toHaveLength(3);
    expect(()=>dateWindows('2026-02-29','2026-03-01')).toThrow();
    expect(()=>dateWindows('2026-03-02','2026-03-01')).toThrow();
  });

  it('automatically bisects GitHub 1000-run pagination caps',async()=>{
    const paths:string[]=[];
    const request=async(path:string)=>{
      paths.push(path);
      if(path.includes('2026-09-01..2026-09-07'))return {total_count:1000,workflow_runs:[]};
      if(path.includes('2026-09-01..2026-09-03'))return {total_count:1,workflow_runs:[run(1)]};
      if(path.includes('2026-09-04..2026-09-07'))return {total_count:1,workflow_runs:[run(2,'2026-09-04')]};
      throw new Error('unexpected fixture');
    };
    const report=await inventory({since:'2026-09-01',until:'2026-09-07',request});
    expect(paths).toHaveLength(3);
    expect(report.coverageComplete).toBe(true);
    expect(report.observedFailures).toBe(2);
    expect(report.windows).toBe(2);
    expect(report.byWorkflow.CI).toBe(2);
    expect(report.distinctFailingHeads).toBe(1);
  });

  it('paginates 105 failures, deduplicates stable run IDs and ignores non-failures',async()=>{
    const all=Array.from({length:105},(_,i)=>run(i+1));
    const request=async(p:string)=>/[?&]page=1(?:&|$)/.test(p)
      ?{total_count:106,workflow_runs:[...all.slice(0,99),{...run(999),conclusion:'cancelled'}]}
      :{total_count:105,workflow_runs:all.slice(99)};
    const r=await inventory({since:'2026-09-02',until:'2026-09-02',request});
    expect(r.coverageComplete).toBe(false); // 105 advertised, but only 105 slots and one is not a failed run.
    expect(r.observedFailures).toBe(105);
    expect(r.sampleFailedRuns).toHaveLength(20);
    expect(r.partialWarnings).toContain('actions-result-count-mismatch');
  });

  it('rejects duplicated pagination pages rather than counting the same failures twice',async()=>{
    const first=Array.from({length:100},(_,i)=>run(i+1));
    const request=async()=>({total_count:101,workflow_runs:first});
    const report=await inventory({since:'2026-09-02',until:'2026-09-02',request});
    expect(report.coverageComplete).toBe(false);
    expect(report.observedFailures).toBe(100);
    expect(report.partialWarnings).toContain('duplicate-run-id-in-window');
    expect(report.partialWarnings).toContain('actions-result-count-mismatch');
  });

  it('treats API/network/rate-budget gaps as partial without leaking server error text',async()=>{
    const request=async()=>{throw Object.assign(new Error('finance-password-never-print'),{code:'RATE_LIMIT'});};
    const r=await inventory({since:'2026-09-01',until:'2026-09-01',request});
    expect(r.coverageComplete).toBe(false);
    expect(renderSummary(r)).toContain('PARTIAL');
    expect(JSON.stringify(r)).not.toContain('finance-password-never-print');
    expect(r.partialWarnings).toContain('GitHub request failed: rate-limit');
  });

  it('bounds requests and prevents a partial scan from reporting complete coverage',async()=>{
    const request=async(p:string)=>p.includes('page=1')
      ?{total_count:120,workflow_runs:Array.from({length:100},(_,i)=>run(i+1))}
      :{total_count:120,workflow_runs:Array.from({length:20},(_,i)=>run(i+101))};
    const r=await inventory({since:'2026-09-01',until:'2026-09-01',request,maxRequests:1});
    expect(r.requests).toBe(1);
    expect(r.coverageComplete).toBe(false);
    expect(r.partialWarnings).toContain('request-budget-exhausted');
    expect(r.observedFailures).toBe(100);
  });

  it('separates actual issues from PR-shaped issue results and groups only sampled step categories',async()=>{
    const request=async(p:string)=>{
      if(p.includes('/actions/runs?'))return {total_count:1,workflow_runs:[run(8)]};
      if(p.includes('/actions/runs/8/jobs'))return {jobs:[{steps:[{name:'npm run check',conclusion:'failure'},{name:'upload logs',conclusion:'success'}]}]};
      if(p.includes('/issues?'))return [{number:1},{number:2,pull_request:{url:'irrelevant'}}];
      if(p.includes('/pulls?state=closed'))return [{number:2}];
      if(p.includes('/pulls?state=open'))return [];
      throw new Error('unexpected request '+p);
    };
    const r=await inventory({since:'2026-09-02',until:'2026-09-02',request,includeTrackers:true,inspectJobs:1});
    expect(r.coverageComplete).toBe(true);
    expect(r.trackers.issues?.count).toBe(1);
    expect(r.trackers.closedPRs?.count).toBe(1);
    expect(r.trackers.openPRs?.count).toBe(0);
    expect(r.jobStepCategories).toEqual({'source-tests-build':1});
    expect(r.classification).toContain('no incident root cause');
    expect(failureStepGroup('npm run hygiene')).toBe('hygiene');
  });

  it('keeps the optional miner separate from required CI and restricts workflow credentials',()=>{
    const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url),'utf8')) as {scripts:Record<string,string>};
    const actions=readFileSync(new URL('../.github/workflows/historical-defect-mining.yml',import.meta.url),'utf8');
    expect(pkg.scripts['defects:mine']).toContain('scripts/historical-defect-miner.mjs');
    expect(pkg.scripts.check).not.toContain('defects:mine');
    expect(actions).toContain('actions: read');
    expect(actions).toContain('pull-requests: read');
    expect(actions).toContain('github.event_name ==');
    expect(actions).toContain('defects:mine');
    expect(actions).not.toContain('permissions: write-all');
  });
});
