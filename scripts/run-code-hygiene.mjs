import { spawnSync } from 'node:child_process';

const npm=process.platform==='win32'?'npm.cmd':'npm';
const commands=[
  ['hygiene:imports'],
  ['hygiene:graph'],
];
let failed=false;
for(const [script] of commands){
  const result=spawnSync(npm,['run',script],{stdio:'inherit',env:process.env});
  if(result.status!==0)failed=true;
}
if(failed)process.exit(1);
