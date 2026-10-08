import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const repo='/repos/MariosGiannakaras/MyFinHub';
const iso=/^\d{4}-\d{2}-\d{2}$/;
const requestTimeoutMs=15000;

function day(value){
  if(!iso.test(value))throw new Error('Expected YYYY-MM-DD date.');
  const d=new Date(value+'T00:00:00.000Z');
  if(!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==value)throw new Error('Invalid UTC calendar date.');
  return d;
}
function format(d){return d.toISOString().slice(0,10);}
function offset(s,n){const d=day(s);d.setUTCDate(d.getUTCDate()+n);return format(d);}
function dayCount(a,b){return Math.round((day(b)-day(a))/86400000)+1;}

export function dateWindows(since,until,span=7){
  const total=dayCount(since,until);
  if(total<1||total>370)throw new Error('Historical range must be 1..370 days.');
  if(!Number.isInteger(span)||span<1||span>31)throw new Error('Window must be 1..31 days.');
  const result=[];
  for(let i=0;i<total;i+=span)result.push({since:offset(since,i),until:offset(since,Math.min(total-1,i+span-1))});
  return result;
}
export function splitWindow({since,until}){
  const count=dayCount(since,until);
  if(count<=1)return null;
  const left=Math.floor(count/2);
  return [{since,until:offset(since,left-1)},{since:offset(since,left),until}];
}
export function failureStepGroup(value){
  const s=String(value??'').toLowerCase();
  if(/hygiene|unused|format/.test(s))return 'hygiene';
  if(/npm run check|vitest|typecheck|tsc|build/.test(s))return 'source-tests-build';
  if(/rendered|visual|chromium|playwright/.test(s))return 'rendered-qa';
  if(/audit|dependency/.test(s))return 'dependency-audit';
  if(/codeql|analyze/.test(s))return 'codeql';
  if(/pack|nsis|electron/.test(s))return 'desktop-package';
  if(/lighthouse|performance/.test(s))return 'performance';
  if(/first.run|clean.launch|windows/.test(s))return 'desktop-lifecycle';
  if(/supabase|migration|postgres/.test(s))return 'database-integration';
  return 'unclassified';
}
function sortObject(record){return Object.fromEntries(Object.entries(record).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])));}
function bump(target,key){target[key]=(target[key]??0)+1;}
function onlyRepoUrl(value){
  return /^https:\/\/github\.com\/MariosGiannakaras\/MyFinHub\/actions\/runs\/\d+$/.test(value??'')?value:null;
}

export async function inventory({since,until,request,includeTrackers=false,inspectJobs=0,maxRequests=160,maxRuns=25000,span=7}){
  if(typeof request!=='function')throw new Error('A read-only GitHub API request function is required.');
  const windows=dateWindows(since,until,span);
  if(!Number.isInteger(maxRequests)||maxRequests<1||maxRequests>500)throw new Error('maxRequests out of bounds.');
  if(!Number.isInteger(maxRuns)||maxRuns<1||maxRuns>50000)throw new Error('maxRuns out of bounds.');
  if(!Number.isInteger(inspectJobs)||inspectJobs<0||inspectJobs>25)throw new Error('inspectJobs out of bounds.');
  const observations=new Map(),warnings=[],coverage=[],stepGroups={},issueSummary={issues:null,closedPRs:null,openPRs:null};
  let requests=0,failed=false,stopped=false;
  async function get(apiPath){
    if(requests>=maxRequests){warnings.push('request-budget-exhausted');stopped=true;return null;}
    requests++;
    try{return await request(apiPath);}
    catch(err){warnings.push('GitHub request failed: '+(err?.code==='RATE_LIMIT'?'rate-limit':'unavailable'));failed=true;return null;}
  }
  async function scanWindow(window){
    if(stopped)return;
    const query='?status=failure&created='+window.since+'..'+window.until+'&per_page=100';
    const first=await get(repo+'/actions/runs'+query+'&page=1');
    if(!first){coverage.push({...window,complete:false,observed:0});return;}
    const count=first.total_count;
    if(!Number.isInteger(count)||count<0||!Array.isArray(first.workflow_runs)){
      warnings.push('unexpected-actions-response');failed=true;coverage.push({...window,complete:false,observed:0});return;
    }
    // The GitHub list API can announce >1000 hits while only permitting 1000 paginated results.
    if(count>=1000){
      const halves=splitWindow(window);
      if(!halves){warnings.push('single-day-actions-pagination-cap');coverage.push({...window,complete:false,reported:count,observed:0});return;}
      for(const part of halves)await scanWindow(part);
      return;
    }
    const pages=Math.ceil(count/100);
    let added=0,complete=true;
    const seenWindow=new Set();
    for(let p=1;p<=pages;p++){
      const response=p===1?first:await get(repo+'/actions/runs'+query+'&page='+p);
      if(!response||!Array.isArray(response.workflow_runs)){complete=false;break;}
      for(const run of response.workflow_runs){
        if(!Number.isSafeInteger(run.id)||run.id<=0)continue;
        if(run.conclusion!=='failure')continue;
        const name=typeof run.name==='string'&&run.name.length<=120?run.name:'Unknown workflow';
        const date=typeof run.created_at==='string'&&iso.test(run.created_at.slice(0,10))?run.created_at.slice(0,10):null;
        const sha=typeof run.head_sha==='string'&&/^[a-f0-9]{40}$/i.test(run.head_sha)?run.head_sha:null;
        const url=onlyRepoUrl(run.html_url)||'https://github.com/MariosGiannakaras/MyFinHub/actions/runs/'+run.id;
        if(seenWindow.has(run.id)){warnings.push('duplicate-run-id-in-window');continue;}
        if(!observations.has(run.id)&&observations.size>=maxRuns){warnings.push('run-budget-exhausted');stopped=true;complete=false;break;}
        observations.set(run.id,{id:run.id,name,date,sha,url});
        seenWindow.add(run.id);
        added++;
      }
      if(stopped)break;
    }
    if(complete&&added<count){warnings.push('actions-result-count-mismatch');complete=false;}
    coverage.push({...window,complete,reported:count,observed:added});
  }
  for(const win of windows)await scanWindow(win);
  async function paginate(endpoint,extract){
    let n=0,complete=true;
    for(let page=1;page<=100;page++){
      const response=await get(repo+endpoint+(endpoint.includes('?')?'&':'?')+'per_page=100&page='+page);
      if(!response||!Array.isArray(response)){complete=false;break;}
      n+=response.filter(extract).length;
      if(response.length<100)break;
      if(page===100){complete=false;warnings.push('tracker-pagination-limit');}
    }
    return {count:n,complete};
  }
  if(includeTrackers&&!stopped){
    issueSummary.issues=await paginate('/issues?state=all',x=>!x.pull_request);
    if(!stopped)issueSummary.closedPRs=await paginate('/pulls?state=closed',()=>true);
    if(!stopped)issueSummary.openPRs=await paginate('/pulls?state=open',()=>true);
  }
  // Inspect only bounded failing STEP categories, never raw log contents, error bodies or runner environment.
  if(inspectJobs&&!stopped){
    const samples=[...observations.values()].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.id-a.id).slice(0,inspectJobs);
    for(const run of samples){
      const response=await get(repo+'/actions/runs/'+run.id+'/jobs?per_page=100');
      if(!response||!Array.isArray(response.jobs))continue;
      for(const job of response.jobs)for(const step of job.steps||[]){
        if(step.conclusion==='failure')bump(stepGroups,failureStepGroup(step.name));
      }
      if(stopped)break;
    }
  }
  const byWorkflow={},byMonth={},uniqueHeads=new Set(),refs=[];
  for(const run of observations.values()){
    bump(byWorkflow,run.name);
    if(run.date)bump(byMonth,run.date.slice(0,7));
    if(run.sha)uniqueHeads.add(run.sha);
    refs.push({runId:run.id,url:run.url,workflow:run.name,date:run.date});
  }
  refs.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||b.runId-a.runId);
  const coverageComplete=!failed&&!stopped&&coverage.every(x=>x.complete)&&(
    !includeTrackers||[issueSummary.issues,issueSummary.closedPRs,issueSummary.openPRs].every(x=>x?.complete)
  );
  return {
    schemaVersion:1,range:{since,until},coverageComplete,
    requests,windows:coverage.length,observedFailures:observations.size,
    distinctFailingHeads:uniqueHeads.size,byWorkflow:sortObject(byWorkflow),byMonth:sortObject(byMonth),
    jobStepCategories:sortObject(stepGroups),trackers:issueSummary,
    // Links are diagnostic samples, not unreviewed bug classifications.
    sampleFailedRuns:refs.slice(0,20),
    partialWarnings:[...new Set(warnings)].sort(),
    coverage:coverage.sort((a,b)=>a.since.localeCompare(b.since)),
    classification:'workflow/job metadata only; no incident root cause inferred',
  };
}

function parse(argv){
  const result={includeTrackers:false,inspectJobs:0,maxRequests:160,maxRuns:25000,json:false};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--include-trackers')result.includeTrackers=true;
    else if(arg==='--json')result.json=true;
    else if(['--since','--until','--max-requests','--max-runs','--inspect-jobs'].includes(arg)){
      const v=argv[++i];
      if(!v||v.startsWith('--'))throw new Error('Missing value for '+arg);
      const key=({'--since':'since','--until':'until','--max-requests':'maxRequests','--max-runs':'maxRuns','--inspect-jobs':'inspectJobs'})[arg];
      result[key]=key==='since'||key==='until'?v:Number(v);
    }else throw new Error('Unknown argument '+arg);
  }
  if(!result.since||!result.until)throw new Error('--since and --until are required.');
  dateWindows(result.since,result.until);
  return result;
}
export function renderSummary(report){
  return [
    'Historical defect mining (read-only metadata): '+report.range.since+'..'+report.range.until,
    'Coverage: '+(report.coverageComplete?'complete for requested API windows':'PARTIAL')+'; '+report.observedFailures+' failed workflow runs, '+report.distinctFailingHeads+' distinct commit heads, '+report.requests+' API requests',
    'Top workflows: '+Object.entries(report.byWorkflow).slice(0,12).map(([name,count])=>name+'='+count).join('; '),
    'Failed-step groups (sampled, not root causes): '+JSON.stringify(report.jobStepCategories),
    'Tracker counts: '+JSON.stringify(report.trackers),
    'Warnings: '+(report.partialWarnings.join(', ')||'none'),
    'This report does not classify product bugs and cannot replace verified issue/PR root-cause evidence.',
  ].join('\n');
}
export async function githubRequest(apiPath,token){
  if(!token)throw new Error('A read-only GH_TOKEN or GITHUB_TOKEN is required.');
  if(!apiPath.startsWith(repo+'/'))throw new Error('Repository API path not allowed.');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),requestTimeoutMs);
  try{
    const response=await fetch('https://api.github.com'+apiPath,{
      headers:{accept:'application/vnd.github+json',authorization:'Bearer '+token,'x-github-api-version':'2022-11-28'},
      signal:controller.signal,
    });
    if(response.status===403||response.status===429){const e=new Error('Rate limited');e.code='RATE_LIMIT';throw e;}
    if(!response.ok)throw new Error('GitHub metadata request unavailable');
    return await response.json();
  }finally{clearTimeout(timeout);}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const opts=parse(process.argv.slice(2)),token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
    if(!token)throw new Error('GH_TOKEN or GITHUB_TOKEN must have read-only access to repository Actions metadata.');
    const report=await inventory({...opts,request:p=>githubRequest(p,token)});
    const dir=path.join(root,'.qa-artifacts','defect-mining');
    fs.mkdirSync(dir,{recursive:true});
    fs.writeFileSync(path.join(dir,'historical-inventory.json'),JSON.stringify(report,null,2)+'\n',{mode:0o600});
    console.log(opts.json?JSON.stringify(report,null,2):renderSummary(report));
    // A partial inventory is actionable diagnostics but must not silently pass as full coverage.
    if(!report.coverageComplete)process.exitCode=2;
  }catch(error){console.error('Historical inventory: '+error.message);process.exitCode=1;}
}
