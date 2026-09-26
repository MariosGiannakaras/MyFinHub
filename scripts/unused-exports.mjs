import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const candidateRoots=['src','server','api'];
const consumerRoots=['src','server','api','tests','scripts','desktop'];
const rootConsumers=['vite.config.ts'];
const sourceExtensions=new Set(['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs']);

function normalize(file){return path.normalize(file);}
function isSourceFile(file){return sourceExtensions.has(path.extname(file))&&!file.endsWith('.d.ts');}
function walk(dir,target){
  if(!fs.existsSync(dir))return;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name==='.git'||entry.name==='dist'||entry.name==='coverage')continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,target);
    else if(isSourceFile(full))target.add(normalize(full));
  }
}
function mask(source,{strings}){
  let out='',i=0,state='code',quote='';
  while(i<source.length){
    const c=source[i],n=source[i+1];
    if(state==='code'){
      if(c==='/'&&n==='/'){state='line';out+='  ';i+=2;continue;}
      if(c==='/'&&n==='*'){state='block';out+='  ';i+=2;continue;}
      if(c==="'"||c==='"'||c==='`'){state='string';quote=c;out+=strings?' ':c;i++;continue;}
      out+=c;i++;continue;
    }
    if(state==='line'){
      if(c==='\n'){state='code';out+='\n';}else out+=' ';
      i++;continue;
    }
    if(state==='block'){
      if(c==='*'&&n==='/'){state='code';out+='  ';i+=2;}
      else{out+=c==='\n'?'\n':' ';i++;}
      continue;
    }
    if(state==='string'){
      if(c==='\\'&&i+1<source.length){
        out+=strings?'  ':c+source[i+1];
        i+=2;continue;
      }
      if(c===quote){
        out+=strings?' ':c;state='code';quote='';i++;continue;
      }
      out+=c==='\n'?'\n':strings?' ':c;
      i++;continue;
    }
  }
  return out;
}
function splitSpecifiers(text){return text.split(',').map(item=>item.trim()).filter(Boolean);}
function cleanSpecifier(item){return item.replace(/^type\s+/,'').trim();}
function exportedName(item){
  const parts=cleanSpecifier(item).split(/\s+as\s+/);
  return (parts[1]??parts[0]).trim();
}
function importedName(item){
  const parts=cleanSpecifier(item).split(/\s+as\s+/);
  return parts[0].trim();
}
function identifier(value){return /^[A-Za-z_$][\w$]*$/.test(value)||value==='default';}

function collectExports(source){
  const code=mask(source,{strings:true});
  const names=new Set();
  if(/(?:^|[;}\n])\s*export\s+default\b/m.test(code))names.add('default');
  const patterns=[
    /(?:^|[;}\n])\s*export\s+(?:declare\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\b/gm,
    /(?:^|[;}\n])\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)\b/gm,
    /(?:^|[;}\n])\s*export\s+(?:declare\s+)?interface\s+([A-Za-z_$][\w$]*)\b/gm,
    /(?:^|[;}\n])\s*export\s+(?:declare\s+)?type\s+([A-Za-z_$][\w$]*)\b/gm,
    /(?:^|[;}\n])\s*export\s+(?:declare\s+)?enum\s+([A-Za-z_$][\w$]*)\b/gm,
    /(?:^|[;}\n])\s*export\s+(?:declare\s+)?(?:namespace|module)\s+([A-Za-z_$][\w$]*)\b/gm,
    /(?:^|[;}\n])\s*export\s+(?:declare\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/gm,
    /(?:^|[;}\n])\s*export\s*\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\b/gm,
  ];
  for(const regex of patterns)for(const match of code.matchAll(regex))names.add(match[1]);

  const named=/(?:^|[;}\n])\s*export\s+(?:type\s+)?\{([\s\S]*?)\}\s*(?:from\b|;|$)/gm;
  for(const match of code.matchAll(named)){
    for(const item of splitSpecifiers(match[1])){
      const name=exportedName(item);
      if(identifier(name))names.add(name);
    }
  }
  return names;
}
function resolveSpecifier(baseRoot,fromFile,specifier,fileSet){
  const clean=specifier.replace(/[?#].*$/,'');
  let base;
  if(clean.startsWith('.'))base=path.resolve(path.dirname(fromFile),clean);
  else if(clean.startsWith('/')){
    const relative=clean.slice(1);
    if(!consumerRoots.some(rootName=>relative===rootName||relative.startsWith(rootName+'/'))&&!rootConsumers.includes(relative))return null;
    base=path.resolve(baseRoot,relative);
  }else return null;

  const ext=path.extname(base);
  const candidates=[];
  if(['.js','.jsx','.mjs','.cjs'].includes(ext)){
    const stem=base.slice(0,-ext.length);
    candidates.push(stem+'.ts',stem+'.tsx',stem+'.mts',stem+'.cts');
  }else if(ext){
    candidates.push(base);
  }else{
    candidates.push(base+'.ts',base+'.tsx',base+'.mts',base+'.cts',path.join(base,'index.ts'),path.join(base,'index.tsx'),path.join(base,'index.mts'),path.join(base,'index.cts'));
  }
  return candidates.map(normalize).find(candidate=>fileSet.has(candidate))??null;
}
function frameworkOwnedExport(baseRoot,file,name){
  const relative=path.relative(baseRoot,file).replaceAll(path.sep,'/');
  if(relative==='server/index.ts'&&name==='default')return true;
  if(relative==='src/qaApprovedDashboardFixture.ts'&&name==='qaFinanceData')return true;
  if(!relative.startsWith('api/'))return false;
  return name==='default'||name==='config'||name==='runtime'||name==='maxDuration';
}
function analyze(baseRoot,sources,candidateFiles){
  const fileSet=new Set(sources.keys());
  const exportsByFile=new Map();
  const usedByFile=new Map();
  const usedAll=new Set();

  for(const file of candidateFiles){
    exportsByFile.set(file,collectExports(sources.get(file)??''));
    usedByFile.set(file,new Set());
  }
  const use=(target,name)=>{
    if(target&&candidateFiles.has(target)&&identifier(name))usedByFile.get(target).add(name);
  };
  const useAll=(target)=>{
    if(target&&candidateFiles.has(target))usedAll.add(target);
  };

  for(const [file,source] of sources){
    const clean=mask(source,{strings:false});
    const importFrom=/^\s*import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
    for(const match of clean.matchAll(importFrom)){
      const clause=match[1].trim().replace(/^type\s+/,'').trim();
      const target=resolveSpecifier(baseRoot,file,match[2],fileSet);
      if(!target)continue;
      if(/^\*/.test(clause)){useAll(target);continue;}
      if(clause.startsWith('{')){
        const body=clause.match(/^\{([\s\S]*?)\}$/)?.[1]??'';
        for(const item of splitSpecifiers(body))use(target,importedName(item));
        continue;
      }
      const comma=clause.indexOf(',');
      if(comma<0){use(target,'default');continue;}
      use(target,'default');
      const rest=clause.slice(comma+1).trim();
      if(rest.startsWith('*'))useAll(target);
      else if(rest.startsWith('{')){
        const body=rest.match(/^\{([\s\S]*?)\}$/)?.[1]??'';
        for(const item of splitSpecifiers(body))use(target,importedName(item));
      }else useAll(target);
    }

    const exportFrom=/^\s*export\s+(?:type\s+)?(\*\s+as\s+[A-Za-z_$][\w$]*|\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
    for(const match of clean.matchAll(exportFrom)){
      const clause=match[1].trim();
      const target=resolveSpecifier(baseRoot,file,match[2],fileSet);
      if(!target)continue;
      if(clause.startsWith('*')){useAll(target);continue;}
      const body=clause.slice(1,-1);
      for(const item of splitSpecifiers(body))use(target,importedName(item));
    }

    const dynamic=/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    for(const match of clean.matchAll(dynamic))useAll(resolveSpecifier(baseRoot,file,match[1],fileSet));
    const required=/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    for(const match of clean.matchAll(required))useAll(resolveSpecifier(baseRoot,file,match[1],fileSet));
  }

  const findings=[];
  for(const file of [...candidateFiles].sort()){
    if(usedAll.has(file))continue;
    const used=usedByFile.get(file);
    for(const name of [...(exportsByFile.get(file)??[])].sort()){
      if(used.has(name)||frameworkOwnedExport(baseRoot,file,name))continue;
      findings.push({file,name});
    }
  }
  return findings;
}
function selfTest(){
  const fixtureRoot=path.join(root,'__unused_exports_fixture__');
  const file=(...parts)=>normalize(path.join(fixtureRoot,...parts));
  const sources=new Map([
    [file('src','a.ts'),"export const used=1; export const dead=2; export type Shape={x:number}; export default function main(){}"],
    [file('src','consumer.ts'),"import main,{used,type Shape} from './a'; console.log(main,used); const value:Shape={x:1};"],
    [file('src','namespace.ts'),"export const x=1; export const y=2;"],
    [file('tests','namespace.test.ts'),"import * as values from '../src/namespace'; console.log(values.x);"],
    [file('src','theme.ts'),"export const runtimeOnly=1;"],
    [file('scripts','theme-qa.mts'),"const mod=await import('/src/theme.ts?qa=1'); console.log(mod.runtimeOnly);"],
    [file('src','fixture.ts'),"export const queryUsed=1;"],
    [file('src','query-consumer.ts'),"import {queryUsed} from './fixture.ts?canonical'; console.log(queryUsed);"],
    [file('src','qaApprovedDashboardFixture.ts'),"export function qaFinanceData(){return {}}"],
    [file('server','index.ts'),"export default function app(){}"],
    [file('api','route.ts'),"export default function handler(){}; export const config={runtime:'nodejs'};"],
  ]);
  const candidates=new Set([file('src','a.ts'),file('src','namespace.ts'),file('src','theme.ts'),file('src','fixture.ts'),file('src','qaApprovedDashboardFixture.ts'),file('server','index.ts'),file('api','route.ts')]);
  const actual=analyze(fixtureRoot,sources,candidates).map(item=>path.relative(fixtureRoot,item.file).replaceAll(path.sep,'/')+'::'+item.name);
  const expected=['src/a.ts::dead'];
  if(JSON.stringify(actual)!==JSON.stringify(expected))throw new Error('Unused-export analyzer sanity check failed: '+JSON.stringify(actual));
}
selfTest();

const allFiles=new Set();
for(const sourceRoot of consumerRoots)walk(path.join(root,sourceRoot),allFiles);
for(const relative of rootConsumers){
  const full=normalize(path.join(root,relative));
  if(fs.existsSync(full)&&isSourceFile(full))allFiles.add(full);
}
const candidateFiles=new Set();
for(const sourceRoot of candidateRoots){
  const prefix=normalize(path.join(root,sourceRoot))+path.sep;
  for(const file of allFiles)if(file.startsWith(prefix))candidateFiles.add(file);
}
const sources=new Map([...allFiles].map(file=>[file,fs.readFileSync(file,'utf8')]));
const findings=analyze(root,sources,candidateFiles);

if(findings.length){
  console.error('Unused-export check failed: '+findings.length+' conservative finding(s) across '+candidateFiles.size+' candidate module(s).');
  for(const finding of findings)console.error(' - '+path.relative(root,finding.file).replaceAll(path.sep,'/')+' :: '+finding.name);
  process.exit(1);
}
console.log('Unused-export check passed: 0 conservative findings across '+candidateFiles.size+' candidate module(s).');
