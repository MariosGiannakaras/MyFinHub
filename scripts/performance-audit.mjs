import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const baseUrl=process.env.MYFINHUB_PERF_URL||'http://127.0.0.1:4173/qa.html';
const evidenceDir=process.env.MYFINHUB_PERF_EVIDENCE_DIR||'/tmp/myfinhub-performance';
const lighthouseBin=process.env.MYFINHUB_LIGHTHOUSE_BIN||resolve(process.cwd(),'node_modules/.bin/lighthouse');
const configuredRuns=Number.parseInt(process.env.MYFINHUB_LIGHTHOUSE_RUNS||'3',10);
const runCount=Number.isFinite(configuredRuns)&&configuredRuns>0?configuredRuns:3;
const configuredLaunchRetries=Number.parseInt(process.env.MYFINHUB_LIGHTHOUSE_LAUNCH_RETRIES||'1',10);
const launchRetries=Number.isFinite(configuredLaunchRetries)&&configuredLaunchRetries>=0?configuredLaunchRetries:1;
mkdirSync(evidenceDir,{recursive:true});

const cases=[
  {id:'desktop-dashboard',url:`${baseUrl}?page=dashboard&motion=reduced`,preset:'desktop',limits:{performance:.75,accessibility:.90,bestPractices:.90,lcp:4000,cls:.15,tbt:600}},
  {id:'desktop-reports',url:`${baseUrl}?page=reports&motion=reduced`,preset:'desktop',limits:{performance:.75,accessibility:.90,bestPractices:.90,lcp:4000,cls:.15,tbt:600}},
  {id:'mobile-dashboard',url:`${baseUrl}?page=dashboard&motion=reduced`,preset:null,limits:{performance:.65,accessibility:.90,bestPractices:.90,lcp:5500,cls:.15,tbt:1000}},
  {id:'mobile-extreme',url:`${baseUrl}?page=dashboard&state=extreme&motion=reduced`,preset:null,limits:{performance:.60,accessibility:.90,bestPractices:.90,lcp:6000,cls:.15,tbt:1200}},
  {id:'desktop-large-transactions',url:`${baseUrl}?page=transactions&state=large&motion=reduced`,preset:'desktop',limits:{performance:.65,accessibility:.90,bestPractices:.90,lcp:5000,cls:.15,tbt:900}},
  {id:'desktop-large-reports',url:`${baseUrl}?page=reports&state=large&motion=reduced`,preset:'desktop',limits:{performance:.60,accessibility:.90,bestPractices:.90,lcp:5500,cls:.15,tbt:1100}},
  {id:'desktop-large-planning',url:`${baseUrl}?page=planning&state=large&motion=reduced`,preset:'desktop',limits:{performance:.60,accessibility:.90,bestPractices:.90,lcp:5500,cls:.15,tbt:1100}},
];

const failures=[];
const pct=value=>Math.round((value??0)*100);
const num=value=>typeof value==='number'?value:Number.POSITIVE_INFINITY;
const median=values=>{
  const sorted=[...values].sort((a,b)=>a-b);
  const middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};

for(const entry of cases){
  const samples=[];
  for(let attempt=1;attempt<=runCount;attempt+=1){
    const output=resolve(evidenceDir,`${entry.id}-run-${attempt}.json`);
    const args=[entry.url,'--quiet','--output=json',`--output-path=${output}`,'--only-categories=performance,accessibility,best-practices','--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --disable-gpu'];
    if(entry.preset)args.push(`--preset=${entry.preset}`);
    let run;
    for(let launchAttempt=0;launchAttempt<=launchRetries;launchAttempt+=1){
      run=spawnSync(lighthouseBin,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
      if(run.status===0)break;
      const diagnostic=`${run.stdout??''}\n${run.stderr??''}`;
      const transientLauncherFailure=/waiting for dynamic debugging port in chrome-err\.log/i.test(diagnostic);
      if(transientLauncherFailure&&launchAttempt<launchRetries){
        console.warn(`${entry.id} run ${attempt}/${runCount}: transient Lighthouse launcher failure; retrying ${launchAttempt+1}/${launchRetries}`);
        continue;
      }
      console.error(run.stdout||'');console.error(run.stderr||'');
      failures.push(`${entry.id} run ${attempt}/${runCount}: Lighthouse exited ${run.status}`);
      break;
    }
    if(!run||run.status!==0)continue;
    const report=JSON.parse(readFileSync(output,'utf8'));
    const categories=report.categories??{};
    const audits=report.audits??{};
    const metrics={
      performance:num(categories.performance?.score),
      accessibility:num(categories.accessibility?.score),
      bestPractices:num(categories['best-practices']?.score),
      lcp:num(audits['largest-contentful-paint']?.numericValue),
      cls:num(audits['cumulative-layout-shift']?.numericValue),
      tbt:num(audits['total-blocking-time']?.numericValue),
    };
    samples.push(metrics);
    console.log(`${entry.id} run ${attempt}/${runCount}: perf ${pct(metrics.performance)} · a11y ${pct(metrics.accessibility)} · best ${pct(metrics.bestPractices)} · LCP ${Math.round(metrics.lcp)}ms · CLS ${metrics.cls.toFixed(3)} · TBT ${Math.round(metrics.tbt)}ms`);
  }

  if(samples.length!==runCount)continue;
  const metrics={
    performance:median(samples.map(sample=>sample.performance)),
    accessibility:median(samples.map(sample=>sample.accessibility)),
    bestPractices:median(samples.map(sample=>sample.bestPractices)),
    lcp:median(samples.map(sample=>sample.lcp)),
    cls:median(samples.map(sample=>sample.cls)),
    tbt:median(samples.map(sample=>sample.tbt)),
  };
  console.log(`${entry.id} median (${runCount} runs): perf ${pct(metrics.performance)} · a11y ${pct(metrics.accessibility)} · best ${pct(metrics.bestPractices)} · LCP ${Math.round(metrics.lcp)}ms · CLS ${metrics.cls.toFixed(3)} · TBT ${Math.round(metrics.tbt)}ms`);
  const l=entry.limits;
  if(metrics.performance<l.performance)failures.push(`${entry.id}: median performance ${pct(metrics.performance)} < ${pct(l.performance)}`);
  if(metrics.accessibility<l.accessibility)failures.push(`${entry.id}: median accessibility ${pct(metrics.accessibility)} < ${pct(l.accessibility)}`);
  if(metrics.bestPractices<l.bestPractices)failures.push(`${entry.id}: median best-practices ${pct(metrics.bestPractices)} < ${pct(l.bestPractices)}`);
  if(metrics.lcp>l.lcp)failures.push(`${entry.id}: median LCP ${Math.round(metrics.lcp)}ms > ${l.lcp}ms`);
  if(metrics.cls>l.cls)failures.push(`${entry.id}: median CLS ${metrics.cls.toFixed(3)} > ${l.cls}`);
  if(metrics.tbt>l.tbt)failures.push(`${entry.id}: median TBT ${Math.round(metrics.tbt)}ms > ${l.tbt}ms`);
}

if(failures.length){
  console.error('Performance audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Production-mode Lighthouse performance audit passed using the median of ${runCount} run(s) per case. Thresholds are unchanged; synthetic TBT remains the interaction-responsiveness proxy and these are regression guards, not field Core Web Vitals claims.`);
