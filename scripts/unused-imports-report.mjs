import { spawnSync } from 'node:child_process';

const configs=['tsconfig.app.json','tsconfig.node.json','api/tsconfig.json'];
const findings=[];

for(const config of configs){
  const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',[
    '--no-install','tsc','-p',config,'--noEmit','--noUnusedLocals','true','--noUnusedParameters','false','--pretty','false'
  ],{encoding:'utf8'});
  const output=(result.stdout||'')+'\n'+(result.stderr||'');
  for(const line of output.split(/\r?\n/)){
    if(!/TS(?:6133|6192|6196):/.test(line))continue;
    findings.push({config,line:line.trim()});
  }
  if(result.error)throw result.error;
}

const unique=[...new Map(findings.map(item=>[item.config+'|'+item.line,item])).values()];
if(unique.length){
  console.log('Unused-symbol baseline: '+unique.length+' TypeScript finding(s). Report-only until Stage-6 classification is complete.');
  for(const item of unique)console.log(' - ['+item.config+'] '+item.line);
}else{
  console.log('Unused-symbol baseline: 0 findings.');
}
