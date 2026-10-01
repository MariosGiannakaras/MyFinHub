import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const assetsDir=resolve('dist/assets');
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
  {label:'main application JS',match:file=>/^index-[^.]+\.js$/.test(file),raw:525*1024,gzip:165*1024},
  {label:'chart JS',match:file=>/^CartesianChart-[^.]+\.js$/.test(file),raw:380*1024,gzip:115*1024},
  // Keep the compressed eager CSS ceiling strict while allowing modest raw-source headroom.
  {label:'eager application CSS',match:file=>/^index-[^.]+\.css$/.test(file),raw:256*1024,gzip:46*1024},
];

const aggregateBudgets=[
  // Prevent route-level code splitting from hiding total stylesheet growth.
  {label:'total application CSS',match:file=>/\.css$/.test(file),raw:500*1024,gzip:100*1024},
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
  console.log(`${budget.label}: ${assets.length} assets · ${format(raw)} raw / ${format(gzip)} gzip · budget ${format(budget.raw)} / ${format(budget.gzip)} ${rawOk&&gzipOk?'✓':'✗'}`);
  if(!rawOk||!gzipOk)failed=true;
}

if(failed){
  console.error('Bundle budget failed. Investigate eager imports, duplicated dependencies, stylesheet growth or route-level chunk regressions before changing a budget.');
  process.exit(1);
}
console.log('Release-readiness bundle budgets passed.');
