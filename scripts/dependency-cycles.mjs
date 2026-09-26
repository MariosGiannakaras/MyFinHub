import fs from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';

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
  const candidates=[];
  const ext=path.extname(base);
  if(ext==='.js'||ext==='.jsx'||ext==='.mjs'||ext==='.cjs'){
    const stem=base.slice(0,-ext.length);
    candidates.push(stem+'.ts',stem+'.tsx');
  }else if(ext){
    candidates.push(base);
  }else{
    candidates.push(base+'.ts',base+'.tsx',path.join(base,'index.ts'),path.join(base,'index.tsx'));
  }
  return candidates.map(path.normalize).find(candidate=>fileSet.has(candidate))??null;
}

function moduleSpecifiers(sourceText,fileName){
  const sf=ts.createSourceFile(fileName,sourceText,ts.ScriptTarget.Latest,true,fileName.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const specs=[];
  function visit(node){
    if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteralLike(node.moduleSpecifier)){
      specs.push(node.moduleSpecifier.text);
    }else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments.length===1&&ts.isStringLiteralLike(node.arguments[0])){
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node,visit);
  }
  visit(sf);
  return specs;
}

const graph=new Map();
for(const file of files){
  const source=fs.readFileSync(file,'utf8');
  const deps=new Set();
  for(const specifier of moduleSpecifiers(source,file)){
    const resolved=resolveRelative(file,specifier);
    if(resolved)deps.add(resolved);
  }
  graph.set(file,[...deps].sort());
}

const state=new Map();
const stack=[];
const cycles=[];
const seenCycles=new Set();

function canonicalCycle(nodes){
  const cycle=nodes.slice(0,-1).map(file=>path.relative(root,file).replaceAll(path.sep,'/'));
  const rotations=cycle.map((_,i)=>[...cycle.slice(i),...cycle.slice(0,i)]);
  const canonical=rotations.map(items=>items.join(' -> ')).sort()[0];
  return canonical+' -> '+canonical.split(' -> ')[0];
}

function dfs(file){
  state.set(file,1);
  stack.push(file);
  for(const dep of graph.get(file)??[]){
    const depState=state.get(dep)??0;
    if(depState===0)dfs(dep);
    else if(depState===1){
      const start=stack.lastIndexOf(dep);
      const nodes=[...stack.slice(start),dep];
      const key=canonicalCycle(nodes);
      if(!seenCycles.has(key)){seenCycles.add(key);cycles.push(key);}
    }
  }
  stack.pop();
  state.set(file,2);
}
for(const file of [...files].sort())if((state.get(file)??0)===0)dfs(file);

if(cycles.length){
  console.error('Dependency cycles detected:');
  for(const cycle of cycles.sort())console.error(' - '+cycle);
  process.exit(1);
}
console.log(`Dependency-cycle check passed: ${files.length} TypeScript modules across ${sourceRoots.join(', ')}.`);
