import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const baselinePath=path.join(root,'docs/code-health/code-hygiene-baseline.json');
const baseline=JSON.parse(fs.readFileSync(baselinePath,'utf8'));

const productionRoots=['src','server','api'];
const usageRoots=['src','server','api','tests','scripts'];
const sourceExts=new Set(['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs']);
const productionExts=new Set(['.ts','.tsx','.mts','.cts']);

const toRepoPath=file=>path.relative(root,file).split(path.sep).join('/');
const walk=(relativeRoot,exts)=>{
  const start=path.join(root,relativeRoot);
  if(!fs.existsSync(start))return [];
  const out=[];
  const visit=dir=>{
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      if(entry.name==='node_modules'||entry.name==='dist'||entry.name==='.git'||entry.name==='.performance-dist')continue;
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())visit(full);
      else if(exts.has(path.extname(entry.name))&&!entry.name.endsWith('.d.ts'))out.push(full);
    }
  };
  visit(start);
  return out;
};

const productionFiles=[...new Set(productionRoots.flatMap(dir=>walk(dir,productionExts)))].sort();
const usageFiles=[...new Set(usageRoots.flatMap(dir=>walk(dir,sourceExts)))].sort();
const productionSet=new Set(productionFiles.map(file=>path.resolve(file)));

const resolveRelative=(fromFile,specifier)=>{
  if(!specifier.startsWith('.'))return null;
  const basePath=path.resolve(path.dirname(fromFile),specifier);
  const ext=path.extname(basePath);
  const candidates=[];
  const add=value=>{if(!candidates.includes(value))candidates.push(value);};
  add(basePath);
  if(ext){
    const stem=basePath.slice(0,-ext.length);
    if(['.js','.jsx','.mjs','.cjs'].includes(ext)){
      for(const replacement of ['.ts','.tsx','.mts','.cts'])add(stem+replacement);
    }
  }else{
    for(const suffix of ['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs'])add(basePath+suffix);
    for(const suffix of ['.ts','.tsx','.mts','.cts','.js','.jsx','.mjs','.cjs'])add(path.join(basePath,'index'+suffix));
  }
  for(const candidate of candidates){
    if(fs.existsSync(candidate)&&fs.statSync(candidate).isFile())return path.resolve(candidate);
  }
  return null;
};

const stripComments=source=>{
  let out='',i=0,state='code';
  while(i<source.length){
    const ch=source[i],next=source[i+1];
    if(state==='line'){
      if(ch==='\n'){out+='\n';state='code';}else out+=' ';
      i+=1;continue;
    }
    if(state==='block'){
      if(ch==='*'&&next==='/'){out+='  ';i+=2;state='code';continue;}
      out+=ch==='\n'?'\n':' ';i+=1;continue;
    }
    if(state==='single'||state==='double'||state==='template'){
      out+=ch;
      const quote=state==='single'?"'":state==='double'?'"':'`';
      if(ch==='\\'&&i+1<source.length){out+=source[i+1];i+=2;continue;}
      if(ch===quote)state='code';
      i+=1;continue;
    }
    if(ch==='/'&&next==='/'){out+='  ';i+=2;state='line';continue;}
    if(ch==='/'&&next==='*'){out+='  ';i+=2;state='block';continue;}
    if(ch==="'"){out+=ch;state='single';i+=1;continue;}
    if(ch==='"'){out+=ch;state='double';i+=1;continue;}
    if(ch==='`'){out+=ch;state='template';i+=1;continue;}
    out+=ch;i+=1;
  }
  return out;
};

const exportedNames=new Map();
const addExport=(file,name)=>{
  if(!name||name==='default')return;
  if(!exportedNames.has(file))exportedNames.set(file,new Set());
  exportedNames.get(file).add(name);
};
const externalEntrypoint=file=>{
  const rel=toRepoPath(file);
  return rel==='src/main.tsx'||rel==='src/qa.tsx'||rel==='server/index.ts'||/^api\/[^/]+\.ts$/.test(rel);
};
const splitSpecifiers=text=>text.split(',').map(item=>item.trim()).filter(Boolean);
const originalSpecifierName=item=>{
  let value=item.trim().replace(/^type\s+/,'').trim();
  if(!value)return null;
  const match=value.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+[A-Za-z_$][\w$]*)?$/);
  return match?.[1]??null;
};
const exportedSpecifierName=item=>{
  let value=item.trim().replace(/^type\s+/,'').trim();
  if(!value)return null;
  const match=value.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
  return match?.[2]??match?.[1]??null;
};

for(const file of productionFiles){
  if(externalEntrypoint(file))continue;
  const source=stripComments(fs.readFileSync(file,'utf8'));
  const declaration=/^\s*export\s+(?:declare\s+)?(?:async\s+)?(?:function|class|enum|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;
  for(const match of source.matchAll(declaration))addExport(file,match[1]);
  const named=/^\s*export\s+(?:type\s+)?\{([\s\S]*?)\}\s*;?\s*$/gm;
  for(const match of source.matchAll(named)){
    for(const item of splitSpecifiers(match[1]))addExport(file,exportedSpecifierName(item));
  }
}

const usedExports=new Map();
const referencedModules=new Set();
const markReferenced=target=>{if(target&&productionSet.has(target))referencedModules.add(target)};
const markUsed=(target,name)=>{
  if(!target||!productionSet.has(target))return;
  markReferenced(target);
  if(!usedExports.has(target))usedExports.set(target,new Set());
  usedExports.get(target).add(name);
};
const runtimeEdges=new Map(productionFiles.map(file=>[path.resolve(file),new Set()]));
const addRuntimeEdge=(from,target)=>{
  const fromAbs=path.resolve(from);
  if(!target||!productionSet.has(target)||!runtimeEdges.has(fromAbs))return;
  runtimeEdges.get(fromAbs).add(target);
};

for(const file of usageFiles){
  const source=stripComments(fs.readFileSync(file,'utf8'));

  const importFrom=/^\s*import\s+([\s\S]*?)\s+from\s+(['"])([^'"]+)\2\s*;?/gm;
  for(const match of source.matchAll(importFrom)){
    const clause=match[1].trim();
    const target=resolveRelative(file,match[3]);
    markReferenced(target);
    const entireTypeOnly=/^type\b/.test(clause);
    if(/\*\s+as\s+/.test(clause))markUsed(target,'*');
    const braces=clause.match(/\{([\s\S]*?)\}/);
    if(braces){
      for(const item of splitSpecifiers(braces[1])){
        const name=originalSpecifierName(item);if(name)markUsed(target,name);
      }
    }
    let runtime=!entireTypeOnly;
    if(runtime&&braces&&!/^[^,{]+,/.test(clause)&&!/\*\s+as\s+/.test(clause)){
      const items=splitSpecifiers(braces[1]);
      if(items.length&&items.every(item=>/^type\s+/.test(item)))runtime=false;
    }
    if(runtime)addRuntimeEdge(file,target);
  }

  const sideEffect=/^\s*import\s+(['"])([^'"]+)\1\s*;?/gm;
  for(const match of source.matchAll(sideEffect)){const target=resolveRelative(file,match[2]);markReferenced(target);addRuntimeEdge(file,target);}

  const exportFrom=/^\s*export\s+(type\s+)?(\*|\{[\s\S]*?\})\s+from\s+(['"])([^'"]+)\3\s*;?/gm;
  for(const match of source.matchAll(exportFrom)){
    const target=resolveRelative(file,match[4]);
    markReferenced(target);
    const typeOnly=Boolean(match[1]);
    if(match[2]==='*')markUsed(target,'*');
    else{
      const inner=match[2].slice(1,-1);
      for(const item of splitSpecifiers(inner)){
        const name=originalSpecifierName(item);if(name)markUsed(target,name);
      }
    }
    let runtime=!typeOnly;
    if(runtime&&match[2]!=='*'){
      const items=splitSpecifiers(match[2].slice(1,-1));
      if(items.length&&items.every(item=>/^type\s+/.test(item)))runtime=false;
    }
    if(runtime)addRuntimeEdge(file,target);
  }

  const dynamic=/\b(import|require)\s*\(\s*(['"])([^'"]+)\2\s*\)/g;
  for(const match of source.matchAll(dynamic)){
    const target=resolveRelative(file,match[3]);
    markReferenced(target);markUsed(target,'*');addRuntimeEdge(file,target);
  }
}

const unusedExports=[];
for(const [file,names] of exportedNames){
  const fileAbs=path.resolve(file);
  if(!referencedModules.has(fileAbs))continue;
  const used=usedExports.get(fileAbs)??new Set();
  if(used.has('*'))continue;
  for(const name of names)if(!used.has(name))unusedExports.push(`${toRepoPath(file)}#${name}`);
}
unusedExports.sort();

let index=0;
const stack=[];
const indices=new Map();
const lowLinks=new Map();
const onStack=new Set();
const components=[];
const strongConnect=node=>{
  indices.set(node,index);lowLinks.set(node,index);index+=1;stack.push(node);onStack.add(node);
  for(const next of runtimeEdges.get(node)??[]){
    if(!indices.has(next)){strongConnect(next);lowLinks.set(node,Math.min(lowLinks.get(node),lowLinks.get(next)));}
    else if(onStack.has(next))lowLinks.set(node,Math.min(lowLinks.get(node),indices.get(next)));
  }
  if(lowLinks.get(node)===indices.get(node)){
    const component=[];
    while(stack.length){
      const item=stack.pop();onStack.delete(item);component.push(item);
      if(item===node)break;
    }
    const selfLoop=component.length===1&&(runtimeEdges.get(component[0])?.has(component[0])??false);
    if(component.length>1||selfLoop)components.push(component);
  }
};
for(const file of runtimeEdges.keys())if(!indices.has(file))strongConnect(file);
const runtimeCycles=components.map(component=>component.map(toRepoPath).sort().join(' | ')).sort();

const normalizeBaseline=value=>Array.isArray(value)?[...new Set(value)].sort():[];
const expectedUnused=normalizeBaseline(baseline.unusedExports);
const expectedCycles=normalizeBaseline(baseline.runtimeCycles);
const delta=(actual,expected)=>({
  unexpected:actual.filter(item=>!expected.includes(item)),
  stale:expected.filter(item=>!actual.includes(item)),
});
const unusedDelta=delta(unusedExports,expectedUnused);
const cycleDelta=delta(runtimeCycles,expectedCycles);

console.log(`Code hygiene graph: ${productionFiles.length} production modules, ${unusedExports.length} baselined unused exports, ${runtimeCycles.length} runtime cycle groups.`);
const printDelta=(label,value)=>{
  if(value.unexpected.length)console.error(`\nUnexpected ${label}:\n${value.unexpected.map(item=>`- ${item}`).join('\n')}`);
  if(value.stale.length)console.error(`\nStale ${label} baseline entries (remove them):\n${value.stale.map(item=>`- ${item}`).join('\n')}`);
};
printDelta('unused exports',unusedDelta);
printDelta('runtime cycles',cycleDelta);

if(process.argv.includes('--write-baseline')){
  fs.writeFileSync(baselinePath,JSON.stringify({unusedExports,runtimeCycles},null,2)+'\n');
  console.log(`Updated ${toRepoPath(baselinePath)}.`);
  process.exit(0);
}

if(unusedDelta.unexpected.length||unusedDelta.stale.length||cycleDelta.unexpected.length||cycleDelta.stale.length){
  console.error('\nCode-hygiene baseline mismatch. Review the findings; fix real debt or update the checked-in baseline deliberately.');
  process.exit(1);
}
