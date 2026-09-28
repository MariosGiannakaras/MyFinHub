import { mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const baseUrl=process.env.MYFINHUB_PERF_URL||'http://127.0.0.1:4173/qa.html';
const evidenceDir=process.env.MYFINHUB_PERF_EVIDENCE_DIR||'/tmp/myfinhub-performance';
const lighthouseBin=process.env.MYFINHUB_LIGHTHOUSE_BIN||resolve(process.cwd(),'node_modules/.bin/lighthouse');
mkdirSync(evidenceDir,{recursive:true});

const cases=[
  {id:'desktop-dashboard',url:`${baseUrl}?page=dashboard&motion=reduced`,preset:'desktop',limits:{performance:.75,accessibility:.90,bestPractices:.90,lcp:4000,cls:.15,tbt:600}},
  {id:'desktop-reports',url:`${baseUrl}?page=reports&motion=reduced`,preset:'desktop',limits:{performance:.75,accessibility:.90,bestPractices:.90,lcp:4000,cls:.15,tbt:600}},
  {id:'mobile-dashboard',url:`${baseUrl}?page=dashboard&motion=reduced`,preset:null,limits:{performance:.65,accessibility:.90,bestPractices:.90,lcp:5500,cls:.15,tbt:1000}},
  {id:'mobile-extreme',url:`${baseUrl}?page=dashboard&state=extreme&motion=reduced`,preset:null,limits:{performance:.60,accessibility:.90,bestPractices:.90,lcp:6000,cls:.15,tbt:1200}},
];

const failures=[];
const pct=value=>Math.round((value??0)*100);
const num=value=>typeof value==='number'?value:Number.POSITIVE_INFINITY;

for(const entry of cases){
  const output=resolve(evidenceDir,`${entry.id}.json`);
  const args=[entry.url,'--quiet','--output=json',`--output-path=${output}`,'--only-categories=performance,accessibility,best-practices','--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage --disable-gpu'];
  if(entry.preset)args.push(`--preset=${entry.preset}`);
  const run=spawnSync(lighthouseBin,args,{encoding:'utf8',stdio:['ignore','pipe','pipe']});
  if(run.status!==0){
    console.error(run.stdout||'');console.error(run.stderr||'');
    failures.push(`${entry.id}: Lighthouse exited ${run.status}`);
    continue;
  }
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
  console.log(`${entry.id}: perf ${pct(metrics.performance)} · a11y ${pct(metrics.accessibility)} · best ${pct(metrics.bestPractices)} · LCP ${Math.round(metrics.lcp)}ms · CLS ${metrics.cls.toFixed(3)} · TBT ${Math.round(metrics.tbt)}ms`);
  const l=entry.limits;
  if(metrics.performance<l.performance)failures.push(`${entry.id}: performance ${pct(metrics.performance)} < ${pct(l.performance)}`);
  if(metrics.accessibility<l.accessibility)failures.push(`${entry.id}: accessibility ${pct(metrics.accessibility)} < ${pct(l.accessibility)}`);
  if(metrics.bestPractices<l.bestPractices)failures.push(`${entry.id}: best-practices ${pct(metrics.bestPractices)} < ${pct(l.bestPractices)}`);
  if(metrics.lcp>l.lcp)failures.push(`${entry.id}: LCP ${Math.round(metrics.lcp)}ms > ${l.lcp}ms`);
  if(metrics.cls>l.cls)failures.push(`${entry.id}: CLS ${metrics.cls.toFixed(3)} > ${l.cls}`);
  if(metrics.tbt>l.tbt)failures.push(`${entry.id}: TBT ${Math.round(metrics.tbt)}ms > ${l.tbt}ms`);
}

if(failures.length){
  console.error('Performance audit failed:');
  for(const failure of failures)console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Production-mode Lighthouse performance audit passed. Synthetic TBT is used as the interaction-responsiveness proxy; these thresholds are regression guards, not field Core Web Vitals claims.');
