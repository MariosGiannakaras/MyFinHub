import { spawnSync } from 'node:child_process';

const configs=['tsconfig.app.json','tsconfig.node.json','api/tsconfig.json'];
const findings=new Map();

for(const config of configs){
  const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',[
    '--no-install','tsc','-p',config,'--noEmit','--noUnusedLocals','true','--noUnusedParameters','false','--pretty','false'
  ],{encoding:'utf8'});
  const output=(result.stdout||'')+'\n'+(result.stderr||'');
  for(const line of output.split(/\r?\n/)){
    if(!/TS(?:6133|6192|6196):/.test(line))continue;
    const normalized=line.trim();
    const configsForFinding=findings.get(normalized)??new Set();
    configsForFinding.add(config);
    findings.set(normalized,configsForFinding);
  }
  if(result.error)throw result.error;
}

if(findings.size){
  console.log('Unused-symbol baseline: '+findings.size+' unique TypeScript finding(s). Report-only until Stage-6 classification is complete.');
  for(const [line,configsForFinding] of findings){
    console.log(' - ['+[...configsForFinding].join(', ')+'] '+line);
  }
}else{
  console.log('Unused-symbol baseline: 0 findings.');
}
