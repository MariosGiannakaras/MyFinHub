import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const sourceRoots=['src','server','api'];
const extensions=['.ts','.tsx'];
const files=[];

function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name==='node_modules'||entry.name.startsWith('.'))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(extensions.includes(path.extname(entry.name)))files.push(path.normalize(full));
  }
}
for(const sourceRoot of sourceRoots){
  const full=path.join(root,sourceRoot);
  if(fs.existsSync(full))walk(full);
}
const fileSet=new Set(files);

function resolveRelative(fromFile,specifier){
  if(!specifier.startsWith('.'))return null;
  const base=path.resolve(path.dirname(fromFile),specifier);
  const ext=path.extname(base);
  const candidates=[];
  if(['.js','.jsx','.mjs','.cjs'].includes(ext)){
    const stem=base.slice(0,-ext.length);
    candidates.push(stem+'.ts',stem+'.tsx');
  }else if(ext){
    candidates.push(base);
  }else{
    candidates.push(base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx'));
  }
  return candidates.map(path.normalize).find(candidate=>fileSet.has(candidate))??null;
}

function stripComments(source){
  let out='',i=0,state='code',quote='';
  while(i<source.length){
    const c=source[i],n=source[i+1];
    if(state==='code'){
      if(c==='/'&&n==='/'){state='line';out+='  ';i+=2;continue;}
      if(c==='/'&&n==='*'){state='block';out+='  ';i+=2;continue;}
      if(c==="'"||c==='"'||c==='`'){state='string';quote=c;out+=c;i++;continue;}
      out+=c;i++;continue;
    }
    if(state==='line'){
      if(c==='\n'){state='code';out+='\n';}else out+=' ';
      i++;continue;
    }
    if(state==='block'){
      if(c==='*'&&n==='/'){state='code';out+='  ';i+=2;}else{out+=c==='\n'?'\n':' ';i++;}
      continue;
    }
    if(state==='string'){
      out+=c;
      if(c==='\\'&&i+1<source.length){out+=source[i+1];i+=2;continue;}
      if(c===quote){state='code';quote='';}
      i++;continue;
    }
  }
  return out;
}

function splitSpecifiers(text){return text.split(',').map(item=>item.trim()).filter(Boolean)}
function namedClauseIsTypeOnly(clause){
  const match=clause.match(/^\{([\s\S]*?)\}$/);
  if(!match)return false;
  const items=splitSpecifiers(match[1]);
  return items.length>0&&items.every(item=>/^type\s+/.test(item));
}

function moduleSpecifiers(source){
  const clean=stripComments(source);
  const specs=[];

  const importFrom=/^\s*import\s+([^;]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
  for(const match of clean.matchAll(importFrom)){
    const clause=match[1].trim();
    if(/^type\b/.test(clause)||namedClauseIsTypeOnly(clause))continue;
    specs.push(match[2]);
  }

  const sideEffect=/^\s*import\s+['"]([^'"]+)['"]\s*;?/gm;
  for(const match of clean.matchAll(sideEffect))specs.push(match[1]);

  const exportFrom=/^\s*export\s+(type\s+)?(\*|\{[\s\S]*?\})\s+from\s+['"]([^'"]+)['"]\s*;?/gm;
  for(const match of clean.matchAll(exportFrom)){
    if(match[1]||(match[2]!=='*'&&namedClauseIsTypeOnly(match[2])))continue;
    specs.push(match[3]);
  }

  const dynamicRe=/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for(const match of clean.matchAll(dynamicRe))specs.push(match[1]);
  return specs;
}

const parserFixture=[
  "import type { A } from './type-a';",
  "import { type B, type C } from './type-b';",
  "export type { D } from './type-c';",
  "export { type E } from './type-d';",
  "import { type F, G } from './mixed';",
  "import './side-effect';",
  "export { H } from './runtime-export';",
  "const lazy=import('./dynamic');",
].join('\n');
const fixtureSpecs=moduleSpecifiers(parserFixture).sort();
const expectedFixture=['./dynamic','./mixed','./runtime-export','./side-effect'].sort();
if(JSON.stringify(fixtureSpecs)!==JSON.stringify(expectedFixture)){
  throw new Error('Dependency-cycle parser sanity check failed: '+JSON.stringify(fixtureSpecs));
}

const graph=new Map();
for(const file of files){
  const deps=new Set();
  for(const specifier of moduleSpecifiers(fs.readFileSync(file,'utf8'))){
    const resolved=resolveRelative(file,specifier);
    if(resolved)deps.add(resolved);
  }
  graph.set(file,[...deps].sort());
}

const state=new Map(),stack=[],cycles=[],seen=new Set();
function display(file){return path.relative(root,file).replaceAll(path.sep,'/');}
function canonicalCycle(nodes){
  const cycle=nodes.slice(0,-1).map(display);
  const forward=cycle.map((_,i)=>[...cycle.slice(i),...cycle.slice(0,i)]);
  const reversed=[...cycle].reverse();
  const backward=reversed.map((_,i)=>[...reversed.slice(i),...reversed.slice(0,i)]);
  const canonical=[...forward,...backward].map(items=>items.join(' -> ')).sort()[0];
  return canonical+' -> '+canonical.split(' -> ')[0];
}
function dfs(file){
  state.set(file,1);stack.push(file);
  for(const dep of graph.get(file)??[]){
    const s=state.get(dep)??0;
    if(s===0)dfs(dep);
    else if(s===1){
      const start=stack.lastIndexOf(dep);
      const key=canonicalCycle([...stack.slice(start),dep]);
      if(!seen.has(key)){seen.add(key);cycles.push(key);}
    }
  }
  stack.pop();state.set(file,2);
}
for(const file of [...files].sort())if((state.get(file)??0)===0)dfs(file);

if(cycles.length){
  console.error('Runtime dependency cycles detected ('+cycles.length+'):');
  for(const cycle of cycles.sort())console.error(' - '+cycle);
  process.exit(1);
}
console.log('Runtime dependency-cycle check passed: '+files.length+' TypeScript modules across '+sourceRoots.join(', ')+'. Type-only edges excluded.');
