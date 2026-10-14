import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const assetsDir=resolve('dist/assets');
const notFoundPath=resolve('dist/404.html');
const notFoundHtml=readFileSync(notFoundPath,'utf8');
if(!/<title>404 · MyFinHub<\/title>/.test(notFoundHtml)||!notFoundHtml.includes('Χάσαμε τη διαδρομή, όχι τα δεδομένα σου.')||/<script\b/i.test(notFoundHtml)){
  console.error('Release-readiness 404 output check failed.');
  process.exit(1);
}
const files=readdirSync(assetsDir);
const kib=value=>value/1024;
const format=value=>`${kib(value).toFixed(1)} KiB`;
const measure=file=>{
  const path=resolve(assetsDir,file);
  const raw=statSync(path).size;
  const gzip=gzipSync(readFileSync(path),{level:9}).length;
  return {file,raw,gzip};
};

const singleBudgets=[
  // Keep gzip unchanged; grant only 3 KiB raw headroom for the verified completion-hardening additions.
  {label:'main application JS',match:file=>/^index-[^.]+\.js$/.test(file),raw:528*1024,gzip:165*1024},
  {label:'chart JS',match:file=>/^CartesianChart-[^.]+\.js$/.test(file),raw:380*1024,gzip:115*1024},
  // Keep the compressed eager CSS ceiling strict while allowing modest raw-source headroom.
  {label:'eager application CSS',match:file=>/^index-[^.]+\.css$/.test(file),raw:256*1024,gzip:46*1024},
];

const aggregateBudgets=[
  // Prevent route-level code splitting from hiding total stylesheet growth.
  // The 404/error-route product surface adds a small, intentional stylesheet.
  // Owner-approved #567: soft thresholds warn of CSS growth; hard thresholds still block builds.
  // Do not relax the single eager-CSS or JavaScript ceilings.
  {label:'total application CSS',match:file=>/\.css$/.test(file),warnRaw:520*1024,warnGzip:100*1024,raw:560*1024,gzip:110*1024},
];

let failed=false;
for(const budget of singleBudgets){
  const candidates=files.filter(budget.match).map(measure).sort((a,b)=>b.raw-a.raw);
  if(!candidates.length){console.error(`Bundle budget: missing ${budget.label} chunk.`);failed=true;continue}
  const selected=candidates[0];
  const rawOk=selected.raw<=budget.raw;const gzipOk=selected.gzip<=budget.gzip;
  console.log(`${budget.label}: ${selected.file} · ${format(selected.raw)} raw / ${format(selected.gzip)} gzip · budget ${format(budget.raw)} / ${format(budget.gzip)} ${rawOk&&gzipOk?'✓':'✗'}`);
  if(!rawOk||!gzipOk)failed=true;
}

for(const budget of aggregateBudgets){
  const assets=files.filter(budget.match).map(measure);
  if(!assets.length){console.error(`Bundle budget: missing ${budget.label} assets.`);failed=true;continue}
  const raw=assets.reduce((sum,asset)=>sum+asset.raw,0);
  const gzip=assets.reduce((sum,asset)=>sum+asset.gzip,0);
  const rawOk=raw<=budget.raw;const gzipOk=gzip<=budget.gzip;
  const warning=raw>budget.warnRaw||gzip>budget.warnGzip;
  const result=rawOk&&gzipOk?(warning?'⚠ above soft threshold':'✓'):'✗';
  console.log(`${budget.label}: ${assets.length} assets · ${format(raw)} raw / ${format(gzip)} gzip · warning ${format(budget.warnRaw)} / ${format(budget.warnGzip)} · hard limit ${format(budget.raw)} / ${format(budget.gzip)} ${result}`);
  if(warning&&rawOk&&gzipOk)console.warn(`Bundle budget warning: ${budget.label} exceeds reviewed soft size threshold; inspect CSS growth and production load/performance evidence before release.`);
  if(!rawOk||!gzipOk)failed=true;
}

if(failed){
  console.error('Bundle budget failed. Investigate eager imports, duplicated dependencies, stylesheet growth or route-level chunk regressions before changing a budget.');
  process.exit(1);
}
console.log('Release-readiness bundle budgets passed.');
