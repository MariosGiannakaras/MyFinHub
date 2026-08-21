import { readdirSync, readFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';

const assetsDir=resolve('dist/assets');
const files=readdirSync(assetsDir);
const kib=value=>value/1024;
const format=value=>`${kib(value).toFixed(1)} KiB`;

const budgets=[
  {label:'main application JS',match:file=>/^index-[^.]+\.js$/.test(file),raw:525*1024,gzip:165*1024},
  {label:'chart JS',match:file=>/^CartesianChart-[^.]+\.js$/.test(file),raw:380*1024,gzip:115*1024},
  {label:'application CSS',match:file=>/^index-[^.]+\.css$/.test(file),raw:240*1024,gzip:46*1024},
];

let failed=false;
for(const budget of budgets){
  const candidates=files.filter(budget.match).map(file=>({file,size:statSync(resolve(assetsDir,file)).size})).sort((a,b)=>b.size-a.size);
  if(!candidates.length){console.error(`Bundle budget: missing ${budget.label} chunk.`);failed=true;continue}
  const selected=candidates[0];
  const contents=readFileSync(resolve(assetsDir,selected.file));
  const gzip=gzipSync(contents,{level:9}).length;
  const rawOk=selected.size<=budget.raw;const gzipOk=gzip<=budget.gzip;
  console.log(`${budget.label}: ${selected.file} · ${format(selected.size)} raw / ${format(gzip)} gzip · budget ${format(budget.raw)} / ${format(budget.gzip)} ${rawOk&&gzipOk?'✓':'✗'}`);
  if(!rawOk||!gzipOk)failed=true;
}

if(failed){
  console.error('Bundle budget failed. Investigate eager imports, duplicated dependencies or route-level chunk regressions before raising a budget.');
  process.exit(1);
}
console.log('Release-readiness bundle budgets passed.');
