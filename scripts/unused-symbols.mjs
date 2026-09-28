import { spawnSync } from 'node:child_process';

const configs=['tsconfig.app.json','tsconfig.node.json','api/tsconfig.json'];
const unusedCode=/TS(?:6133|6192|6196):/;
const anyDiagnostic=/TS\d+:/;
const findings=new Map();
const unexpected=[];

for(const config of configs){
  const result=spawnSync(process.platform==='win32'?'npx.cmd':'npx',[
    '--no-install','tsc','-p',config,'--noEmit','--noUnusedLocals','true','--noUnusedParameters','false','--pretty','false'
  ],{encoding:'utf8'});
  if(result.error)throw result.error;

  const output=(result.stdout||'')+'\n'+(result.stderr||'');
  const lines=output.split(/\r?\n/);
  for(const rawLine of lines){
    const line=rawLine.trim();
    if(!line)continue;
    if(unusedCode.test(line)){
      const configsForFinding=findings.get(line)??new Set();
      configsForFinding.add(config);
      findings.set(line,configsForFinding);
    }else if(anyDiagnostic.test(line)){
      unexpected.push(`[${config}] ${line}`);
    }
  }

  if(result.status!==0&&!lines.some(line=>anyDiagnostic.test(line))){
    unexpected.push(`[${config}] TypeScript exited with status ${result.status} without a parseable diagnostic. ${output.trim()}`);
  }
}

if(unexpected.length){
  console.error('TypeScript hygiene invocation failed with non-unused diagnostics:');
  for(const line of unexpected)console.error(' - '+line);
  process.exit(1);
}

if(findings.size){
  console.error('Unused-symbol check failed: '+findings.size+' unique TypeScript finding(s).');
  for(const [line,configsForFinding] of findings){
    console.error(' - ['+[...configsForFinding].join(', ')+'] '+line);
  }
  process.exit(1);
}

console.log('Unused-symbol check passed: 0 TS6133/TS6192/TS6196 findings across '+configs.join(', ')+'.');
