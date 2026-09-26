import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');

const root=process.cwd();
const configs=['tsconfig.app.json','tsconfig.node.json','api/tsconfig.json'];
const findings=[];

function lineText(sourceFile,start){
  const line=sourceFile.getLineAndCharacterOfPosition(start).line;
  return sourceFile.text.split(/\r?\n/)[line]??'';
}
function isImportDiagnostic(diag){
  if(!diag.file||typeof diag.start!=='number')return false;
  let node=diag.file.getTokenAtPosition?.(diag.start);
  if(!node){
    node=(function find(current){
      if(diag.start>=current.getFullStart()&&diag.start<current.getEnd()){
        let found=current;
        current.forEachChild(child=>{const nested=find(child);if(nested)found=nested;});
        return found;
      }
      return null;
    })(diag.file);
  }
  while(node){
    if(ts.isImportDeclaration(node)||ts.isImportClause(node)||ts.isImportSpecifier(node)||ts.isNamespaceImport(node)||ts.isImportEqualsDeclaration(node))return true;
    node=node.parent;
  }
  return /\bimport\b/.test(lineText(diag.file,diag.start));
}

for(const configName of configs){
  const configPath=path.join(root,configName);
  const raw=ts.readConfigFile(configPath,ts.sys.readFile);
  if(raw.error){
    findings.push({config:configName,message:ts.flattenDiagnosticMessageText(raw.error.messageText,'\n')});
    continue;
  }
  const parsed=ts.parseJsonConfigFileContent(raw.config,ts.sys,path.dirname(configPath),{
    noEmit:true,
    noUnusedLocals:true,
    noUnusedParameters:false
  },configPath);
  const program=ts.createProgram({rootNames:parsed.fileNames,options:parsed.options,projectReferences:parsed.projectReferences});
  const diagnostics=ts.getPreEmitDiagnostics(program).filter(diag=>[6133,6192,6196].includes(diag.code)&&isImportDiagnostic(diag));
  for(const diag of diagnostics){
    const file=diag.file?path.relative(root,diag.file.fileName).replaceAll(path.sep,'/'):'';
    const pos=diag.file&&typeof diag.start==='number'?diag.file.getLineAndCharacterOfPosition(diag.start):null;
    findings.push({
      config:configName,
      file,
      line:pos?pos.line+1:undefined,
      column:pos?pos.character+1:undefined,
      code:diag.code,
      message:ts.flattenDiagnosticMessageText(diag.messageText,' ')
    });
  }
}

findings.sort((a,b)=>(a.file??'').localeCompare(b.file??'')||(a.line??0)-(b.line??0)||(a.code??0)-(b.code??0));
if(findings.length){
  console.log(`Unused-import baseline: ${findings.length} finding(s). This Stage-6 baseline is report-only until existing noise is classified.`);
  for(const finding of findings){
    const at=finding.file?`${finding.file}:${finding.line??1}:${finding.column??1}`:`[${finding.config}]`;
    console.log(` - ${at} TS${finding.code??''} ${finding.message}`);
  }
}else{
  console.log('Unused-import baseline: 0 findings.');
}
